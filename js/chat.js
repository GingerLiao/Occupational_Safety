/* ============================================================
   chat.js — AI 智能諮詢核心
   串流回覆、Markdown/Mermaid 解析、複製、來源標註、信心分數、
   一鍵追問、案件進度、語音輸入、文件生成。
   ============================================================ */
const Chat = {
  busy:false, mermaidSeq:0,
  lastContext:{ question:"", answer:"" }, allQuestions:[],
  prompts:[
    "我們準備把明年的包裝業務發包給穩懋半導體，請幫我評估風險",
    "幫我查詢台達電子的職安審查與違規紀錄",
    "桃園龜山工廠員工上班墜樓，我沒幫他保勞保，法律風險與賠償？",
    "評估一家不在政府資料庫裡的供應商，系統會怎麼回覆？",
  ],
  stepKeys:["chat.step1","chat.step2","chat.step3","chat.step4"],
  lastProgress:-1,
  turns:[], turnSeq:0, activeTurn:null, curTurnId:null, curQuestion:"", lastFollowups:[],

  init(){
    this.body = document.getElementById("chatBody");
    this.input = document.getElementById("chatInput");
    document.getElementById("sendBtn").addEventListener("click", ()=>this.submit());
    this.input.addEventListener("keydown", e=>{
      if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); this.submit(); }
    });
    this.input.addEventListener("input", ()=>{ this.input.style.height="auto"; this.input.style.height=Math.min(this.input.scrollHeight,140)+"px"; });
    document.getElementById("voiceBtn").addEventListener("click", e=>Voice.toggle(this.input, e.currentTarget));
    // 圖表放大 lightbox
    const lb=document.getElementById("lightbox");
    document.getElementById("lbClose").addEventListener("click",()=>this.closeLightbox());
    lb.addEventListener("click",e=>{ if(e.target===lb) this.closeLightbox(); });
    document.addEventListener("keydown",e=>{ if(e.key==="Escape") this.closeLightbox(); });
    // 視覺化看板 (canvas)
    this.wrap=document.getElementById("chatWrap");
    document.getElementById("canvasCollapse").addEventListener("click",()=>this.wrap.classList.add("collapsed"));
    document.getElementById("canvasReopen").addEventListener("click",()=>this.wrap.classList.remove("collapsed"));
    this.renderCanvasTabs();
    this.renderProgress(-1);
    this.greet();
    this.renderPrompts();
  },
  onLang(){
    this.renderPrompts(this.hasUserMsg ? (this.lastFollowups||[]) : null);
    this.renderProgress(this.lastProgress);
    this.renderCanvasTabs();
    if(this.activeTurn && this.turns.find(x=>x.id===this.activeTurn)) this.renderTurn(this.activeTurn);
    if(!this.hasUserMsg){ this.body.innerHTML=""; this.greet(); }
  },
  focusInput(){ setTimeout(()=>this.input.focus(),100); },
  // 整段對話的提問彙整（供報告單帶入；不含 AI 回覆，避免帶入判決案例事實）
  reportContext(){ return { question: (this.allQuestions.length? this.allQuestions.join("。") : this.lastContext.question) }; },

  // ===== 視覺化看板 artifact canvas =====
  artTitle(kind, code){
    if(kind==="table") return t("canvas.table");
    const c=code||"";
    if(/拓樸|風險評級|審查狀態|評分/.test(c)) return "風險拓樸圖";
    if(/通報|流程|賠償|步驟|責任/.test(c)) return "處理流程圖";
    if(/mindmap/.test(c)) return "關聯心智圖";
    return t("canvas.diagram");
  },
  turnTitle(){
    const q=this.curQuestion||"";
    const m=q.match(/([一-龥A-Za-z0-9]{2,10}(?:公司|工程|營造|科技|實業|企業|半導體|電子))/);
    if(m) return m[1];
    return `${t("canvas.diagram")} ${this.turnSeq}`;
  },
  // 將「同一筆對話」生成的表與圖加入同一分頁(turn)；titleOverride = 取自 AI 回覆標題
  addItem(kind, payload, code, titleOverride){
    if(this.curTurnId==null){
      const id=++this.turnSeq;
      this.turns.push({ id, title:this.turnTitle(), items:[] });
      this.curTurnId=id; this.activeTurn=id;
      if(this.wrap){ this.wrap.classList.remove("collapsed"); this.wrap.classList.add("has-art"); }
    }
    const turn=this.turns.find(x=>x.id===this.curTurnId);
    turn.items.push({ kind, title:(titleOverride || this.artTitle(kind,code)), ...payload });
    this.renderCanvasTabs();
    if(this.activeTurn!==this.curTurnId) this.activeTurn=this.curTurnId;
    this.renderTurn(this.activeTurn);
    return turn;
  },
  collectTables(content){
    content.querySelectorAll("table").forEach(tb=> this.addItem("table",{html:tb.outerHTML}, null, this.nearestHeading(tb)) );
  },
  // 取元素之前最近的標題文字（作為 AI 回覆中該表/圖的標題）
  cleanTitle(s){ return (s||"").replace(/\s+/g," ").replace(/^[\d０-９\.\．、)）\s]+/,"").replace(/[:：]\s*$/,"").trim().slice(0,22); },
  nearestHeading(el){
    let p=el && el.previousElementSibling, steps=0;
    while(p && steps<8){
      if(/^H[1-6]$/.test(p.tagName)){ const tt=this.cleanTitle(p.textContent); if(tt) return tt; }
      if(p.tagName==="P"){ const st=p.querySelector("strong,b"); if(st && p.textContent.trim().length<=28){ const tt=this.cleanTitle(st.textContent); if(tt) return tt; } }
      const hd=p.querySelector && p.querySelector("h1,h2,h3,h4,h5,h6"); if(hd){ const tt=this.cleanTitle(hd.textContent); if(tt) return tt; }
      p=p.previousElementSibling; steps++;
    }
    return null;
  },
  renderCanvasTabs(){
    const tabs=document.getElementById("canvasTabs"); if(!tabs) return;
    tabs.innerHTML=this.turns.map(tn=>`<button class="cv-tab ${this.activeTurn==tn.id?"active":""}" data-turn="${tn.id}"><span class="ti">▤</span>${tn.title}</button>`).join("");
    tabs.querySelectorAll(".cv-tab").forEach(b=>b.addEventListener("click",()=>{ this.activeTurn=+b.dataset.turn; this.renderTurn(this.activeTurn); this.renderCanvasTabs(); }));
  },
  renderTurn(id){
    const tn=this.turns.find(x=>x.id===id); if(!tn) return;
    const art=document.getElementById("cvArtifact");
    const copyI=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    const dlI=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`;
    art.innerHTML=tn.items.map((it,i)=>`
      <div class="cv-art">
        <div class="cv-art-title"><span class="badge">${it.kind==="table"?t("canvas.table"):t("canvas.diagram")}</span><span style="flex:1">${it.title}</span>
          <span class="cv-item-acts"><button class="cv-mini" data-act="copy" data-i="${i}" title="${t("chat.copy")}">${copyI}</button><button class="cv-mini" data-act="dl" data-i="${i}" title="下載">${dlI}</button></span>
        </div>
        <div class="cv-canvas ${it.kind==="diagram"?"zoom":""}" data-i="${i}">${it.svg||it.html}</div>
      </div>`).join("");
    art.querySelectorAll(".cv-canvas.zoom").forEach(c=>c.addEventListener("click",()=>this.openLightbox(tn.items[+c.dataset.i].svg)));
    art.querySelectorAll(".cv-mini").forEach(b=>b.addEventListener("click",()=>{ const it=tn.items[+b.dataset.i]; b.dataset.act==="copy"?this.copyItem(it):this.downloadItem(it); }));
  },
  copyItem(it){
    let text;
    if(it.kind==="diagram") text=it.svg;
    else { const tmp=document.createElement("div"); tmp.innerHTML=it.html;
      text=[...tmp.querySelectorAll("tr")].map(tr=>[...tr.children].map(td=>td.innerText.trim()).join("\t")).join("\n"); }
    navigator.clipboard.writeText(text).then(()=>App.toast(t("chat.copied"),"good"));
  },
  downloadItem(it){
    let blob, fn;
    if(it.kind==="diagram"){ blob=new Blob([it.svg],{type:"image/svg+xml"}); fn=`${it.title}.svg`; }
    else { const tmp=document.createElement("div"); tmp.innerHTML=it.html;
      const csv=[...tmp.querySelectorAll("tr")].map(tr=>[...tr.children].map(td=>`"${td.innerText.trim().replace(/"/g,'""')}"`).join(",")).join("\n");
      blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"}); fn=`${it.title}.csv`; }
    const url=URL.createObjectURL(blob), link=document.createElement("a");
    link.href=url; link.download=fn; link.click(); URL.revokeObjectURL(url);
    App.toast(t("report.done"),"good");
  },
  // 全螢幕放大
  openLightbox(svg){
    document.getElementById("lbBody").innerHTML=svg;
    document.getElementById("lightbox").classList.add("show");
  },
  closeLightbox(){ document.getElementById("lightbox").classList.remove("show"); },

  greet(){
    const md = window.currentLang==="zh"
      ? `### 您好，我是職盾 AI 顧問 🛡️\n\n我為**企業**即時檢索**政府審查名單、違規處分、全國法規與司法院判決**，協助您於發包前評估供應商風險、職災後掌握法律責任與應變流程。每則回覆都附上**引用法條 / 判決字號 / 資料更新日**與**信心分數**。\n\n請在下方描述您的需求，或點選快速提問。`
      : `### Hi, I'm the JobShield AI Advisor 🛡️\n\nFor enterprises, I retrieve **government audit lists, violation records, national regulations and court judgments** to help you assess supplier risk before outsourcing and grasp legal liability after an incident. Every reply includes **cited articles, case numbers, data dates** and a **confidence score**.\n\nDescribe your need below, or tap a quick question.`;
    this.addMessage("ai", md, {greet:true});
  },

  // list 為 null → 顯示預設範例；否則顯示傳入清單（如 AI 延伸問題）
  renderPrompts(list){
    const items = list || this.prompts;
    const wrap=document.getElementById("quickPrompts");
    wrap.innerHTML = items.map(p=>`<button class="qp">${p}</button>`).join("");
    wrap.querySelectorAll(".qp").forEach((b,i)=> b.addEventListener("click",()=> this.handleFollowup(items[i]) ));
  },

  renderProgress(active){
    this.lastProgress = active;
    const el=document.getElementById("progressTrack"); if(!el) return;   // 進度列已移除時 no-op
    el.innerHTML = this.stepKeys.map((k,i)=>{
      const cls = i<active?"done":i===active?"active":"";
      return `<div class="pstep ${cls}">${t(k)}</div>`;
    }).join("");
  },

  addMessage(role, md, opts={}){
    if(role==="user") this.hasUserMsg=true;
    const el=document.createElement("div");
    el.className="msg "+role;
    const aiIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" width="17" height="17"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`;
    el.innerHTML = `<div class="ava">${role==="ai"?aiIcon:"我"}</div><div style="flex:1;min-width:0"><div class="bubble"></div></div>`;
    this.body.appendChild(el);
    const bubble=el.querySelector(".bubble");
    if(role==="user"){ bubble.textContent=md; }
    else { this.renderAI(bubble, md, opts); }
    this.scroll();
    return bubble;
  },

  // 解析 AI markdown：抽出 SOURCES / FOLLOWUP，渲染 markdown + mermaid + 複製 + 來源 + 追問
  renderAI(bubble, md, opts={}){
    if(!opts.greet) this.curTurnId=null;   // 新的一筆回覆 → 開新分頁
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

    // 看板僅收集 AI 生成的「圖」，表格維持在對話框內呈現

    // render mermaid → 收進右側看板；對話框內以精簡卡片呈現（點擊放大）
    mers.forEach(async m=>{
      const box=bubble.querySelector("#"+m.id);
      if(box && window.mermaid){
        try{
          const {svg}= await mermaid.render(m.id+"svg", m.code);
          const title=this.nearestHeading(box) || this.artTitle("diagram",m.code);
          const turn=this.addItem("diagram",{svg},m.code,title);
          box.className="art-ref";
          box.title=t("viz.zoom");
          box.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 4-6"/></svg><span>${t("canvas.generated",{name:title})}</span>`;
          box.onclick=()=>{ this.activeTurn=turn.id; this.renderTurn(turn.id); this.renderCanvasTabs(); this.openLightbox(svg); };
        }
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

    // 延伸問題 → 存起來，改顯示於輸入區上方的快速提問列（取代原本的範例）
    if(!opts.greet){
      this.lastFollowups = (followups && followups.length) ? followups : this.extractFollowups(md);
    }
  },

  // 由 AI 回覆文字擷取「延伸範例問題」（適用線上 API 純文字格式）
  extractFollowups(md){
    const idx = md.search(/延伸範例問題|延伸問題|建議追問|後續.*問題|Follow[- ]?up\s*Questions?/i);
    if(idx<0) return [];
    const lines=md.slice(idx).split("\n").slice(1);
    const out=[];
    for(const raw of lines){
      let l=raw.trim();
      if(/^#{1,6}\s/.test(l)) break;
      l=l.replace(/^(?:[-*•]|\d+[.)、])\s*/,"").replace(/\*\*/g,"").trim();
      if(/[？?]$/.test(l) && l.length<=60) out.push(l);
      if(out.length>=6) break;
    }
    return out;
  },

  // 追問按鈕：部分為「動作型」(導向其他功能)，其餘送回對話
  handleFollowup(q){
    if(/理賠試算|計算確切|開啟理賠/.test(q)){ App.go("calc"); App.toast("已開啟理賠試算","good"); return; }
    if(/生成.*通報表|職災事故通報表/.test(q)){ App.go("report"); return; }
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
    this.curQuestion=q;
    this.allQuestions.push(q);
    this.input.value=""; this.input.style.height="auto";
    Voice.stop();
    this.addMessage("user", q);
    this.busy=true;

    // typing indicator
    const aiEl=document.createElement("div"); aiEl.className="msg ai";
    aiEl.innerHTML=`<div class="ava"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" width="17" height="17"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg></div><div style="flex:1"><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div></div>`;
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
    this.lastContext={ question:q, answer:res.text };
    // 開始問答後移除原範例，改為 AI 的延伸問題（無則清空）
    this.renderPrompts((this.lastFollowups && this.lastFollowups.length) ? this.lastFollowups : []);
    this.busy=false;
    this.scroll();
  },

  scroll(){ this.body.scrollTop=this.body.scrollHeight; },
};
window.Chat = Chat;
