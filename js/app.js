/* ============================================================
   app.js — 主控制器：導航、Toast、首頁、語言、行動裝置
   ============================================================ */
const App = {
  view:"home",
  titleFor(view){
    const titles = {home:"職盾 JobShield",chat:t("nav.chat"),vendors:t("nav.vendors"),compare:t("nav.compare"),map:t("nav.map"),calc:t("nav.calc"),report:t("nav.report")};
    return titles[view]||"職盾 JobShield";
  },
  refreshTitle(){ document.getElementById("topTitle").textContent = this.titleFor(this.view); },
  go(view){
    this.view = view;
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active", v.id==="view-"+view));
    document.querySelectorAll("#nav .nav-item").forEach(n=>n.classList.toggle("active", n.dataset.view===view));
    document.querySelectorAll("#mobileNav button").forEach(n=>n.classList.toggle("active", n.dataset.view===view));
    this.refreshTitle();
    window.scrollTo(0,0);
    // lazy init
    if(view==="map" && window.MapView) MapView.ensure();
    if(view==="chat" && window.Chat) Chat.focusInput();
    if(view==="compare" && window.Vendors) Vendors.renderCompare();
    if(view==="report" && window.Report) Report.ensure();
    if(window.Vendors) Vendors.refreshTray();   // 比較列僅在供應商相關頁顯示
  },
  toast(msg,type="brand"){
    const el = document.createElement("div");
    el.className = "toast "+(type==="good"?"good":type==="bad"?"bad":"");
    const icon = type==="bad"
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>`;
    el.innerHTML = icon+`<span>${msg}</span>`;
    document.getElementById("toastWrap").appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateX(120%)"; el.style.transition=".3s"; setTimeout(()=>el.remove(),300); }, 2800);
  },
};
window.App = App;

const FEATURES = [
  {view:"chat",   key:"chat",   ic:`<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/>`},
  {view:"vendors",key:"vendor", ic:`<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/>`},
  {view:"compare",key:"compare",ic:`<path d="M3 3v18h18"/><rect x="7" y="10" width="3" height="7"/><rect x="13" y="6" width="3" height="11"/>`},
  {view:"map",    key:"map",    ic:`<path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`},
  {view:"calc",   key:"calc",   ic:`<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M8 14h2M8 18h6"/>`},
  {view:"report", key:"report", ic:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>`},
];
function renderFeatures(){
  document.getElementById("featureGrid").innerHTML = FEATURES.map(f=>`
    <div class="feature" data-goto="${f.view}">
      <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${f.ic}</svg></div>
      <h3 data-i18n="feat.${f.key}.t">${t("feat."+f.key+".t")}</h3>
      <p data-i18n="feat.${f.key}.d">${t("feat."+f.key+".d")}</p>
    </div>`).join("");
}

const MOBILE = [
  {view:"home",label:"nav.home",ic:`<path d="M3 12l9-9 9 9M5 10v10h14V10"/>`},
  {view:"chat",label:"nav.chat",ic:`<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/>`},
  {view:"vendors",label:"nav.vendors",ic:`<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/>`},
  {view:"map",label:"nav.map",ic:`<path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`},
  {view:"calc",label:"nav.calc",ic:`<rect x="4" y="2" width="16" height="20" rx="2"/>`},
];
function renderMobileNav(){
  document.getElementById("mobileNav").innerHTML = MOBILE.map(m=>`
    <button data-view="${m.view}" class="${m.view===App.view?'active':''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${m.ic}</svg>
      <span data-i18n="${m.label}">${t(m.label)}</span>
    </button>`).join("");
}

// ---------- init ----------
window.addEventListener("DOMContentLoaded", async ()=>{
  try{ if(window.mermaid) mermaid.initialize({startOnLoad:false, theme:"dark", themeVariables:{darkMode:true,background:"#0a1228",primaryColor:"#13203f",lineColor:"#3b82f6",primaryTextColor:"#eaf0ff"}}); }catch(e){}

  await loadDB();
  document.getElementById("dataDate").textContent = fmtDate(DB.updated.replace(/-/g,""));
  //document.getElementById("covCount").textContent = `${DB.companies.length} / ${DB.violations.length}`;

  renderFeatures(); renderMobileNav();

  // nav events (delegated)
  document.getElementById("nav").addEventListener("click", e=>{
    const item = e.target.closest(".nav-item"); if(item) App.go(item.dataset.view);
  });
  document.body.addEventListener("click", e=>{
    const g = e.target.closest("[data-goto]"); if(g) App.go(g.dataset.goto);
  });
  document.getElementById("mobileNav").addEventListener("click", e=>{
    const b = e.target.closest("button"); if(b) App.go(b.dataset.view);
  });

  // lang
  document.getElementById("langSwitch").addEventListener("click", e=>{
    const b = e.target.closest("button"); if(b) setLang(b.dataset.lang);
  });
  window.addEventListener("langchange", ()=>{ renderFeatures(); renderMobileNav(); applyI18n(); App.refreshTitle();
    if(window.Chat) Chat.onLang(); if(window.Vendors) Vendors.onLang(); if(window.Calc) Calc.onLang();
    if(window.MapView) MapView.onLang(); if(window.Report) Report.onLang();
  });

  // init modules
  Chat.init(); Vendors.init(); MapView.init(); Calc.init(); Report.init();
  setLang(currentLang);
  applyI18n();
});
