/* ============================================================
   voice.js — 語音輸入 (Web Speech API)，支援多語言
   ============================================================ */
const Voice = {
  rec:null, active:false,
  langMap:{zh:"zh-TW",en:"en-US",id:"id-ID",vi:"vi-VN",th:"th-TH"},
  supported(){ return "webkitSpeechRecognition" in window || "SpeechRecognition" in window; },
  toggle(targetEl, btn){
    if(!this.supported()){ App.toast("此瀏覽器不支援語音輸入，請改用 Chrome","bad"); return; }
    if(this.active){ this.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new SR();
    this.rec.lang = this.langMap[window.currentLang] || "zh-TW";
    this.rec.interimResults = true;
    this.rec.continuous = false;
    const base = targetEl.value;
    this.rec.onresult = (e)=>{
      let txt="";
      for(let i=e.resultIndex;i<e.results.length;i++) txt += e.results[i][0].transcript;
      targetEl.value = (base? base+" ":"") + txt;
      targetEl.dispatchEvent(new Event("input"));
    };
    this.rec.onerror = (e)=>{ App.toast("語音辨識錯誤："+(e.error||""),"bad"); this.stop(); };
    this.rec.onend = ()=>{ this.active=false; btn && btn.classList.remove("rec"); };
    try{ this.rec.start(); this.active=true; btn && btn.classList.add("rec"); App.toast("🎤 請開始說話…"); }
    catch(err){ App.toast("無法啟動語音輸入","bad"); }
  },
  stop(){ try{ this.rec && this.rec.stop(); }catch(e){} this.active=false;
    document.querySelectorAll(".icon-btn.rec").forEach(b=>b.classList.remove("rec")); },
};
window.Voice = Voice;
