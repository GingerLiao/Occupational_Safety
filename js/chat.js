/* ============================================================
   chat.js — AI 智能諮詢核心
   串流回覆、Markdown/Mermaid 解析、複製、來源標註、信心分數、
   一鍵追問、案件進度、語音輸入、文件生成。
   ============================================================ */
const Chat = {
  mode:"worker", busy:false, mermaidSeq:0,
  lastContext:{ question:"", answer:"" },
  prompts:{
    worker:[
      "我每天搬重物腰受傷，公司說是我姿勢不良，不算職業病，我該怎麼辦？",
      "幫我找桃園市的專責醫院做職業病鑑定",
      "家人在工地墜樓身亡，老闆沒保勞保叫我私下和解，過去判賠大概多少？",
      "工地受傷後，雇主要在幾小時內通報？流程是什麼？",
    ],
    enterprise:[
      "我們準備把明年的包裝業務發包給穩懋半導體，請幫我評估風險",
      "桃園龜山工廠員工上班墜樓，我沒幫他保勞保，法律風險與賠償？",
      "幫我查詢台達電子的職安審查與違規紀錄",
      "評估一家不在政府資料庫裡的廠商，系統會怎麼回覆？",
    ],
  },
  steps:["收到諮詢","檢索法規與資料","產生分析建議","提供後續流程"],

  init(){
    this.body = document.getElementById("chatBody");
    this.input = document.getElementById("chatInput");
    document.getElementById("sendBtn").addEventListener("click", ()=>this.submit());
    this.input.addEventListener("keydown", e=>{
      if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); this.submit(); }
    });
    this.input.addEventListener("input", ()=>{ this.input.style.height="auto"; this.input.style.height=Math.min(this.input.scrollHeight,140)+"px"; });
    document.getElementById("voiceBtn").addEventListener("click", e=>Voice.toggle(this.input, e.currentTarget));
    document.getElementById("modeToggle").addEventListener("click", e=>{
      const b=e.target.closest("button"); if(!b) return;
      this.mode=b.dataset.mode;
      document.querySelectorAll("#modeToggle button").forEach(x=>x.classList.toggle("active",x===b));
      this.renderPrompts();
    });
    document.getElementById("chatGenDoc").addEventListener("click", ()=>{
      Report.importFromChat(this.lastContext); App.go("report"); App.toast("已帶入最近一次諮詢內容","good");
    });
    this.renderProgress(-1);
    this.greet();
    this.renderPrompts();
  },
  onLang(){ this.renderPrompts(); if(!this.hasUserMsg){ this.body.innerHTML=""; this.greet(); } },
  focusInput(){ setTimeout(()=>this.input.focus(),100); },

  greet(){
    const md = window.currentLang==="zh"
      ? `### 您好，我是職盾 AI 顧問 🛡️\n\n我能即時檢索**政府公開資料、全國法規、司法院判決與職災專責醫院名單**，為您提供可溯源的建議。每則回覆都會附上**引用法條 / 判決字號 / 資料更新日**與**信心分數**。\n\n請在下方描述您的狀況，或點選快速提問。`
      : `### Hi, I'm the JobShield AI Advisor 🛡️\n\nI retrieve **government open data, regulations, court judgments and the designated-hospital list** to give you traceable advice. Every reply includes **cited articles, case numbers, data dates** and a **confidence score**.\n\nDescribe your situation below, or tap a quick question.`;
    this.addMessage("ai", md, {greet:true});
  },

  renderPrompts(){
    const wrap=document.getElementById("quickPrompts");
    wrap.innerHTML = this.prompts[this.mode].map(p=>`<button class="qp">${p}</button>`).join("");
    wrap.querySelectorAll(".qp").forEach((b,i)=> b.addEventListener("click",()=>{ this.input.value=this.prompts[this.mode][i]; this.submit(); }));
  },

  renderProgress(active){
    const labels = window.currentLang==="zh"? this.steps : ["Received","Retrieving data","Generating advice","Next steps"];
    document.getElementById("progressTrack").innerHTML = labels.map((s,i)=>{
      const cls = i<active?"done":i===active?"active":"";
      return `<div class="pstep ${cls}">${s}</div>`;
    }).join("");
  },

  addMessage(role, md, opts={}){
    if(role==="user") this.hasUserMsg=true;
    const el=document.createElement("div");
    el.className="msg "+role;
    el.innerHTML = `<div class="ava">${role==="ai"?"盾":"我"}</div><div style="flex:1;min-width:0"><div class="bubble"></div></div>`;
    this.body.appendChild(el);
    const bubble=el.querySelector(".bubble");
    if(role==="user"){ bubble.textContent=md; }
    else { this.renderAI(bubble, md, opts); }
    this.scroll();
    return bubble;
  },

  // 解析 AI markdown：抽出 SOURCES / FOLLOWUP，渲染 markdown + mermaid + 複製 + 來源 + 追問
  renderAI(bubble, md, opts={}){
    let sources=null, followups=null;
    md = md.replace(/<!--SOURCES\n([\s\S]*?)\nSOURCES-->/,(m,j)=>{ try{sources=JSON.parse(j);}catch(e){} return ""; });
    md = md.replace(/<!--FOLLOWUP\n([\s\S]*?)\nFOLLOWUP-->/,(m,j)=>{ try{followups=JSON.parse(j);}catch(e){} return ""; });

    // mermaid 區塊抽出
    const mers=[];
    md = md.replace(/```mermaid\n([\s\S]*?)```/g,(m,code)=>{ const id="mer"+(this.mermaidSeq++); mers.push({id,code}); return `\n<div class="mermaid-box" id="${id}"></div>\n`; });

    let html = window.marked? marked.parse(md) : md.replace(/\n/g,"<br>");
    const content = document.createElement("div");
    content.innerHTML = html;
    bubble.innerHTML="";
    bubble.appendChild(content);

    // render mermaid
    mers.forEach(async m=>{
      const box=bubble.querySelector("#"+m.id);
      if(box && window.mermaid){
        try{ const {svg}= await mermaid.render(m.id+"svg", m.code); box.innerHTML=svg; }
        catch(e){ box.innerHTML=`<pre>${m.code}</pre>`; }
      }
    });

    // sources + confidence
    if(sources){
      const sd=document.createElement("div"); sd.className="sources";
      let inner = `<div class="sh"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22d3ee" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/></svg> ${t("chat.sources")} · ${t("chat.updated")} ${fmtDate(sources.updated.replace(/-/g,""))}</div>`;
      inner += sources.sources.map(s=>`<div class="src-item"><span class="tagn">${s.tag}</span><span>${s.text}</span></div>`).join("");
      if(sources.confidence!=null){
        inner += `<div class="confidence"><span style="font-size:11.5px;color:var(--text-mute);font-weight:700">${t("chat.confidence")}</span><div class="conf-bar"><div class="conf-fill" style="width:${sources.confidence}%"></div></div><span class="conf-val">${sources.confidence}%</span></div>`;
      }
      sd.innerHTML=inner;
      bubble.appendChild(sd);
    }

    // action bar (copy)
    if(!opts.greet){
      const acts=document.createElement("div"); acts.className="msg-actions";
      const copyBtn=document.createElement("button"); copyBtn.className="msg-act";
      copyBtn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>${t("chat.copy")}</span>`;
      copyBtn.addEventListener("click",()=>{ navigator.clipboard.writeText(content.innerText).then(()=>{ copyBtn.querySelector("span").textContent=t("chat.copied"); App.toast(t("chat.copied"),"good"); setTimeout(()=>copyBtn.querySelector("span").textContent=t("chat.copy"),1500); }); });
      acts.appendChild(copyBtn);
      bubble.appendChild(acts);
    }

    // follow-up buttons — 一鍵送出
    if(followups && followups.length){
      const fu=document.createElement("div"); fu.className="followups";
      fu.innerHTML=`<div class="fu-label">${t("chat.followup")}</div>`;
      followups.forEach(q=>{
        const b=document.createElement("button"); b.className="fu-btn";
        b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg><span>${q}</span>`;
        b.addEventListener("click",()=>this.handleFollowup(q));
        fu.appendChild(b);
      });
      bubble.appendChild(fu);
    }
  },

  // 追問按鈕：部分為「動作型」(導向其他功能)，其餘送回對話
  handleFollowup(q){
    if(/理賠試算|計算確切|開啟理賠/.test(q)){ App.go("calc"); App.toast("已開啟理賠試算","good"); return; }
    if(/生成.*通報表|職災事故通報表/.test(q)){ Report.importFromChat(this.lastContext); App.go("report"); App.toast("已帶入通報表","good"); return; }
    if(/地圖|專責醫院.*找|找.*專責醫院/.test(q)){ App.go("map"); App.toast("已開啟專責醫院地圖","good"); return; }
    if(/加入多廠商比較|加入比較/.test(q)){
      const r=assessVendor(this.lastContext.question.match(/([一-龥A-Za-z0-9]{2,12}(?:公司|工程|營造|科技|實業|企業|半導體|電子))/)?.[1]||"");
      if(r){ Vendors.addToCompare(r.query); App.toast("已加入比較","good"); } else App.toast("請先在廠商評估頁查詢","bad");
      return;
    }
    this.input.value=q; this.submit();
  },

  async submit(){
    const q=this.input.value.trim();
    if(!q || this.busy) return;
    this.input.value=""; this.input.style.height="auto";
    Voice.stop();
    this.addMessage("user", q);
    this.busy=true;

    // typing indicator
    const aiEl=document.createElement("div"); aiEl.className="msg ai";
    aiEl.innerHTML=`<div class="ava">盾</div><div style="flex:1"><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>`;
    this.body.appendChild(aiEl); this.scroll();
    const bubble=aiEl.querySelector(".bubble");

    // progress animation
    this.renderProgress(0);
    let pi=0; const pint=setInterval(()=>{ pi=Math.min(pi+1,2); this.renderProgress(pi); }, 700);

    let firstChunk=true;
    const res = await RAG.ask(q, (partial)=>{
      if(firstChunk){ firstChunk=false; bubble.innerHTML=""; }
      // 串流期間只渲染純文字（移除尚未閉合的標註區塊）
      const clean=partial.replace(/<!--SOURCES[\s\S]*/,"").replace(/<!--FOLLOWUP[\s\S]*/,"");
      bubble.innerHTML = window.marked? marked.parse(clean) : clean.replace(/\n/g,"<br>");
      this.scroll();
    });

    clearInterval(pint);
    this.renderProgress(3);
    // 最終完整渲染
    this.renderAI(bubble, res.text);
    if(!res.live){ /* fallback used */ }
    this.lastContext={ question:q, answer:res.text };
    this.busy=false;
    this.scroll();
  },

  scroll(){ this.body.scrollTop=this.body.scrollHeight; },
};
window.Chat = Chat;
