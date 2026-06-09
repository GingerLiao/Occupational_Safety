/* ============================================================
   vendors.js — 廠商風險評估 + 多廠商並排比較
   ============================================================ */
const Vendors = {
  compareList: JSON.parse(localStorage.getItem("js_compare")||"[]"),

  init(){
    document.getElementById("vendorBtn").addEventListener("click",()=>this.assess());
    document.getElementById("vendorInput").addEventListener("keydown",e=>{ if(e.key==="Enter") this.assess(); });
    document.getElementById("ctClear").addEventListener("click",()=>this.clearCompare());
    this.renderSuggest();
    this.refreshTray();
  },
  onLang(){ this.renderSuggest(); if(document.getElementById("view-compare").classList.contains("active")) this.renderCompare(); },

  renderSuggest(){
    const picks=["穩懋半導體","台達電子","欣興電子","聯華電子","群創光電","奇美實業"];
    document.getElementById("vendorSuggest").innerHTML =
      `<span style="font-size:12px;color:var(--text-mute);align-self:center">範例：</span>`+
      picks.map(p=>`<button class="chip" data-v="${p}">${p}</button>`).join("");
    document.querySelectorAll("#vendorSuggest .chip").forEach(c=>c.addEventListener("click",()=>{
      document.getElementById("vendorInput").value=c.dataset.v; this.assess();
    }));
  },

  assess(){
    const q=document.getElementById("vendorInput").value.trim();
    if(!q){ App.toast("請輸入廠商名稱","bad"); return; }
    const r=assessVendor(q);
    document.getElementById("vendorResult").innerHTML=this.cardHTML(r);
    const btn=document.querySelector("#vendorResult .track-btn");
    if(btn) btn.addEventListener("click",()=>this.addToCompare(r.query));
  },

  ringColor(level){ return level==="low"?"#34d399":level==="mid"?"#fbbf24":"#f87171"; },
  riskClass(level){ return level==="low"?"risk-low":level==="mid"?"risk-mid":"risk-high"; },
  riskLabel(level){ return level==="low"?t("vendor.score").includes("分")?"低風險":"Low":level; },

  cardHTML(r){
    const col=this.ringColor(r.levelKey);
    const tracked=this.compareList.includes(r.query);
    const lvText = r.level;
    let viols="";
    if(r.vCount>0){
      viols=`<div style="margin-top:16px"><div style="font-size:13px;font-weight:700;color:var(--bad);margin-bottom:8px">⚠️ ${t("vendor.violations")}（${r.vCount}）</div>`+
        r.violations.slice(0,5).map(v=>`<div style="font-size:12.5px;padding:8px 0;border-bottom:1px solid var(--line-soft)"><b style="color:var(--text-dim)">${fmtDate(v.punishDate)}</b> ${v.law}<br><span style="color:var(--text-mute)">${v.content.slice(0,80)}${v.content.length>80?"…":""}</span></div>`).join("")+`</div>`;
    }
    return `<div class="card card-pad vendor-card">
      <div class="vc-head">
        <div>
          <h3>${r.query}</h3>
          ${r.passedHit?`<div class="addr">📍 ${r.passed.address}</div>`:`<div class="addr" style="color:var(--warn)">未在政府審查名單中</div>`}
        </div>
        <span class="risk-badge ${this.riskClass(r.levelKey)}">${r.levelKey==="low"?"🟢":r.levelKey==="mid"?"🟡":"🔴"} ${lvText}</span>
      </div>
      <div class="score-ring">
        <div class="ring" style="background:conic-gradient(${col} ${r.score*3.6}deg, #0c1530 0deg)">
          <div style="position:absolute;inset:6px;background:var(--surface);border-radius:50%"></div>
          <div class="rv" style="position:relative;color:${col}">${r.score}</div>
        </div>
        <div style="flex:1">
          <div class="kv"><span class="k">${t("vendor.status")}</span><span class="v">${r.passedHit?`<span style="color:var(--good)">✅ ${t("vendor.passed")}</span>`:`<span style="color:var(--warn)">${t("vendor.notfound")}</span>`}</span></div>
          <div class="kv"><span class="k">${t("vendor.violations")}</span><span class="v" style="color:${r.vCount?'var(--bad)':'var(--good)'}">${r.vCount} 筆</span></div>
          ${r.passedHit?`<div class="kv"><span class="k">審查有效期</span><span class="v">${fmtDate(r.passed.passDate)} ~ ${fmtDate(r.passed.expireDate)}</span></div>`:""}
        </div>
      </div>
      <div class="info-card" style="margin-top:4px"><b>🛡️ ${t("vendor.recommend")}：</b>${r.recommend}</div>
      ${viols}
      <div class="sources" style="margin-top:6px">
        <div class="sh">📚 ${t("chat.sources")} · ${t("chat.updated")} ${fmtDate(r.updated.replace(/-/g,""))}</div>
        <div class="src-item"><span class="tagn">資料庫</span><span>通過職業安全衛生管理系統績效審查事業單位清單（政府公開資料平台）</span></div>
        <div class="src-item"><span class="tagn">資料庫</span><span>事業單位違反職業安全衛生法令資料（勞動部）</span></div>
      </div>
      <button class="btn ${tracked?'':'btn-primary'} track-btn" style="margin-top:8px" ${tracked?'disabled':''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="13" y="6" width="3" height="11"/></svg>
        ${tracked? t("vendor.tracked") : t("vendor.track")}
      </button>
    </div>`;
  },

  addToCompare(name){
    if(!name) return;
    if(this.compareList.includes(name)){ App.toast(t("vendor.tracked"),"good"); return; }
    if(this.compareList.length>=5){ App.toast("最多比較 5 家","bad"); return; }
    this.compareList.push(name);
    localStorage.setItem("js_compare",JSON.stringify(this.compareList));
    this.refreshTray();
    if(document.getElementById("view-vendors").classList.contains("active")) this.assess();
    App.toast(`已加入比較：${name}`,"good");
  },
  removeFromCompare(name){
    this.compareList=this.compareList.filter(x=>x!==name);
    localStorage.setItem("js_compare",JSON.stringify(this.compareList));
    this.refreshTray(); this.renderCompare();
  },
  clearCompare(){ this.compareList=[]; localStorage.setItem("js_compare","[]"); this.refreshTray(); this.renderCompare(); },

  refreshTray(){
    const tray=document.getElementById("compareTray");
    const cnt=document.getElementById("cmpCount");
    tray.classList.toggle("show", this.compareList.length>0);
    if(this.compareList.length){ cnt.style.display="inline-flex"; cnt.textContent=this.compareList.length; }
    else cnt.style.display="none";
    document.getElementById("ctItems").innerHTML=this.compareList.map(n=>
      `<span class="ct-pill">${n}<span class="x" data-x="${n}">×</span></span>`).join("");
    document.querySelectorAll("#ctItems .x").forEach(x=>x.addEventListener("click",()=>this.removeFromCompare(x.dataset.x)));
  },

  renderCompare(){
    const area=document.getElementById("compareArea");
    if(!this.compareList.length){
      area.innerHTML=`<div class="card card-pad empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="13" y="6" width="3" height="11"/></svg>
        <p>${t("compare.empty")}</p>
        <button class="btn btn-primary btn-sm" data-goto="vendors" style="margin-top:14px">${t("nav.vendors")}</button></div>`;
      return;
    }
    const rs=this.compareList.map(n=>assessVendor(n)).filter(Boolean);
    // sort best first
    rs.sort((a,b)=>b.score-a.score);
    const best=rs[0];
    const metricRow=(label,fn)=>`<tr><td class="metric">${label}</td>${rs.map(fn).join("")}</tr>`;
    let html=`<div class="card" style="overflow-x:auto"><table class="cmp-table"><thead><tr><th>${t("compare.title")}</th>`+
      rs.map(r=>`<th>${r.query}${r===best?' <span class="chip good btn-sm" style="padding:1px 7px">★ 最佳</span>':''}</th>`).join("")+`</tr></thead><tbody>`;
    html+=metricRow(t("vendor.score"), r=>{
      const col=this.ringColor(r.levelKey);
      return `<td><div style="font-size:22px;font-weight:800;color:${col}">${r.score}</div><div class="bar-mini"><i style="width:${r.score}%;background:${col}"></i></div></td>`;
    });
    const gradeLabel = window.currentLang==="zh"?"風險評級":window.currentLang==="en"?"Risk grade":t("vendor.score");
    html+=metricRow(gradeLabel, r=>`<td><span class="risk-badge ${this.riskClass(r.levelKey)}">${r.level}</span></td>`);
    html+=metricRow(t("vendor.status"), r=>`<td>${r.passedHit?`<span style="color:var(--good)">✅ ${t("vendor.passed")}</span>`:`<span style="color:var(--warn)">${t("vendor.notfound")}</span>`}</td>`);
    html+=metricRow(t("vendor.violations"), r=>`<td><b style="color:${r.vCount?'var(--bad)':'var(--good)'}">${r.vCount}</b> 筆${r.severe?`<br><small style="color:var(--bad)">含 ${r.severe} 重大</small>`:""}</td>`);
    html+=metricRow("審查有效期", r=>`<td style="font-size:12px">${r.passedHit?`${fmtDate(r.passed.passDate)}<br>~ ${fmtDate(r.passed.expireDate)}`:"—"}</td>`);
    html+=metricRow(t("vendor.recommend"), r=>`<td style="font-size:12px;color:var(--text-dim);min-width:200px">${r.recommend}</td>`);
    html+=`</tbody></table></div>`;
    html+=`<div class="info-card" style="margin-top:16px"><b>📊 比較結論：</b>在 ${rs.length} 家候選廠商中，<b style="color:var(--good)">${best.query}</b> 職安評分最高（${best.score} 分，${best.level}），建議優先發包。</div>`;
    html+=`<div style="margin-top:14px"><button class="btn btn-sm" id="cmpClearBtn">${t("compare.clear")}</button></div>`;
    area.innerHTML=html;
    document.getElementById("cmpClearBtn").addEventListener("click",()=>this.clearCompare());
  },
};
window.Vendors = Vendors;
