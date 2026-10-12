# 香料排查 v6：更新與使用

## 更新
將此資料夾內容更新到原 GitHub 儲存庫並提交，等待 Vercel 部署完成。TAVILY_API_KEY 保留。重新開啟網頁後，頂部應顯示 2026-10-12-ocr-v6。

首次部署：Framework Other、Build Command npm run build、Output Directory public、Install Command npm ci、Node 22.x。環境變數 TAVILY_API_KEY 貼上自己的 Tavily 金鑰，套用 Production；預覽也要用時套用 Preview。

## v6 的改變
1. 有框線的三欄表格採逐列辨識：獨立掃描名稱欄與 CAS 欄。CAS 欄使用數字／連字號辨識限制，不會讀成 S。其他排版無法辨認表格時，回到整頁 OCR。
2. 列數與去重分開：保留文件全部列；開始查詢時相同 CAS 合併，以節省額度。顯示文件列數、有效 CAS 列、不重複 CAS、重複 CAS 列、待核對列。
3. 提供逐列 OCR 名稱、CAS 與核對狀態；沒有 CAS 的列不會悄悄丟掉，仍可用名稱查詢及手動核對。
4. 全部頁面 OCR 模式不讀 PDF 文字層，直接渲染成影像，再做 OCR。
5. 查詢結果分開顯示原始輸入與辨認名稱；名稱從來源的 Name 欄讀回。未讀出時使用已辨識的 PDF 名稱／已知中文名稱，否則顯示名稱未取得，不用 CAS 冒充名稱。
6. 加入 Linalool CAS 78-70-6 的已查核 TGSC 成分頁面網址；分子式仍線上讀取，沒有寫死答案。一般搜尋優先資料頁，排除用途／供應商頁。
7. 查詢失敗改顯示未取得成分資料，保留讀取與解析診斷。

## 廠商 PDF 操作
展開從廠商 PDF 擷取成分，選全部頁面以 OCR 辨識，再選英文／CAS語言並匯入檔案。先看逐列清單及摘要，必要時修改待查成分或擷取原文，核對後開始排查。

表格模式針對有清晰框線、三欄的編號／名稱／CAS 表格。其他格式或框線不清晰不保證逐列偵測，會用整頁 OCR，仍需核對。20 MB／30 頁限制保留。OCR 在瀏覽器內進行，完整 PDF 不上傳；首次需下載 Tesseract 核心與語言模型。

## 本份草莓 PDF 驗證
使用 PDF.js 將原 PDF 渲染為影像，沒有抽取文字層，再執行與前端相同的 recognizeTable OCR 函式。第 1 頁 26 列、第 2 頁 9 列，全部 35 列 CAS 取得並通過檢查碼；不重複 CAS 34，重複列 1，待核對 CAS 0。第 9 列與第 22 列同為 3142-72-1，保留兩列。

名稱保持廠商寫法，OCR 正確讀出來源不代表來源命名／CAS 本身一定正確。CAS 檢查碼亦不保證物質身分，必須核對來源。

22 組功能測試及建置通過。上述 OCR 驗證是在本機 PDF.js／Tesseract 與前端共享函式上進行；Vercel 線上網站目前仍是 v5，需要你更新部署後做瀏覽器端測試。沒有真實 Tavily 金鑰，Linalool 的線上抓取尚未用使用者帳戶重測。

## 來源與分類
TGSC 優先，未取得再查 Scents and Flavors。只依你 Excel 的 27 項禁用清單；多 CAS 項目全部保留。禁用物質、同分子式異構物、未命中三類，未取得資料另列。資料在 lib/data.json，欄位 zh／en／formula／cas。

有些精油是混合物，沒有固定單一分子式，這些項目不能直接套用單體分子式比對，也不能把未取得分子式當成沒問題。

Tavily 搜尋與 Extract 都會消耗額度，這版沒有持久快取；先核對 OCR 清單再開始排查。語言模型及 WebAssembly 需可存取相關 CDN。

本機：安裝 Node.js 22，依序 npm ci、npm run build、npm test、npm start，開啟 http://localhost:3000。查詢需在終端機設定 TAVILY_API_KEY，程式不自動讀 .env。
