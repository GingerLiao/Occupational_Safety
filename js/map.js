/* ============================================================
   map.js — 專責醫院互動地圖 (Leaflet)
   定位最近醫院、導航、聯絡分機、一鍵撥號
   ============================================================ */
const MapView = {
  map:null, markers:[], userMarker:null, ready:false, userPos:null, sorted:[],

  init(){
    document.getElementById("locateBtn").addEventListener("click",()=>this.locate());
    document.getElementById("citySelect").addEventListener("change",e=>this.filterCity(e.target.value));
  },
  onLang(){ if(this.ready){ this.buildCitySelect(); this.renderList(this.sorted); } },

  ensure(){
    if(this.ready){ setTimeout(()=>this.map.invalidateSize(),100); return; }
    this.map = L.map("map",{zoomControl:true}).setView([23.7,120.9],7);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{
      attribution:'© OpenStreetMap © CARTO', maxZoom:19,
    }).addTo(this.map);
    this.buildCitySelect();
    this.sorted = DB.hospitals.slice();
    this.addMarkers(DB.hospitals);
    this.renderList(this.sorted);
    this.ready=true;
    setTimeout(()=>this.map.invalidateSize(),200);
  },

  buildCitySelect(){
    const cities=[...new Set(DB.hospitals.map(h=>h.city))];
    const sel=document.getElementById("citySelect");
    sel.innerHTML=`<option value="">全部縣市 (${DB.hospitals.length})</option>`+cities.map(c=>`<option value="${c}">${c}</option>`).join("");
  },

  hIcon(active){
    return L.divIcon({className:"",html:`<div style="width:${active?34:26}px;height:${active?34:26}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${active?'#22d3ee':'#3b82f6'};border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.5);display:grid;place-items:center"><span style="transform:rotate(45deg);font-size:13px">🏥</span></div>`,iconSize:[26,26],iconAnchor:[13,26]});
  },

  addMarkers(list){
    this.markers.forEach(m=>this.map.removeLayer(m)); this.markers=[];
    list.forEach((h)=>{
      if(!h.lat) return;
      const m=L.marker([h.lat,h.lng],{icon:this.hIcon(false)}).addTo(this.map);
      m.bindPopup(this.popupHTML(h));
      m._hosp=h;
      this.markers.push(m);
    });
  },
  popupHTML(h){
    const nav=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(h.address)}`;
    return `<b>${h.name}</b><br><span style="color:#9fb0d4;font-size:12px">${h.address}</span>
      <div style="font-size:12px;margin-top:6px;color:#9fb0d4">☎ ${h.phone}</div>
      <div class="pp-act">
        <a class="btn btn-sm btn-primary" href="${nav}" target="_blank">${t("map.nav")}</a>
        ${h.dial?`<a class="btn btn-sm" href="tel:${h.dial}${h.ext?","+h.ext:""}">${t("map.call")}</a>`:""}
        <a class="btn btn-sm" href="${h.url}" target="_blank">${t("map.web")}</a>
      </div>`;
  },

  renderList(list){
    const el=document.getElementById("hospList");
    el.innerHTML=list.map((h,i)=>{
      const nav=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(h.address)}`;
      return `<div class="hosp-item" data-i="${i}">
        <h4>${h.name}</h4>
        <div class="meta">
          <span>📍 ${h.city}${h.district} · ${h.address}</span>
          <span>${t("map.contact")}：${h.contact} · ☎ ${h.phone}</span>
          ${h.dist!=null && h.dist<9999?`<span class="dist">📏 ${t("map.nearest")} ${h.dist.toFixed(1)} ${t("map.km")}</span>`:""}
        </div>
        <div class="acts">
          <a class="btn btn-sm btn-primary" href="${nav}" target="_blank" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>${t("map.nav")}</a>
          ${h.dial?`<a class="btn btn-sm" href="tel:${h.dial}${h.ext?","+h.ext:""}" onclick="event.stopPropagation()">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${t("map.call")}${h.ext?" "+t("map.ext")+h.ext:""}</a>`:""}
        </div>
      </div>`;
    }).join("");
    el.querySelectorAll(".hosp-item").forEach(it=>it.addEventListener("click",()=>this.focusHospital(list[+it.dataset.i], it)));
  },

  focusHospital(h, el){
    if(!h.lat) return;
    document.querySelectorAll(".hosp-item").forEach(x=>x.classList.remove("active"));
    el && el.classList.add("active");
    this.map.flyTo([h.lat,h.lng],13,{duration:.8});
    const m=this.markers.find(mk=>mk._hosp===h);
    if(m) setTimeout(()=>m.openPopup(),400);
  },

  filterCity(city){
    const list = city? DB.hospitals.filter(h=>h.city===city) : (this.userPos? this.sorted : DB.hospitals.slice());
    this.sorted = city? list : this.sorted;
    this.addMarkers(list);
    this.renderList(list.map(h=>({...h, dist:h.dist})));
    if(list.length && list[0].lat){
      if(city) this.map.flyTo([list[0].lat,list[0].lng],10,{duration:.6});
    }
  },

  locate(){
    if(!navigator.geolocation){ App.toast("瀏覽器不支援定位","bad"); return; }
    App.toast("定位中…");
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude:lat, longitude:lng}=pos.coords;
      this.userPos=[lat,lng];
      if(this.userMarker) this.map.removeLayer(this.userMarker);
      this.userMarker=L.circleMarker([lat,lng],{radius:9,color:"#22d3ee",fillColor:"#22d3ee",fillOpacity:.9,weight:3}).addTo(this.map).bindPopup("📍 您的位置");
      const sorted=nearestHospitals(lat,lng);
      this.sorted=sorted;
      document.getElementById("citySelect").value="";
      this.addMarkers(sorted);
      this.renderList(sorted);
      this.map.flyTo([lat,lng],10,{duration:.8});
      const nearest=sorted[0];
      App.toast(`最近：${nearest.name}（${nearest.dist.toFixed(1)} km）`,"good");
      setTimeout(()=>{ const m=this.markers.find(mk=>mk._hosp===nearest); m && m.openPopup(); },1000);
    }, err=>{
      App.toast("無法取得定位，預設顯示全台","bad");
      // fallback: 台北車站
      const lat=25.0478,lng=121.5170; this.userPos=[lat,lng];
      const sorted=nearestHospitals(lat,lng); this.sorted=sorted; this.renderList(sorted);
    }, {enableHighAccuracy:true, timeout:8000});
  },
};
window.MapView = MapView;
