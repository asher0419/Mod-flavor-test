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
