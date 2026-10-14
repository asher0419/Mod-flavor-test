# V10 validation

39 automated tests pass, including list precedence semantics, seed import, CAS/formula conflicts, ambiguity, durable local export/import and stale classification recomputation. Actual uploaded XLSX parsed via browser importer algorithm in Node with XML DOM shim: 152 rows, 0 rejected; CSV roundtrip 152. Build and JS syntax pass. Existing V6 live OCR evidence remains below; V10 public site is not yet deployed/tested.

# V9驗證紀錄
- 33組功能測試通過，建置及JavaScript語法檢查通過。
- 新增未設定種子網址的CAS目錄追蹤測試；來源頁仍須CAS／分子式核對。
- 候選名稱不自行猜測；補網址CAS不符拒絕；允許網站以外URL拒絕。
- 成功結果7天瀏覽器快取，規則與解析版本變動失效；失敗與混合物不作成功快取。
- 過期結果保留成功來源定位，讀取後重新核對。
- V9自動定位與補查用模擬API／來源文件驗證；修正版線上端到端操作待使用者部署。
- 先前V6網頁實測：PDF35列CAS全部辨識，34不重複CAS。

### 2026-10-14 v19
- 55 項自動測試通過；建置通過。
- 以使用者藍莓掃描 PDF 的實際 OCR 文字驗證，PSM 3 保留 15 列：13 筆 FEMA、MCT、Neotame。PSM 6 漏一列，因此整頁辨識改用 PSM 3。
- 實際 DOCX 表格經 Mammoth 轉換，名称與獨立 FEMA 欄位合併為同一成分列；XLSX 與 XLS 多工作表測試通過。
- FEMA 不符、沒有 FEMA 標籤、含不同 CAS 的來源拒絕採用。
- 線上查詢使用 mock 測試；此環境未提供 TAVILY_API_KEY，未實測廠商全部 FEMA 的即時線上查詢，也未更新使用者的 Vercel 部署。

### 2026-10-14 v20
- 60項測試及建置通過。第70版212筆無移除，147筆FEMA匹配，65筆未匹配。
- 本地对照2512筆／2447个不同FEMA；CAS檢查碼全部通過。
- 13筆藍莓香料用核對過的原始名稱與FEMA查詢，全數可直接取得清單內CAS與分子式。OCR讀成「lsoamyl」且FEMA有多個CAS時維持待確認。
- 測試裸FEMA、FEMA加名稱、對照冲突、匯出再匯入、共用清單保存與版本衝突；原第70版物質類型完整保留。
- 只含CAS/FEMA對照而尚無分子式的項目仍需線上核對。無Vercel存取資料，未改動線上部署或真實共用清單。
