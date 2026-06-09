/* ============================================================
   data.js — 資料載入與職安知識庫 / 風險評估引擎
   ============================================================ */
const DB = { companies:[], violations:[], hospitals:[], loaded:false, updated:"2026-05-04" };

async function loadDB(){
  if(DB.loaded) return DB;
  const [c,v,h] = await Promise.all([
    fetch("assets/data/companies.json").then(r=>r.json()),
    fetch("assets/data/violations.json").then(r=>r.json()),
    fetch("assets/data/hospitals.json").then(r=>r.json()),
  ]);
  DB.companies=c; DB.violations=v; DB.hospitals=h; DB.loaded=true;
  return DB;
}

/* ---------- 廠商風險評估引擎 ---------- */
function fmtDate(s){ if(!s||s.length!==8) return s||"-"; return `${s.slice(0,4)}/${s.slice(4,6)}/${s.slice(6,8)}`; }
function normalize(s){ return (s||"").replace(/股份有限公司|有限公司|（.*?）|\(.*?\)|\s/g,""); }

function assessVendor(query){
  const q = query.trim();
  if(!q) return null;
  const nq = normalize(q);
  // 比對通過審查名單
  const passed = DB.companies.filter(c=> c.name.includes(q) || normalize(c.name).includes(nq) || (nq && nq.includes(normalize(c.name))) );
  // 比對違規紀錄
  const viol = DB.violations.filter(v=>{
    const vn = v.name.replace(/\(.*?\)/g,"");
    return vn.includes(q) || normalize(vn).includes(nq) || (nq && nq.length>=2 && nq.includes(normalize(vn)));
  });
  const passedHit = passed.length>0;
  const vCount = viol.length;

  // 評分: 基礎 60。通過審查 +30。每筆違規 -12 (上限-48)。重大法條(墜落/感電/死亡通報)額外扣分
  let score = 60;
  if(passedHit) score += 30;
  let severe = 0;
  viol.forEach(v=>{
    if(/第6條第1項|第37條|墜落|感電|爆炸|護欄|安全帶/.test(v.law+v.content)) severe++;
  });
  score -= Math.min(vCount*12, 48);
  score -= Math.min(severe*4, 16);
  if(passedHit && vCount===0) score = Math.max(score, 88);
  score = Math.max(8, Math.min(98, score));

  let level, levelKey;
  if(score>=75){ level="低風險"; levelKey="low"; }
  else if(score>=45){ level="中風險"; levelKey="mid"; }
  else { level="高風險"; levelKey="high"; }

  let recommend;
  if(passedHit && vCount===0) recommend="建議發包：該廠商通過職安審查且無違規紀錄，職安管理體系健全。";
  else if(passedHit && vCount>0) recommend="可審慎發包：雖通過審查，但有違規前科，建議於合約中加註職安連帶責任條款並要求改善證明。";
  else if(!passedHit && vCount>0) recommend="不建議發包：未在審查名單且有違規紀錄，職災連帶責任風險高。";
  else recommend="資料不足：未在政府審查名單，亦無公開違規紀錄。建議要求廠商提供職安衛管理計畫後再評估。";

  return {
    query:q, score, level, levelKey, recommend,
    passed: passed[0]||null, passedAll:passed, passedHit,
    violations: viol, vCount, severe,
    updated: DB.updated,
  };
}

/* ---------- 地理距離 (Haversine) ---------- */
function haversine(lat1,lng1,lat2,lng2){
  const R=6371, toR=x=>x*Math.PI/180;
  const dLat=toR(lat2-lat1), dLng=toR(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(toR(lat1))*Math.cos(toR(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function nearestHospitals(lat,lng){
  return DB.hospitals.map(h=>({...h, dist: (h.lat? haversine(lat,lng,h.lat,h.lng):9999)}))
    .sort((a,b)=>a.dist-b.dist);
}
function hospitalsByCity(city){
  return DB.hospitals.filter(h=> !city || h.city.includes(city) || city.includes(h.city.replace(/[市縣]/,"")));
}

window.DB=DB; window.loadDB=loadDB; window.assessVendor=assessVendor;
window.fmtDate=fmtDate; window.nearestHospitals=nearestHospitals; window.hospitalsByCity=hospitalsByCity; window.haversine=haversine;
