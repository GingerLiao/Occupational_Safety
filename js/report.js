/* ============================================================
   report.js — 公司事故傷害報告單（依勞動部職安署參考格式）
   可「直接在表格上編輯」：文字欄位點擊即可輸入、☐ 點選勾選，
   完成後 html2canvas + jsPDF 一鍵輸出 PDF。
   ============================================================ */
const Report = {
  ready:false,
  opts:{
    kind:["重大傷害","輕傷害","財產損失","虛驚事故","其他"],
    target:["本國員工","外勞","承攬商"],
    degree:["死亡","殘廢","造成機器設備毀損","需申請醫療給付傷害","輕傷害","虛驚事故","交通意外","其他"],
    act:["（無）","人員注意力不集中","未使用防護具","未依照標準作業程序","誤動作","其他"],
    cond:["（無）","設備異常啟動","設備安全裝置被破壞","設備安全防護不足","安全標示不足","其他"],
    basic:["（無）","未施予教育訓練","未訂定標準作業程序","其他"],
    improve:["設備改善","作業程序改善","教育訓練","其他"],
  },
  data:{ target:"本國員工", act:"（無）", cond:"（無）", basic:"（無）" },

  init(){
    document.getElementById("downloadPdf").addEventListener("click",()=>this.downloadPDF());
  },
  onLang(){ /* 官方表單維持中文 */ },

  ensure(){
    if(this.ready) return;
    if(!this.data.datetime){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); this.data.datetime=d.toISOString().slice(0,16); }
    this.renderPreview();
    this.ready=true;
  },

  // 勾選列：可點擊切換
  chk(group, options){
    const sel=this.data[group];
    return options.map(o=>`<span class="chk ${sel===o?"on":""}" data-g="${group}" data-v="${o}">${sel===o?"☑":"☐"} ${o}</span>`).join("　");
  },
  // 可編輯文字格
  ed(k, ph){ return `<span class="edit" contenteditable="true" data-k="${k}" data-ph="${ph||""}">${this.data[k]||""}</span>`; },
  edCell(k, ph){ return `<td class="edit" contenteditable="true" data-k="${k}" data-ph="${ph||""}">${this.data[k]||""}</td>`; },

  renderPreview(){
    const d=this.data;
    const reportNo="JS-"+(new Date().toISOString().slice(0,10).replace(/-/g,""))+"-"+String(Math.floor(Math.random()*9000)+1000);
    const node=document.getElementById("docPreview");
    node.innerHTML=`
      <h2>公司事故傷害報告單</h2>
      <div class="docsub">參考勞動部職業安全衛生署「公司事故傷害報告單」格式 ｜ 職盾 JobShield</div>
      <table>
        <tr><th>事故單位</th>${this.edCell("unit","○○營造股份有限公司")}<th style="width:16%">填表日期</th><td style="width:20%">${new Date().toLocaleDateString("zh-TW")}</td></tr>
        <tr><th>通報編號</th><td>${reportNo}</td><th>所屬部門</th>${this.edCell("dept","工務部")}</tr>
      </table>
      <table><tr><th style="width:16%">事故種類</th><td colspan="3" class="chkcell" style="line-height:2.1">${this.chk("kind",this.opts.kind)}</td></tr></table>
      <div class="sechead">1. 發生時間</div>
      <table><tr>${this.edCell("datetimeText","　　年　月　日　　時　分")}</tr></table>
      <div class="sechead">2. 事故發生對象</div>
      <table>
        <tr><td colspan="4" class="chkcell" style="line-height:2.1">${this.chk("target",this.opts.target)}</td></tr>
        <tr><th style="width:16%">姓名</th>${this.edCell("victim","陳○○")}<th style="width:16%">電話</th>${this.edCell("phone","03-1234567")}</tr>
        <tr><th>作業性質</th><td colspan="3" class="edit" contenteditable="true" data-k="workNature" data-ph="例如：高架施工架組裝"></td></tr>
      </table>
      <div class="sechead">3. 事故發生地點</div>
      <table><tr><td class="edit" contenteditable="true" data-k="location" data-ph="例如：桃園市○○路工地 3F"></td></tr></table>
      <div class="sechead">4. 事故程度（可複選，點選切換）</div>
      <table><tr><td class="chkcell" style="line-height:2.2">${this.chk("degree",this.opts.degree)}</td></tr></table>
      <div class="sechead">5. 事故發生原因</div>
      <table>
        <tr><th style="width:16%">不安全行為</th><td class="chkcell" style="line-height:2">${this.chk("act",this.opts.act)}</td></tr>
        <tr><th>不安全狀況</th><td class="chkcell" style="line-height:2">${this.chk("cond",this.opts.cond)}</td></tr>
        <tr><th>基本原因</th><td class="chkcell" style="line-height:2">${this.chk("basic",this.opts.basic)}</td></tr>
      </table>
      <table>
        <tr><th colspan="4" style="background:#dde6f4">事故損失調查（元）</th></tr>
        <tr><th style="width:25%">人力損失</th><td class="edit loss" contenteditable="true" data-k="lossManpower" data-ph="0"></td><th style="width:25%">醫療費用</th><td class="edit loss" contenteditable="true" data-k="lossMedical" data-ph="0"></td></tr>
        <tr><th>財物損失</th><td class="edit loss" contenteditable="true" data-k="lossProperty" data-ph="0"></td><th>其他損失</th><td class="edit loss" contenteditable="true" data-k="lossOther" data-ph="0"></td></tr>
        <tr><th>總損失金額</th><td colspan="3"><b id="lossTotal">NT$ 0</b></td></tr>
      </table>
      <div class="sechead">6. 事故發生經過及現場概況敘述</div>
      <table><tr><td class="edit" contenteditable="true" data-k="description" data-ph="請描述事故發生經過…" style="min-height:72px;line-height:1.8"></td></tr></table>
      <div class="sechead">7. 建議改善事項（對策）</div>
      <table>
        <tr><td class="chkcell" style="line-height:2">${this.chk("improve",this.opts.improve)}</td></tr>
        <tr><td>說明：<span class="edit" contenteditable="true" data-k="improveNote" data-ph="具體改善措施…"></span></td></tr>
      </table>
      <table><tr><td id="hintRow" style="font-size:11.5px;line-height:1.7;color:#444">${this.hintHTML()}</td></tr></table>
      <div style="margin-top:16px;display:flex;justify-content:space-between;font-size:12px;color:#333">
        <span>總經理：________</span><span>勞安室：________</span><span>勞工代表：________</span><span>發生部門：________</span>
      </div>`;
    this.attachEditing();
    this.recalcLoss();
  },

  hintHTML(){
    const need8hr = this.data.degree==="死亡" || this.data.degree==="殘廢" || this.data.kind==="重大傷害";
    return (need8hr?'<b style="color:#c0392b">⚠ 本案恐屬職業安全衛生法第37條第2項應通報情形，雇主應於知悉後 8 小時內通報當地勞動檢查機構，且非經許可不得移動或破壞現場。</b><br>':'')+
      '本表單由事故發生單位主管填寫，勞安室存查追蹤；事故隱匿不報者懲戒一次；虛驚事故每單位每月須提報一次。';
  },

  attachEditing(){
    const node=document.getElementById("docPreview");
    // 文字格 → 即時寫入 data（PDF 直接擷取 DOM，這裡僅同步狀態）
    node.querySelectorAll(".edit[contenteditable]").forEach(el=>{
      el.addEventListener("input",()=>{ this.data[el.dataset.k]=el.innerText.trim(); if(el.classList.contains("loss")) this.recalcLoss(); });
    });
    // 勾選 → 點擊切換（同組單選，可再點取消）
    node.querySelectorAll(".chk").forEach(c=>c.addEventListener("click",()=>{
      const g=c.dataset.g, v=c.dataset.v;
      this.data[g]=(this.data[g]===v)?"":v;
      node.querySelectorAll(`.chk[data-g="${g}"]`).forEach(x=>{
        const on=this.data[g]===x.dataset.v;
        x.classList.toggle("on",on);
        x.textContent=`${on?"☑":"☐"} ${x.dataset.v}`;
      });
      if(g==="degree"||g==="kind"){ document.getElementById("hintRow").innerHTML=this.hintHTML(); }
    }));
  },

  recalcLoss(){
    const num=k=>{ const el=document.querySelector(`[data-k="${k}"]`); return parseInt((el?el.innerText:"").replace(/[^\d]/g,""))||0; };
    const total=num("lossManpower")+num("lossMedical")+num("lossProperty")+num("lossOther");
    const el=document.getElementById("lossTotal"); if(el) el.textContent="NT$ "+total.toLocaleString("en-US");
  },

  async downloadPDF(){
    const node=document.getElementById("docPreview");
    const unitEl=node.querySelector('[data-k="unit"]');
    const unit=(unitEl?unitEl.innerText.trim():"")||"報告單";
    App.toast(t("report.generating"));
    try{
      const canvas=await html2canvas(node,{scale:2, backgroundColor:"#ffffff", useCORS:true});
      const img=canvas.toDataURL("image/png");
      const { jsPDF }=window.jspdf;
      const pdf=new jsPDF("p","mm","a4");
      const pw=210, ph=297, margin=10, iw=pw-margin*2, ih=canvas.height*iw/canvas.width, pageH=ph-margin*2;
      if(ih<=pageH){ pdf.addImage(img,"PNG",margin,margin,iw,ih); }
      else { const pages=Math.ceil(ih/pageH); for(let p=0;p<pages;p++){ pdf.addImage(img,"PNG",margin,margin-p*pageH,iw,ih); if(p<pages-1) pdf.addPage(); } }
      pdf.save(`公司事故傷害報告單_${unit}_${new Date().toISOString().slice(0,10)}.pdf`);
      App.toast(t("report.done"),"good");
    }catch(e){ console.error(e); this.printFallback(); }
  },

  printFallback(){
    const html=document.getElementById("docPreview").outerHTML;
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>公司事故傷害報告單</title><style>
      body{font-family:"Noto Sans TC",sans-serif;padding:30px;color:#1a1a1a}
      .doc-preview h2{text-align:center}
      table{width:100%;border-collapse:collapse;margin-bottom:10px}
      th,td{border:1px solid #999;padding:7px;font-size:12.5px;text-align:left;vertical-align:top}
      th{background:#eef2f9}
      .sechead{background:#2b3a5e;color:#fff;padding:6px 10px;font-weight:700;margin:10px 0 0}
      .docsub{text-align:center;color:#666;font-size:12px;margin-bottom:16px}
    </style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(()=>{ w.print(); }, 500);
    App.toast(t("report.done"),"good");
  },
};
window.Report = Report;
