# V12 同步及PDF操作修正

正式站V11的/api/library實際回傳HTTP503，錯誤為UPSTASH_REDIS_REST_URL前後含雙引號導致URL解析失敗。本版自動去除REST URL／Token前後成對引號與空白，並顯示可操作錯誤。

Vercel環境變數值應只貼網址或Token本身，不要貼變數名稱、等號或引號；Production與Preview若都要使用，兩個環境都需設定，保存後Redeploy。

PDF正式站實測：以網站選檔、全部頁OCR模式辨識原始35列文件，成功35列／34個不重複CAS。本版補上選檔／首次模型載入提示、PDF拖曳區及查詢錯誤顯示，避免同步失敗被「完成0項」掩蓋。

V12尚未部署，本地43項測試及build／語法检查通過；真實Upstash連線需部署後再確認，不宣稱已恢復線上同步。

# V11 共用五欄單體清單

已內建152筆單體。錄入、CSV匯出採英文名稱、CAS Number、簡式、已確認網址、是否為禁用物質五欄。分類由CAS與分子式重新計算，不採信舊分類。

## 部署及啟用分公司同步

完整覆蓋GitHub專案檔。Vercel頁首版本應為2026-10-13-shared-v11。

1. 在Vercel專案Storage／Marketplace加入Upstash Redis，連接此專案。分公司使用同一網站；若使用不同專案，必須連接同一資料庫。
2. 設定UPSTASH_REDIS_REST_URL與UPSTASH_REDIS_REST_TOKEN環境變數，從Upstash資料庫REST API欄取得；亦支援KV_REST_API_URL／KV_REST_API_TOKEN。Redis密鑰僅放Vercel，勿寫入前端或貼到聊天。
3. 新增LIBRARY_ADMIN_TOKEN，自己設定一組長密碼。修改者在網站「清單管理密碼」輸入；只存在當前頁面記憶體。一般查詢不需密碼。
4. 保留TAVILY_API_KEY，再重新部署。
5. 共用清單必須顯示「共用清單已連線」及版本。首次連線初始化內建152筆。未連線明確顯示尚未同步，本機查詢不代表分公司已共享。

共用啟用後，每次查詢先讀最新清單；畫面每30秒／切回頁面更新。線上找到並通過CAS／分子式核對的新資料由後端自動加入；手動新增、編輯、匯入使用管理密碼。其他人下次查詢取得新資料，不需重新部署。多人保存有原子版本核對，過時版本拒絕保存。同步失敗不宣稱保存成功。

流程：共用清單→TGSC→Scents and Flavors→手動補查或录入。直接手動錄入信任管理者提供值，並非網路核實。清單讀取沿用網站公開查詢，取得網址者可讀；寫入需管理密碼。混合物不能按固定單一分子式判定通過。

## 本次清單

150筆TGSC來源；乳酸薄荷酯61597-98-6使用JECFA現行CAS頁；枸杞多醣為混合物，使用文獻頁，CAS與分子式不虛構。後兩筆來源不是TGSC。原有SMILES、FEMA、英文別稱等未改。分類：3禁用、16異構、132未命中、1混合物待核對。

## 驗證限制

42個Node測試及build／JS語法檢查通過。共享同步、版本衝突用記憶體Redis替身測試，尚未連接使用者資料庫或完成公開網站V11驗證。Excel值及未改欄位已核對；預覽環境缺中文字型，中文顯示請用Excel確認。

資料庫設定參考：https://vercel.com/docs/marketplace-storage 、https://upstash.com/docs/redis/features/restapi
