/* ============================================================
   report.js — 職業災害事故通報表自動生成 + PDF 下載
   表單 → 即時預覽 → html2canvas + jsPDF 一鍵輸出 PDF
   ============================================================ */
const Report = {
  ready:false,
  fields:[
    {k:"unit",   label:"事業單位名稱", ph:"例如：○○營造股份有限公司", req:true},
    {k:"reporter",label:"通報人 / 職稱", ph:"例如：王經理 / 工安主管"},
    {k:"phone",  label:"聯絡電話", ph:"例如：03-1234567"},
    {k:"addr",   label:"事故發生地點", ph:"例如：桃園市龜山區○○路○號工地"},
    {k:"datetime",label:"事故發生時間", ph:"", type:"datetime-local"},
    {k:"victim", label:"罹災者姓名", ph:"例如：陳○○"},
    {k:"vage",   label:"罹災者年齡 / 國籍", ph:"例如：42 / 本國（或越南籍移工）"},
    {k:"insured",label:"是否投保勞保 / 職災保險", type:"select", opts:["是","否","不確定"]},
    {k:"type",   label:"災害類型", type:"select", opts:["墜落、滾落","跌倒","物體飛落","被夾、被捲","感電","火災爆炸","切割、擦傷","交通事故","職業病","其他"]},
    {k:"severity",label:"傷害程度", type:"select", opts:["死亡","重傷住院","輕傷","虛驚事故"]},
    {k:"count",  label:"罹災人數", ph:"例如：1", type:"number"},
    {k:"desc",   label:"事故經過描述", ph:"請描述事故發生經過…", type:"textarea"},
  ],
  data:{},

  init(){
    document.getElementById("downloadPdf").addEventListener("click",()=>this.downloadPDF());
    document.getElementById("reportFromChat").addEventListener("click",()=>{
      if(window.Chat && Chat.lastContext.question){ this.importFromChat(Chat.lastContext); App.toast(t("report.imported"),"good"); }
      else App.toast(t("report.nochat"),"bad");
    });
  },
  onLang(){ /* 表單為中文官方格式，維持中文 */ },

  ensure(){
    if(this.ready){ this.renderPreview(); return; }
    this.renderForm();
    // 預設時間 = 現在
    if(!this.data.datetime){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); this.data.datetime=d.toISOString().slice(0,16); }
    this.renderForm(); this.renderPreview();
    this.ready=true;
  },

  renderForm(){
    const wrap=document.getElementById("reportForm");
    wrap.innerHTML=this.fields.map(f=>{
      const v=this.data[f.k]||"";
      let input;
      if(f.type==="textarea") input=`<textarea class="input" data-k="${f.k}" rows="3" placeholder="${f.ph||""}">${v}</textarea>`;
      else if(f.type==="select") input=`<select class="input" data-k="${f.k}">${f.opts.map(o=>`<option ${o===v?"selected":""}>${o}</option>`).join("")}</select>`;
      else input=`<input class="input" data-k="${f.k}" type="${f.type||"text"}" value="${v}" placeholder="${f.ph||""}">`;
      return `<div class="doc-field"><label class="field">${f.label}${f.req?' <span style="color:var(--bad)">*</span>':''}</label>${input}</div>`;
    }).join("");
    wrap.querySelectorAll("[data-k]").forEach(el=>{
      el.addEventListener("input",()=>{ this.data[el.dataset.k]=el.value; this.renderPreview(); });
      el.addEventListener("change",()=>{ this.data[el.dataset.k]=el.value; this.renderPreview(); });
    });
  },

  v(k,def="—"){ return this.data[k] ? String(this.data[k]).replace(/</g,"&lt;") : def; }
  ,
  fmtDT(s){ if(!s) return "—"; return s.replace("T"," "); },

  renderPreview(){
    const reportNo = "JS-"+(new Date().toISOString().slice(0,10).replace(/-/g,""))+"-"+String(Math.abs(this.hash(this.v("unit")))%9999).padStart(4,"0");
    const need8hr = this.data.severity==="死亡" || this.data.severity==="重傷住院" || (parseInt(this.data.count)>=3);
    document.getElementById("docPreview").innerHTML=`
      <h2>職業災害事故通報表</h2>
      <div class="docsub">Occupational Accident Incident Report ｜ 依職業安全衛生法第37條</div>
      <table>
        <tr><th>通報編號</th><td>${reportNo}</td></tr>
        <tr><th>事業單位名稱</th><td>${this.v("unit")}</td></tr>
        <tr><th>通報人 / 職稱</th><td>${this.v("reporter")}</td></tr>
        <tr><th>聯絡電話</th><td>${this.v("phone")}</td></tr>
      </table>
      <div class="sechead">一、事故基本資訊</div>
      <table>
        <tr><th>事故發生地點</th><td>${this.v("addr")}</td></tr>
        <tr><th>事故發生時間</th><td>${this.fmtDT(this.data.datetime)}</td></tr>
        <tr><th>災害類型</th><td>${this.v("type")}</td></tr>
        <tr><th>傷害程度</th><td>${this.v("severity")}</td></tr>
        <tr><th>罹災人數</th><td>${this.v("count","1")} 人</td></tr>
      </table>
      <div class="sechead">二、罹災者資訊</div>
      <table>
        <tr><th>罹災者姓名</th><td>${this.v("victim")}</td></tr>
        <tr><th>年齡 / 國籍</th><td>${this.v("vage")}</td></tr>
        <tr><th>投保勞保 / 職災保險</th><td>${this.v("insured")}</td></tr>
      </table>
      <div class="sechead">三、事故經過描述</div>
      <table><tr><td style="min-height:80px;line-height:1.7">${this.v("desc","（請描述事故發生經過）").replace(/\n/g,"<br>")}</td></tr></table>
      <div class="sechead">四、通報義務提醒</div>
      <table><tr><td style="font-size:11.5px;line-height:1.7;color:#444">
        ${need8hr?'<b style="color:#c0392b">⚠ 本案符合職業安全衛生法第37條第2項應通報情形，雇主應於知悉後 8 小時內通報當地勞動檢查機構，且非經許可不得移動或破壞現場。</b>':'本表供事業單位內部職災紀錄與後續勞保給付申請使用。'}
        <br>製表日期：${new Date().toLocaleDateString("zh-TW")}　｜　職盾 JobShield 自動生成
      </td></tr></table>
      <div style="margin-top:18px;display:flex;justify-content:space-between;font-size:12px;color:#555">
        <span>通報人簽章：_____________</span><span>雇主 / 負責人簽章：_____________</span>
      </div>`;
  },

  hash(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; } return h; },

  importFromChat(ctx){
    this.ensure();
    const q=ctx.question||"", a=ctx.answer||"";
    const text=q+" "+a;
    // 嘗試從對話抽取欄位
    const comp = q.match(/([一-龥A-Za-z0-9]{2,12}(?:公司|工程|營造|科技|實業|企業|半導體|電子))/);
    if(comp) this.data.unit=comp[1];
    const cityM=text.match(/(臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|苗栗|彰化|雲林|嘉義|屏東|宜蘭|花蓮|台東|南投|基隆)[一-龥]{0,3}(區|鄉|鎮|市)?[一-龥0-9]{0,8}(工廠|工地|廠)?/);
    if(cityM) this.data.addr=cityM[0];
    if(/墜樓|墜落|高處|摔/.test(text)) this.data.type="墜落、滾落";
    else if(/感電|觸電/.test(text)) this.data.type="感電";
    else if(/搬重|腰|職業病/.test(text)) this.data.type="職業病";
    else if(/爆炸|火災/.test(text)) this.data.type="火災爆炸";
    if(/死亡|身亡|往生/.test(text)) this.data.severity="死亡";
    else if(/住院|加護|重傷/.test(text)) this.data.severity="重傷住院";
    else this.data.severity=this.data.severity||"輕傷";
    if(/沒(保|有)勞保|未投保|沒幫.*保/.test(text)) this.data.insured="否";
    if(/移工|外籍|越南|印尼|泰國|菲律賓/.test(text)) this.data.vage=(this.data.vage||"")+ (/越南/.test(text)?"越南籍移工":/印尼/.test(text)?"印尼籍移工":"外籍移工");
    if(!this.data.desc) this.data.desc=q;
    if(!this.data.count) this.data.count="1";
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
      let y=margin, remaining=ih;
      if(ih<=ph-margin*2){
        pdf.addImage(img,"PNG",margin,margin,iw,ih);
      }else{
        // 分頁
        let position=0;
        const pageContentH=ph-margin*2;
        const totalPages=Math.ceil(ih/pageContentH);
        for(let p=0;p<totalPages;p++){
          pdf.addImage(img,"PNG",margin, margin - p*pageContentH, iw, ih);
          // 遮蓋溢出（白邊）
          if(p<totalPages-1) pdf.addPage();
        }
      }
      const fn=`職災事故通報表_${this.data.unit}_${new Date().toISOString().slice(0,10)}.pdf`;
      pdf.save(fn);
      App.toast(t("report.done"),"good");
    }catch(e){
      console.error(e);
      // 退回：開新視窗列印
      this.printFallback();
    }
  },

  printFallback(){
    const html=document.getElementById("docPreview").outerHTML;
    const w=window.open("","_blank");
    w.document.write(`<html><head><title>職災事故通報表</title><style>
      body{font-family:"Noto Sans TC",sans-serif;padding:30px;color:#1a1a1a}
      .doc-preview h2{text-align:center}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      th,td{border:1px solid #999;padding:8px;font-size:13px;text-align:left}
      th{background:#eef2f9;width:30%}
      .sechead{background:#2b3a5e;color:#fff;padding:6px 10px;font-weight:700;margin:10px 0 0}
      .docsub{text-align:center;color:#666;font-size:12px;margin-bottom:16px}
    </style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(()=>{ w.print(); }, 500);
    App.toast("已開啟列印視窗，可另存為 PDF","good");
  },
};
window.Report = Report;
