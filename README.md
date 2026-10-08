# 香料排查：Tavily 版部署教學

## 本版查詢規則
每筆先查 The Good Scents Company，找到可核對的 CAS 與分子式就停止；未取得時再查 Scents and Flavors。兩者都未取得時顯示「查無該成分」，不會列為「沒問題」。完全移除 Serper 與 PubChem。

Excel 的 27 項禁用清單完整保留；玫瑰醇等多 CAS 項目全部保留。152 筆單體的中英文及 CAS 只作名稱辨認對照，分子式由上述兩個網站取得。所有成分按來源順序查詢，不再直接以 Excel 分子式結束線上查詢。

如果來源未收錄、拒絕連線或格式無法解析，結果仍顯示「查無該成分」，並列出每個來源的嘗試結果；這代表未取得可核對資料，不能據此認定該成分不存在。金鑰錯誤／額度耗盡則另顯示查詢未完成，便於修正設定。

## 第一次部署
1. 解壓縮 ZIP。
2. 到 https://github.com 建立 Private 儲存庫，例如 flavor-checker。
3. Add file → Upload files，拖入 flavor-checker 資料夾裡的內容，不要上傳 ZIP 本身。package.json 要在儲存庫根目錄。
4. 不需上傳 node_modules、public/vendor、.env 或 OCR 測試模型檔。
5. 到 https://app.tavily.com 註冊帳號，在儀表板取得 API Key。
6. 到 https://vercel.com，Add New → Project，匯入 GitHub 儲存庫。
7. Framework Preset：Other。
8. Build Command：npm run build。
9. Output Directory：public。
10. Install Command：npm ci。
11. Node.js：22.x；Root Directory 指向含 package.json 的資料夾。
12. 在 Environment Variables 新增 TAVILY_API_KEY，把自己的 Tavily 金鑰貼入 Value，至少套用 Production。
13. 按 Deploy。完成後 Visit 開啟網站，頂部應显示 Tavily 搜尋已設定。
14. 用範例測試。設定已存在不等於金鑰有效，仍需線上查詢確認。

## 若你已部署舊版
1. 用本版程式內容更新原 GitHub 儲存庫。也可以建立新的儲存庫重新匯入。
2. Vercel → 專案 → Settings → Environment Variables。
3. 新增 TAVILY_API_KEY，Value 貼入 Tavily 金鑰。
4. 刪除不再需要的 SERPER_API_KEY。
5. Deployments → 最新部署 → Redeploy；環境變數改完要重新部署。
6. 網站不再有 PubChem 備援選項；來源順序固定為 TGSC → Scents and Flavors。

## 用量
採 Tavily basic 搜尋，每筆一定先搜尋 TGSC；TGSC 找到就只用一次搜尋。未取得才搜尋 Scents and Flavors，最多兩次搜尋。沒有其他供應商備援，不產生 Tavily AI answer。

Tavily 目前提供每月 1,000 credits，basic 搜尋每次 1 credit；免費額度與費用以當時官方方案為準。若每筆都查兩個來源，大約 500 次成分查詢可用完月額度。這版沒有持久快取，重查同成分仍會搜尋。

搜尋要求包含來源完整文字 raw_content；若完整文字可核對 CAS 與分子式，直接擷取，否則嘗試下載對應來源頁面。不將 AI 回答或搜尋摘要當成分子式依據。

## 操作
每行一個中文、英文或 CAS。已知中文先利用內建 Excel 對照成 CAS；新中文名稱無已知對照且來源沒有相符名稱時，請改用英文或 CAS。表格列包含 CAS 時優先用 CAS。每批最多 200 項，逐筆查詢，可停止並匯出 CSV。

三類：
- 禁用物質：取得的 CAS 命中 27 項清單。
- 有禁用物質的異構物：分子式命中，但 CAS 未命中。
- 沒問題：取得有效分子式且沒有命中目前清單。

查无該成分及查詢未完成另外提示，不算進三類合格結果。不同 CAS 有時仍是同一物質的不同登錄，分類依你的清單規則，結果保留來源供核對。

測試範例：香蘭素、141-78-6、107-92-6、覆盆子酮。來源取得資料時，前兩者應為禁用，丁酸 107-92-6 為異構物，覆盆子酮未命中目前清單。141-78-7 是錯誤 CAS，會顯示查詢未完成。

## 廠商 PDF
展開「從廠商 PDF 擷取成分」，選擇辨識模式及語言，再選檔案。
- 自動：文字少於 30 字的頁面改用 OCR。
- 只擷取文字：文字型 PDF。
- 全部頁面 OCR：掃描 PDF，或頁面混合圖片與文字而成分藏在圖片時。

PDF 在瀏覽器內處理，不上傳整份檔案。第一次 OCR 需下載核心與語言模型，需可連線其 CDN。限制 20 MB／30 頁，加密檔需先解鎖。

CAS 整理前有檢查碼驗證；候選清單及原文皆可編輯。沒有有效 CAS 時才嘗試整理内建名稱；混合文件有 CAS 時，缺少 CAS 的成分需手動補入。核對完整清單後按開始排查，不能只看自動整理數量判斷文件已讀全。

## 更新清單
lib/data.json 的 banned 是 27 項禁用清單、known 是名稱對照。zh／en／formula／cas 分別是中文、英文、禁用分子式及 CAS 陣列。一格多 CAS 保留為陣列；originalCAS 是原始文字。

在 GitHub 修改 data.json 並提交後，Vercel 會重新部署。版本日期在 version 欄位。本版未提供上傳 Excel 更新清單功能。

## 本機執行（選用）
安裝 Node.js 22，在程式資料夾依序執行 npm ci、npm run build、npm test、npm start。設定終端機環境變數 TAVILY_API_KEY，程式不自動載入 .env。瀏覽器開 http://localhost:3000。

## 驗證與限制
17 組自動測試通過，包括 TGSC 找到就停止、找不到才查第二來源、雙來源查不到、金鑰錯誤及 CAS 身分核對。PDF 文字擷取與測試掃描頁英文 OCR 曾實測成功，本次保留原功能。

尚未提供真實 Tavily 金鑰，因此未完成兩個網站的實際 Tavily 端到端查詢。網站原始格式變動、拒絕存取或完整文字未回傳，都可能使資料擷取失敗。瀏覽器完整操作與手機排版尚未實測。

官方文件：
- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://www.tavily.com/pricing
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/environment-variables
- https://mozilla.github.io/pdf.js/getting_started/
- https://github.com/naptha/tesseract.js

## 分子式擷取修正版
修正 NMR、Chemical Information 等頁面文字誤併入分子式。僅接受有效元素符號，錯誤分子式不會判成沒問題。支援 TGSC EPI 的 MOL FOR，以及同頁多 CAS 資料區塊。

已查核截圖五筆成分的 TGSC 來源網址，將網址對照內建，用於直接讀取來源（未內建分子式答案）。TGSC 已知頁面直接連線失敗時，使用 Tavily basic Extract 讀取，再做 CAS／分子式核對；仍失敗才搜尋。這會額外消耗 Tavily Extract 額度，費用依其官方規則。搜尋改為只用 CAS／名称，不再附加 molecular formula 等字詞，且優先資料頁。

回歸測試：106-22-9 → C10H20O → 命中薄荷醇與玫瑰醇分子式；123-86-4 → C6H12O2 → 命中丁酸乙酯分子式。使用已查核頁面欄位與模擬 API 回應測試通過，真實 Tavily 帳戶端到端仍待部署後驗證。

舊版的錯誤結果及已匯出的 CSV 請重新排查。

## 部署版本確認（field-v4）
更新後網頁頂部必須顯示 2026-10-08-field-v4。若沒有，開的是舊部署或 GitHub 程式未更新，不能視為本版的測試結果。分子式欄新增「來源欄位」原文，方便核對。
本版保留 HTML 表格／列的界線，完整分子式欄位驗證；拒絕 C6H12ChIInO2 等錯誤資料。Scents and Flavors 的 database/supplier 供應商產品頁不再作成分判定來源。

## Borneol 與缺少全文的來源結果
Borneol 已由原 Excel 對照 507-70-0。增加 TGSC 已查核的冰片與其立體形式來源網址；仍會讀取來源並核對 CAS／分子式，沒有直接內建判定答案。修正分子式緊接 EFSA／JECFA 標籤時的邊界。
一般搜尋結果若沒有 raw_content 且直接下載失敗，現在也會用 Tavily Extract 嘗試取得全文，而不是只對特定成分做 Extract。每個來源限制此備援次數，避免過久。可額外消耗 Extract 額度。
Borneol 507-70-0 的 TGSC 欄位為 C10H18O，依清單對應薄荷酮的異構物。17 組測試通過，真實帳戶端到端仍需部署後確認。
