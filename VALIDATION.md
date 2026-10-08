# Tavily 版驗證
- 17 組自動測試通過：27 項禁用及多 CAS、分子式正規化、三類分類、CAS 檢查碼、來源解析、TGSC 找到就停止、TGSC 未找到才查 Scents and Flavors、雙來源未找到、API 查無狀態、錯誤金鑰。
- 已驗證不呼叫 PubChem，使用 Tavily basic 搜尋。
- 建置及 JavaScript 語法檢查通過。
- PDF 文字擷取及測試掃描 PDF 英文 OCR 曾實測成功，功能保留。
- 未用真實 Tavily 金鑰完成端到端線上查詢；部署後需實測來源可讀性。
- 瀏覽器完整互動及手機排版尚未實測。
