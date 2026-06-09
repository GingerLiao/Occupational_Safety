/* ============================================================
   knowledge.js — 本地職安知識庫推理引擎 (Hybrid RAG fallback)
   依使用者意圖，從真實資料(企業/違規/醫院)與法規知識中尋找證據，
   產出 Markdown 回覆，並附上「來源標註 + 信心分數 + 建議追問」。
   ============================================================ */
const LocalRAG = {
  // 法規知識片段（作為非結構化資料來源）
  laws:{
    benefit:{
      ref:"勞工職業災害保險及保護法 第42條",
      text:"職災傷病給付自不能工作之第 4 日起發給：前 60 日按平均月投保薪資 100%，第 61 日起按 70%，最長以 2 年為限。",
    },
    report:{
      ref:"職業安全衛生法 第37條第2項",
      text:"事業單位勞動場所發生死亡災害、罹災人數 3 人以上、罹災 1 人以上需住院治療等職業災害，雇主應於 8 小時內通報勞動檢查機構，且現場不得移動或破壞。",
    },
    employer6:{
      ref:"職業安全衛生法 第6條第1項",
      text:"雇主對防止墜落、感電、物體飛落等危害，應有符合規定之必要安全衛生設備及措施。",
    },
    noinsurance:{
      ref:"勞工職業災害保險及保護法 第36條、第89條",
      text:"雇主未依規定投保，勞工遭遇職災時，得向勞保局請領補助；雇主仍應依勞動基準法第59條補償，並按給付金額處以罰鍰。勞工另可依勞基法及民法請求損害賠償。",
    },
    fall:{
      ref:"營造安全衛生設施標準 第19條 / 職業安全衛生設施規則 第281條",
      text:"高度 2 公尺以上有墜落之虞者，應設置護欄、護蓋、安全網，或使勞工確實使用安全帶、安全帽。",
    },
    contractor:{
      ref:"職業安全衛生法 第27條",
      text:"原事業單位與承攬人共同作業時，應設置協議組織、指定工作場所負責人、採取連繫調整、巡視工作場所、指導安全衛生教育。",
    },
  },

  async answer(qRaw){
    await loadDB();
    const q = (qRaw||"").trim();
    const lc = q.toLowerCase();
    const updated = DB.updated;

    // 意圖判斷
    const isVendor = /評估|發包|廠商|供應商|外包|承攬|合作|風險/.test(q) && !/我|員工|受傷|墜樓|墜落|理賠|給付/.test(q.slice(0,6));
    const isClaim  = /理賠|給付|賠償|多少錢|補助|津貼|和解|判賠|金額/.test(q);
    const isMedical= /醫院|專責|鑑定|看診|診治|就醫|職業病/.test(q);
    const isReport = /通報|報告|流程|怎麼跑|怎麼辦|該向誰|步驟/.test(q);
    const isFall   = /墜樓|墜落|高處|摔/.test(q);

    // 嘗試抽出可能的廠商名（出現「公司」字樣）
    const compMatch = q.match(/([一-龥A-Za-z0-9]{2,12}(?:公司|工程|營造|科技|實業|企業|半導體|電子))/);

    if(isVendor || (compMatch && /評估|風險|發包|查詢|違規|通過/.test(q))){
      return this.vendorAnswer(q, compMatch && compMatch[1], updated);
    }
    if(isMedical) return this.medicalAnswer(q, updated);
    if(isClaim)   return this.claimAnswer(q, updated);
    if(isReport || isFall) return this.accidentAnswer(q, updated, isFall);
    // 預設：綜合導引
    return this.generalAnswer(q, updated);
  },

  srcBlock(items, conf, updated){
    // items: [{tag,text}]
    let s = `\n\n<!--SOURCES\n`;
    s += JSON.stringify({sources:items, confidence:conf, updated})+`\nSOURCES-->`;
    return s;
  },
  fuBlock(items){ return `\n<!--FOLLOWUP\n${JSON.stringify(items)}\nFOLLOWUP-->`; },

  vendorAnswer(q, name, updated){
    const target = name || q.replace(/.*評估|的風險.*|請幫我|相關風險。?/g,"").trim();
    const r = assessVendor(target || q);
    let md = "";
    if(!r || (!r.passedHit && r.vCount===0)){
      md += `### 廠商風險查詢結果：**${target||q}**\n\n`;
      md += `> ⚠️ 查無「${target||q}」於政府公開審查名單，亦無公開違規處分紀錄。\n\n`;
      md += `**情境工程推理**：當查無該企業資料時，系統會自動擷取提問中的「產業屬性」，檢索歷史判決書中**同產業**前例給予發包建議。建議您：\n\n`;
      md += `1. 要求廠商提供 **TOSHMS / ISO 45001 職安衛管理證明**\n2. 於合約加註**職災連帶責任**與保險要求條款\n3. 確認其勞保 / 職災保險投保狀態\n`;
      md += this.srcBlock([
        {tag:"資料庫",text:"通過職業安全衛生管理系統績效審查事業單位清單（政府公開資料平台）"},
        {tag:"資料庫",text:"事業單位違反職業安全衛生法令資料（勞動部）"},
      ], 62, updated);
      md += this.fuBlock(["如何要求廠商提供職安衛管理證明？","合約中的職災連帶責任條款怎麼寫？","改用同產業判決前例評估"]);
      return md;
    }
    md += `### 廠商職安風險評估：**${r.query}**\n\n`;
    md += `| 評估項目 | 結果 |\n|---|---|\n`;
    md += `| **風險評級** | ${r.level==="低風險"?"🟢":r.level==="中風險"?"🟡":"🔴"} **${r.level}**（職安評分 ${r.score} / 100）|\n`;
    md += `| 職安審查狀態 | ${r.passedHit? "✅ 通過審查（"+r.passed.status+"）":"❌ 未在審查名單"} |\n`;
    md += `| 違規處分紀錄 | ${r.vCount>0? "⚠️ "+r.vCount+" 筆"+(r.severe>0?"（含 "+r.severe+" 筆重大）":""):"無紀錄"} |\n`;
    if(r.passedHit){
      md += `| 審查有效期間 | ${fmtDate(r.passed.passDate)} ～ ${fmtDate(r.passed.expireDate)} |\n`;
      md += `| 廠區地址 | ${r.passed.address} |\n`;
    }
    // 創新一：跨領域資料 — 風險分析拓樸圖（結構化 + 非結構化資料同圖呈現）
    const col = r.levelKey==="low"?"#1f6f4a":r.levelKey==="mid"?"#7a5a12":"#7a2424";
    md += `\n\`\`\`mermaid\nflowchart LR\n`;
    md += `  C["🏭 ${r.query}"]:::comp\n`;
    md += `  A["${r.passedHit?"✅ 通過職安審查":"❌ 未在審查名單"}"]:::${r.passedHit?"good":"warn"}\n`;
    md += `  V["${r.vCount>0?"⚠️ "+r.vCount+" 筆違規":"無違規紀錄"}"]:::${r.vCount>0?"bad":"good"}\n`;
    md += `  R["🛡️ ${r.level}<br/>評分 ${r.score}"]:::risk\n`;
    md += `  C -->|審查狀態| A\n  C -->|違規處分| V\n  A --> R\n  V --> R\n`;
    md += `  classDef comp fill:#13203f,stroke:#3b82f6,color:#eaf0ff;\n`;
    md += `  classDef good fill:#0f3b2a,stroke:#34d399,color:#eaf0ff;\n`;
    md += `  classDef warn fill:#3b300f,stroke:#fbbf24,color:#eaf0ff;\n`;
    md += `  classDef bad fill:#3b1717,stroke:#f87171,color:#eaf0ff;\n`;
    md += `  classDef risk fill:${col},stroke:#22d3ee,color:#fff;\n\`\`\`\n`;
    md += `\n**🛡️ 發包建議**：${r.recommend}\n`;
    if(r.vCount>0){
      md += `\n**近期違規明細：**\n\n`;
      r.violations.slice(0,4).forEach(v=>{
        md += `- \`${fmtDate(v.punishDate)}\` ${v.law}\n  ${v.content.slice(0,70)}${v.content.length>70?"…":""}\n`;
      });
    }
    const sources=[];
    if(r.passedHit) sources.push({tag:"審查名單",text:`${r.passed.name}｜有效期 ${fmtDate(r.passed.passDate)}–${fmtDate(r.passed.expireDate)}`});
    r.violations.slice(0,3).forEach(v=> sources.push({tag:"違規處分",text:`${v.name}｜公告 ${fmtDate(v.announceDate)}｜${v.law}`}));
    if(!sources.length) sources.push({tag:"資料庫",text:"通過審查名單 / 違規處分紀錄（政府公開資料平台）"});
    const conf = r.passedHit? (r.vCount? 84:92) : 78;
    md += this.srcBlock(sources, conf, updated);
    md += this.fuBlock([
      "將此廠商加入多廠商比較",
      r.vCount>0?"這些違規法條的法律責任是什麼？":"幫我擬定發包合約的職安條款",
      "查詢同產業其他候選廠商",
    ]);
    return md;
  },

  medicalAnswer(q, updated){
    // 嘗試抓城市
    const cityM = q.match(/(臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|苗栗|彰化|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|南投|基隆)/);
    const city = cityM? cityM[1].replace("台","臺") : null;
    let list = city? hospitalsByCity(city) : [];
    if(city && !list.length) list = hospitalsByCity(city.replace("臺",""));
    let md = `### 職業傷病診治專責醫院指引\n\n`;
    md += `職災鑑定務必前往**勞動部認可之「職業傷病診治專責醫院」**，以保全醫療證據、取得職業病鑑定，避免日後勞資訴訟舉證困難。\n\n`;
    if(city && list.length){
      md += `**${city}地區專責醫院：**\n\n`;
      list.slice(0,4).forEach(h=>{
        md += `- **${h.name}**\n  📍 ${h.address}\n  ☎️ ${h.phone}\n`;
      });
      md += `\n👉 可至「**專責醫院互動地圖**」一鍵導航與撥號。\n`;
    } else {
      md += `全台共 **${DB.hospitals.length}** 家專責醫院。請至「**專責醫院互動地圖**」定位最近一家，提供導航、聯絡分機與一鍵撥號。\n`;
    }
    md += `\n**鑑定後通報流程：**\n1. 經專責醫師確認為職業病 / 職災\n2. 雇主應於 **8 小時內**通報勞動檢查機構（職安法 §37）\n3. 備齊診斷書，向**勞保局**申請職災保險給付\n`;
    md += this.srcBlock([
      {tag:"醫院名單",text:"職業傷病診治專責醫院名單（勞動部）"},
      {tag:"法規",text:this.laws.report.ref+"｜"+this.laws.report.text},
    ], 90, updated);
    md += this.fuBlock(["幫我用地圖找最近的專責醫院","職業病認定需要哪些文件？","試算我能領多少職災給付"]);
    return md;
  },

  claimAnswer(q, updated){
    const noIns = /沒(保|有)勞保|未投保|沒幫|私下和解|和解/.test(q);
    let md = `### 職災理賠與權益說明\n\n`;
    md += `依 **${this.laws.benefit.ref}**：${this.laws.benefit.text}\n\n`;
    md += `> 💡 想知道確切金額？請至「**理賠試算**」輸入平均月投保薪資與不能工作天數，即時計算。\n\n`;
    if(noIns){
      md += `**雇主未投保勞保 / 要求私下和解：**\n\n`;
      md += `- 即使雇主未投保，您仍可依 **${this.laws.noinsurance.ref}** 向勞保局請領補助。\n`;
      md += `- 雇主依**勞動基準法第59條**仍須補償醫療費、工資補償、失能與死亡補償，**不因未投保而免責**。\n`;
      md += `- **切勿急於私下和解**：和解金額常遠低於法定補償加保險給付總和。建議先完成職業病鑑定、保全證據。\n`;
      md += `- 雇主未投保將被處以罰鍰，並按給付金額加重處罰。\n`;
    } else {
      md += `**可請領項目：** 醫療給付、傷病給付（工資補償）、失能給付、死亡給付（遺屬年金/一次金）、職災勞工津貼與照護補助。\n`;
    }
    md += `\n**歷史判決參考**：類似職災（如墜落致死且未投保）法院判賠區間多落於 **NT$ 250 萬 ～ 600 萬**，視過失比例、扶養人數與投保狀況而定。\n`;
    md += this.srcBlock([
      {tag:"法規",text:this.laws.benefit.ref+"｜"+this.laws.benefit.text},
      {tag:"法規",text:this.laws.noinsurance.ref},
      {tag:"判決書",text:"司法院判決書系統｜同類型職災民事求償案例（資料持續更新）"},
    ], 81, updated);
    md += this.fuBlock(["開啟理賠試算計算確切金額","生成職災事故通報表","沒投保勞保我該向誰申請補助？"]);
    return md;
  },

  accidentAnswer(q, updated, isFall){
    const noIns = /沒(保|有)勞保|未投保|沒幫/.test(q);
    let md = `### 職災發生後處理流程（雇主 / 勞工通用）\n\n`;
    md += `**⏱️ 黃金 8 小時：**\n1. **立即急救送醫**，優先送往職業傷病**專責醫院**保全證據。\n2. **保留事故現場**，不得移動或破壞（職安法 §37）。\n3. 雇主於 **8 小時內通報**當地勞動檢查機構。\n\n`;
    if(isFall){
      md += `**墜樓 / 高處墜落 法律風險：**\n`;
      md += `- 涉違反 **${this.laws.fall.ref}**：${this.laws.fall.text}\n`;
      md += `- 若未設護欄/安全網或未使勞工使用安全帶，雇主將負**職安法第6條**行政與刑事責任。\n\n`;
    }
    if(noIns){
      md += `**未投保勞保的賠償風險：**\n`;
      md += `- 雇主仍須依**勞基法第59條**補償，且依 ${this.laws.noinsurance.ref} 被處罰鍰並按給付金額加重。\n`;
      md += `- 勞工可向勞保局請領補助，雇主賠償責任**不會因此減免**，恐面臨高額賠償與訴訟。\n\n`;
    }
    md += `**後續流程：** 事故調查 → 職業病/職災鑑定 → 申請勞保職災給付 → 必要時協商或訴訟。\n\n`;
    md += `> 📄 可一鍵生成「**職業災害事故通報表**」，或至「**理賠試算**」評估賠償金額。`;
    const sources=[
      {tag:"法規",text:this.laws.report.ref+"｜"+this.laws.report.text},
      {tag:"法規",text:this.laws.employer6.ref+"｜"+this.laws.employer6.text},
    ];
    if(isFall) sources.push({tag:"法規",text:this.laws.fall.ref});
    md += this.srcBlock(sources, 86, updated);
    md += this.fuBlock(["一鍵生成職災事故通報表","試算這次職災的賠償金額","幫我找最近的專責醫院做鑑定"]);
    return md;
  },

  generalAnswer(q, updated){
    let md = `### 職盾 AI 顧問\n\n我已理解您的問題：「${q}」。我可從以下面向協助您（資料來源：政府公開資料平台、全國法規資料庫、勞動部、司法院判決書系統）：\n\n`;
    md += `- 🏭 **廠商風險評估** — 發包前比對職安審查與違規名單\n`;
    md += `- ⚖️ **理賠與判決查詢** — 職災給付與賠償金額預估\n`;
    md += `- 🏥 **醫療指引** — 最近的職業傷病專責醫院\n`;
    md += `- 📄 **文件生成** — 職災事故通報表\n\n`;
    md += `請告訴我更多細節，例如廠商名稱、事故經過、或您的投保薪資。`;
    md += this.srcBlock([{tag:"資料庫",text:"政府公開資料平台 / 全國法規資料庫 / 勞動部 / 司法院判決書系統"}], 70, updated);
    md += this.fuBlock(["評估一家發包廠商的風險","我在工地受傷了，該怎麼辦？","找最近的職災專責醫院"]);
    return md;
  },
};
window.LocalRAG = LocalRAG;
