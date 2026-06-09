# 職盾 JobShield — 職業安全雙向智能防護平台

> 一個專為職安防護打造的雙向智能工具。整合政府公開資料、全國法規、司法院判決與職災專責醫院名單，運用 Hybrid RAG 技術，為**企業端**（發包風險評估）與**勞工端**（理賠、醫療、通報）提供即時、可溯源的決策建議。

本專案為國立中央大學初賽提案「職盾」的可運作網站實作。

## ✨ 核心功能

| 功能 | 說明 |
|------|------|
| 🤖 **AI 智能諮詢** | 串接 Gemini Data RAG 對話 API（支援串流）。解析 Markdown / Mermaid，每則回覆附**複製按鈕**。CORS / 離線時自動退回**本地知識庫推理**，Demo 任何情境皆可運作。 |
| 📑 **來源標註與信心分數** | 每條建議／判決預測皆附引用**法條、判決字號、資料更新日**與**信心分數**進度條。 |
| 🔘 **一鍵追問** | AI 回答後提供「建議追問」按鈕，可一鍵送出或導向對應功能（試算 / 通報 / 地圖 / 比較）。 |
| 🏭 **廠商風險評估** | 即時比對「通過職安審查名單」與「違規處分紀錄」，輸出職安評分、風險評級、發包建議，並生成**風險分析拓樸圖**（Mermaid）。 |
| 📊 **多廠商並排比較** | 將候選廠商加入追蹤，發包前同時評比數家廠商的風險等級，自動標示最佳選擇。 |
| 🏥 **專責醫院互動地圖** | Leaflet 地圖定位最近的職業傷病專責醫院，提供**導航、聯絡分機、一鍵撥號**。 |
| 🧮 **理賠試算** | 依《勞工職業災害保險及保護法》即時試算職災傷病給付（前 60 日 100%、第 61 日起 70%、上限 730 日）。 |
| 📄 **文件自動生成** | 由對話內容自動帶入，一鍵生成《職業災害事故通報表》PDF（html2canvas + jsPDF，支援中文）。 |
| 🎤 **語音輸入** | Web Speech API，依介面語言自動切換辨識語系。 |
| 🌐 **移工多語言支援** | 中／英／印尼／越南／泰語五語介面，讓外籍移工也能獲得保障。 |

## 🗂 資料來源

- **通過職業安全衛生管理系統績效審查事業單位清單**（政府公開資料平台）— `assets/data/companies.json`（79 筆）
- **事業單位違反職業安全衛生法令資料**（勞動部）— `assets/data/violations.json`（99 筆）
- **職業傷病診治專責醫院名單**（勞動部）— `assets/data/hospitals.json`（19 家，含座標）
- 非結構化：勞工職業災害保險及保護法、職業安全衛生法、常見問答指南、歷史判決書

## 🚀 啟動與瀏覽方式

### 1. 線上直接瀏覽
本專案已透過 GitHub Pages 自動部署，您可以直接點擊下方連結進入平台：
👉 [職盾 JobShield 線上展示平台](https://gingerliao.github.io/Occupational_Safety/)

### 2. 本地運行
純靜態網站，無需建置步驟：
```bash
# 任一靜態伺服器即可
python3 -m http.server 8099
# 開啟 http://localhost:8099
```

> 語音輸入、地理定位、一鍵撥號需在 `https` 或 `localhost` 下，並使用 Chrome / Edge 以獲得最佳支援。

## 🧱 技術架構

- **前端**：原生 HTML / CSS / JavaScript（零建置、即開即用）
- **地圖**：Leaflet + CARTO dark tiles
- **Markdown / 圖表**：marked、Mermaid
- **PDF**：html2canvas + jsPDF
- **AI**：Gemini Data RAG API（`js/rag-api.js`）+ 本地知識庫推理引擎（`js/knowledge.js`）

```
index.html
css/styles.css
js/
 ├ app.js          導航 / 首頁 / Toast / 語言
 ├ i18n.js         五語系字典
 ├ data.js         資料載入 + 風險評估引擎 + 地理距離
 ├ knowledge.js    本地 Hybrid RAG 推理（來源/信心/追問/拓樸圖）
 ├ rag-api.js      Gemini Data 串流 API 客戶端
 ├ chat.js         AI 諮詢核心
 ├ vendors.js      廠商評估 + 多廠商比較
 ├ map.js          專責醫院互動地圖
 ├ calculator.js   理賠試算
 ├ report.js       通報表生成 + PDF
 └ voice.js        語音輸入
assets/data/*.json 結構化資料
```

## ⚠️ 免責聲明

本平台資訊僅供參考，不構成法律意見。實際理賠金額以勞動部勞工保險局核定為準。
