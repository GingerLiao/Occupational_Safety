/* ============================================================
   report.js — 公司事故傷害報告單（依勞動部職業安全衛生署參考格式）
   表單 → 即時預覽 → html2canvas + jsPDF 一鍵輸出 PDF
   由 AI 對話自動帶入欄位 (importFromChat) 保留
   ============================================================ */
const Report = {
  ready:false,
  // 表單欄位（左側輸入）；選項對應職安署「公司事故傷害報告單」勾選欄
  opts:{
    kind:["重大傷害","輕傷害","財產損失","虛驚事故","其他"],
    target:["本國員工","外勞","承攬商"],
    degree:["死亡","殘廢","造成機器設備毀損","需申請醫療給付傷害","輕傷害","虛驚事故","交通意外","其他"],
    act:["（無）","人員注意力不集中","未使用防護具","未依照標準作業程序","誤動作","其他"],
    cond:["（無）","設備異常啟動","設備安全裝置被破壞","設備安全防護不足","安全標示不足","其他"],
    basic:["（無）","未施予教育訓練","未訂定標準作業程序","其他"],
    improve:["設備改善","作業程序改善","教育訓練","其他"],
  },
  fields(){ return [
    {k:"unit",     label:"事故單位", ph:"例如：○○營造股份有限公司", req:true},
    {k:"datetime", label:"發生時間", type:"datetime-local"},
    {k:"kind",     label:"事故種類", type:"select", o:this.opts.kind},
    {k:"target",   label:"事故發生對象", type:"select", o:this.opts.target},
    {k:"contractor",label:"承攬商名稱 / 從事作業（對象為承攬商時）", ph:"例如：○○工程行 從事外牆拆除作業"},
    {k:"dept",     label:"所屬部門", ph:"例如：工務部"},
    {k:"victim",   label:"姓名", ph:"例如：陳○○"},
    {k:"phone",    label:"電話", ph:"例如：03-1234567"},
    {k:"workNature",label:"作業性質", ph:"例如：高架施工架組裝"},
    {k:"location", label:"事故發生地點", ph:"例如：桃園市龜山區○○路工地 3F"},
    {k:"degree",   label:"事故程度", type:"select", o:this.opts.degree},
    {k:"act",      label:"不安全行為", type:"select", o:this.opts.act},
    {k:"cond",     label:"不安全狀況", type:"select", o:this.opts.cond},
    {k:"basic",    label:"基本原因", type:"select", o:this.opts.basic},
    {k:"lossManpower",label:"人力損失（元）", type:"number", ph:"0"},
    {k:"lossMedical", label:"醫療費用（元）", type:"number", ph:"0"},
    {k:"lossProperty",label:"財物損失（元）", type:"number", ph:"0"},
    {k:"lossOther",   label:"其他損失（元）", type:"number", ph:"0"},
    {k:"description", label:"事故發生經過及現場概況敘述", type:"textarea", ph:"請描述事故發生經過…"},
    {k:"improve",  label:"建議改善事項（對策）", type:"select", o:this.opts.improve},
    {k:"improveNote",label:"改善說明", type:"textarea", ph:"具體改善措施說明…"},
  ];},
  data:{},

  init(){
    document.getElementById("downloadPdf").addEventListener("click",()=>this.downloadPDF());
    document.getElementById("reportFromChat").addEventListener("click",()=>{
      if(window.Chat && Chat.lastContext.question){ this.importFromChat(Chat.lastContext); App.toast(t("report.imported"),"good"); }
      else App.toast(t("report.nochat"),"bad");
    });
  },
  onLang(){ /* 表單為勞動部官方格式，維持中文 */ },

  ensure(){
    if(this.ready){ this.renderPreview(); return; }
    if(!this.data.datetime){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); this.data.datetime=d.toISOString().slice(0,16); }
    this.renderForm(); this.renderPreview();
    this.ready=true;
  },

  renderForm(){
    const wrap=document.getElementById("reportForm");
    wrap.innerHTML=this.fields().map(f=>{
      const val=this.data[f.k]||"";
      let input;
      if(f.type==="textarea") input=`<textarea class="input" data-k="${f.k}" rows="3" placeholder="${f.ph||""}">${val}</textarea>`;
      else if(f.type==="select") input=`<select class="input" data-k="${f.k}">${f.o.map(o=>`<option ${o===val?"selected":""}>${o}</option>`).join("")}</select>`;
      else input=`<input class="input" data-k="${f.k}" type="${f.type||"text"}" value="${val}" placeholder="${f.ph||""}">`;
      return `<div class="doc-field"><label class="field">${f.label}${f.req?' <span style="color:var(--bad)">*</span>':''}</label>${input}</div>`;
    }).join("");
    wrap.querySelectorAll("[data-k]").forEach(el=>{
      el.addEventListener("input",()=>{ this.data[el.dataset.k]=el.value; this.renderPreview(); });
      el.addEventListener("change",()=>{ this.data[el.dataset.k]=el.value; this.renderPreview(); });
    });
  },

  v(k,def="—"){ return this.data[k] ? String(this.data[k]).replace(/</g,"&lt;") : def; },
  fmtDT(s){ if(!s) return "　　年　月　日　　時　分"; const [d,tm]=s.split("T"); const [y,mo,da]=d.split("-"); return `${y} 年 ${mo} 月 ${da} 日　${tm} 時`; },
  num(n){ const v=parseInt(n)||0; return v.toLocaleString("en-US"); },
  // 勾選列：☑ 選中 / ☐ 其餘
  chk(opts, val){ return opts.map(o=>`<span style="white-space:nowrap">${val===o?"☑":"☐"} ${o}</span>`).join("　"); },

  renderPreview(){
    const d=this.data;
    const reportNo="JS-"+(new Date().toISOString().slice(0,10).replace(/-/g,""))+"-"+String(Math.abs(this.hash(this.v("unit")))%9999).padStart(4,"0");
    const lossTotal=(parseInt(d.lossManpower)||0)+(parseInt(d.lossMedical)||0)+(parseInt(d.lossProperty)||0)+(parseInt(d.lossOther)||0);
    const need8hr = d.degree==="死亡" || d.degree==="殘廢" || d.kind==="重大傷害";
    // 承攬商欄
    const targetLine = `${this.chk(this.opts.target, d.target)}` +
      (d.target==="承攬商" && d.contractor ? `<div style="margin-top:4px;color:#444">（${this.v("contractor")}）</div>`:"");

    document.getElementById("docPreview").innerHTML=`
      <h2>公司事故傷害報告單</h2>
      <table>
        <tr><th>事故單位</th><td>${this.v("unit")}</td><th style="width:18%">填表日期</th><td style="width:22%">${new Date().toLocaleDateString("zh-TW")}</td></tr>
        <tr><th>通報編號</th><td>${reportNo}</td><th>所屬部門</th><td>${this.v("dept")}</td></tr>
      </table>
      <table>
        <tr><th style="width:18%">事故種類</th><td colspan="3" style="line-height:2">${this.chk(this.opts.kind, d.kind)}</td></tr>
      </table>
      <div class="sechead">1. 發生時間</div>
      <table><tr><td>${this.fmtDT(d.datetime)}</td></tr></table>
      <div class="sechead">2. 事故發生對象</div>
      <table>
        <tr><td colspan="4" style="line-height:2">${targetLine}</td></tr>
        <tr><th style="width:18%">姓名</th><td>${this.v("victim")}</td><th style="width:18%">電話</th><td>${this.v("phone")}</td></tr>
        <tr><th>作業性質</th><td colspan="3">${this.v("workNature")}</td></tr>
      </table>
      <div class="sechead">3. 事故發生地點</div>
      <table><tr><td>${this.v("location")}</td></tr></table>
      <div class="sechead">4. 事故程度（可複選）</div>
      <table><tr><td style="line-height:2.1">${this.chk(this.opts.degree, d.degree)}</td></tr></table>
      <div class="sechead">5. 事故發生原因</div>
      <table>
        <tr><th style="width:18%">不安全行為</th><td style="line-height:2">${this.chk(this.opts.act, d.act)}</td></tr>
        <tr><th>不安全狀況</th><td style="line-height:2">${this.chk(this.opts.cond, d.cond)}</td></tr>
        <tr><th>基本原因</th><td style="line-height:2">${this.chk(this.opts.basic, d.basic)}</td></tr>
      </table>
      <table>
        <tr><th colspan="4" style="background:#dde6f4">事故損失調查（元）</th></tr>
        <tr><th style="width:25%">人力損失</th><td>${this.num(d.lossManpower)}</td><th style="width:25%">醫療費用</th><td>${this.num(d.lossMedical)}</td></tr>
        <tr><th>財物損失</th><td>${this.num(d.lossProperty)}</td><th>其他損失</th><td>${this.num(d.lossOther)}</td></tr>
        <tr><th>總損失金額</th><td colspan="3"><b>NT$ ${lossTotal.toLocaleString("en-US")}</b></td></tr>
      </table>
      <div class="sechead">6. 事故發生經過及現場概況敘述</div>
      <table><tr><td style="min-height:70px;line-height:1.7">${this.v("description","（請描述事故發生經過）").replace(/\n/g,"<br>")}</td></tr></table>
      <div class="sechead">7. 建議改善事項（對策）</div>
      <table>
        <tr><td style="line-height:2">${this.chk(this.opts.improve, d.improve)}</td></tr>
        <tr><td>說明：${this.v("improveNote","")}</td></tr>
      </table>
      <table><tr><td style="font-size:11.5px;line-height:1.7;color:#444">
        ${need8hr?'<b style="color:#c0392b">⚠ 本案恐屬職業安全衛生法第37條第2項應通報情形，雇主應於知悉後 8 小時內通報當地勞動檢查機構，且非經許可不得移動或破壞現場。</b><br>':''}
        本表單由事故發生單位主管填寫，勞安室存查追蹤；事故隱匿不報者懲戒一次；虛驚事故每單位每月須提報一次。
      </td></tr></table>
      <div style="margin-top:16px;display:flex;justify-content:space-between;font-size:12px;color:#333">
        <span>總經理：________</span><span>勞安室：________</span><span>勞工代表：________</span><span>發生部門：________</span>
      </div>`;
  },

  hash(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; } return h; },

  importFromChat(ctx){
    this.ensure();
    const q=ctx.question||"", a=ctx.answer||"";
    const text=q+" "+a;
    const comp = q.match(/([一-龥A-Za-z0-9]{2,12}(?:公司|工程|營造|科技|實業|企業|半導體|電子))/);
    if(comp) this.data.unit=comp[1];
    const cityM=text.match(/(臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|苗栗|彰化|雲林|嘉義|屏東|宜蘭|花蓮|台東|南投|基隆)[一-龥]{0,3}(區|鄉|鎮|市)?[一-龥0-9]{0,8}(工廠|工地|廠)?/);
    if(cityM) this.data.location=cityM[0];
    // 事故發生對象
    if(/移工|外籍|越南|印尼|泰國|菲律賓|外勞/.test(text)) this.data.target="外勞";
    else if(/承攬|包商|下游廠|供應商/.test(text)) this.data.target="承攬商";
    else this.data.target="本國員工";
    if(this.data.target==="承攬商"){ const cc=text.match(/承攬商?[：:]?\s*([一-龥A-Za-z0-9]{2,12}(?:公司|工程|行|企業))/); if(cc) this.data.contractor=cc[1]; }
    // 事故程度與種類
    if(/死亡|身亡|往生|墜樓.*亡/.test(text)){ this.data.degree="死亡"; this.data.kind="重大傷害"; }
    else if(/住院|加護|重傷|殘廢|截肢/.test(text)){ this.data.degree="需申請醫療給付傷害"; this.data.kind="重大傷害"; }
    else if(/交通|車禍/.test(text)){ this.data.degree="交通意外"; this.data.kind=this.data.kind||"輕傷害"; }
    else { this.data.degree=this.data.degree||"輕傷害"; this.data.kind=this.data.kind||"輕傷害"; }
    // 事故發生原因（依關鍵字推測）
    if(/墜落|墜樓|高處|摔|護欄|安全帶|安全網/.test(text)){ this.data.cond="設備安全防護不足"; this.data.act="未使用防護具"; }
    else if(/感電|觸電|漏電/.test(text)){ this.data.cond="設備安全裝置被破壞"; }
    else if(/捲|夾|機械|護罩/.test(text)){ this.data.cond="設備異常啟動"; this.data.act="未依照標準作業程序"; }
    else if(/搬重|姿勢|腰|職業病/.test(text)){ this.data.act="未依照標準作業程序"; }
    if(/未.*教育訓練|未訓練/.test(text)) this.data.basic="未施予教育訓練";
    // 敘述
    if(!this.data.description) this.data.description=q;
    this.renderForm(); this.renderPreview();
  },

  async downloadPDF(){
    if(!this.data.unit){ App.toast(t("report.need_unit"),"bad"); return; }
    const node=document.getElementById("docPreview");
    App.toast(t("report.generating"));
    try{
      const canvas=await html2canvas(node,{scale:2, backgroundColor:"#ffffff", useCORS:true});
      const img=canvas.toDataURL("image/png");
      const { jsPDF }=window.jspdf;
      const pdf=new jsPDF("p","mm","a4");
      const pw=210, ph=297, margin=10;
      const iw=pw-margin*2;
      const ih=canvas.height*iw/canvas.width;
      const pageContentH=ph-margin*2;
      if(ih<=pageContentH){
        pdf.addImage(img,"PNG",margin,margin,iw,ih);
      }else{
        const totalPages=Math.ceil(ih/pageContentH);
        for(let p=0;p<totalPages;p++){
          pdf.addImage(img,"PNG",margin, margin - p*pageContentH, iw, ih);
          if(p<totalPages-1) pdf.addPage();
        }
      }
      pdf.save(`公司事故傷害報告單_${this.data.unit}_${new Date().toISOString().slice(0,10)}.pdf`);
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
