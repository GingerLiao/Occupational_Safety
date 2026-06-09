/* ============================================================
   calculator.js — 職災傷病給付理賠試算
   依勞工職業災害保險及保護法：
   - 日投保薪資 = 平均月投保薪資 ÷ 30
   - 等待期：前 3 日不給付
   - 第 4–60 日(100%)：max(0, min(天數,60) − 3)
   - 第 61 日起(70%)：max(0, min(天數,730) − 60)
   - 總額 = 100段日數×日薪×1.0 + 70段日數×日薪×0.7
   - 四捨五入，千分位顯示；最長 2 年(730 日)
   ============================================================ */
const Calc = {
  init(){
    document.getElementById("calcBtn").addEventListener("click",()=>this.run());
    ["calcSalary","calcDays"].forEach(id=>document.getElementById(id).addEventListener("keydown",e=>{ if(e.key==="Enter") this.run(); }));
  },
  onLang(){ const r=document.getElementById("calcResult"); if(r.dataset.has) this.run(); },

  compute(salary, days){
    const daily = salary/30;
    const days100 = Math.max(0, Math.min(days,60)-3);
    const days70  = Math.max(0, Math.min(days,730)-60);
    const amt100  = days100*daily*1.0;
    const amt70   = days70*daily*0.7;
    const total   = Math.round(amt100+amt70);
    return { daily, days100, days70, amt100:Math.round(amt100), amt70:Math.round(amt70), total };
  },

  nt(n){ return "NT$ "+Math.round(n).toLocaleString("en-US"); },

  run(){
    const salary=parseFloat(document.getElementById("calcSalary").value);
    const days=parseInt(document.getElementById("calcDays").value);
    if(!salary || salary<=0 || !days || days<=0){ App.toast("請輸入有效的投保薪資與天數","bad"); return; }
    const c=this.compute(salary,days);
    const cappedNote = days>730? `<div style="font-size:12px;color:var(--warn);margin-top:6px">※ 輸入 ${days} 日已超過上限，依法以 730 日計算。</div>`:"";
    const el=document.getElementById("calcResult");
    el.dataset.has="1";
    el.innerHTML=`<div class="card card-pad calc-result">
      <div style="font-size:13px;color:var(--text-dim);margin-bottom:6px">${t("calc.result")}</div>
      <div class="result-total">${this.nt(c.total)}</div>
      <div class="breakdown">
        <div class="bd-row"><span class="lbl">${t("calc.daily")}</span><span class="amt">${this.nt(c.daily)}</span></div>
        <div class="bd-row"><span class="lbl">${t("calc.wait")}</span><span class="amt" style="color:var(--text-mute)">— 3 ${t("calc.days_unit")}</span></div>
        <div class="bd-row"><span class="lbl">${t("calc.p100")} · ${c.days100} ${t("calc.days_unit")}</span><span class="amt" style="color:var(--good)">${this.nt(c.amt100)}</span></div>
        <div class="bd-row"><span class="lbl">${t("calc.p70")} · ${c.days70} ${t("calc.days_unit")}</span><span class="amt" style="color:var(--brand-2)">${this.nt(c.amt70)}</span></div>
        <div class="bd-row total"><span class="lbl"><b>${t("calc.total")}</b></span><span class="amt"><b style="color:var(--good)">${this.nt(c.total)}</b></span></div>
      </div>
      ${cappedNote}
      <div style="margin-top:16px;font-size:12px;color:var(--text-mute);line-height:1.6">${t("calc.note")}</div>
      <div class="sources" style="margin-top:12px">
        <div class="sh">📚 ${t("chat.sources")}</div>
        <div class="src-item"><span class="tagn">法規</span><span>勞工職業災害保險及保護法 第42條（傷病給付）</span></div>
      </div>
    </div>`;
  },
};
window.Calc = Calc;
