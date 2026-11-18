# 海豹學院｜FDE 商業情境實戰

讀懂 ERD、拆解客戶需求、用自然語言提出解法。三大題組、12 個連續情境，每個情境分成「調查 → 解決 → 追加情境」三階段。**考商業情境理解與資料庫思維，不考 SQL 語法。**

純靜態網站：只有 HTML、CSS、JavaScript，沒有建置步驟、後端、登入或 AI 金鑰。學生的回答只存在自己瀏覽器的 localStorage。

## 本機啟動

不需要安裝任何套件，以下兩種方式擇一：

- 直接用瀏覽器開啟 `index.html`。
- 或在專案根目錄啟動任一靜態伺服器，例如 `python3 -m http.server 8000`，再開啟 <http://localhost:8000/>。

## 部署到 GitHub Pages

repo 根目錄就是網站本身，不需要 build。

1. 把這個資料夾推到 GitHub repo（`main` 分支）。
2. 到 repo 的 **Settings → Pages**，Source 選 **Deploy from a branch**，Branch 選 `main`、資料夾選 `/ (root)`，儲存。
3. 約一分鐘後網站會出現在 `https://<帳號>.github.io/<repo 名稱>/`。

所有資源都用相對路徑，放在子路徑下也能正常運作；頁面切換使用 `#/...`，重新整理不會 404。同一份檔案也可以直接丟到 Netlify、Vercel 或任何靜態主機。

## 檔案結構

```text
index.html          頁面骨架與三個對話框（AI 提問、ERD 放大、清除確認）
css/styles.css      樣式（Apple 現代風格：淺灰底、白色圓角卡片、膠囊按鈕；響應式、列印）
js/data.js          三組背景、ERD（資料表／關聯／狀態值／畫布位置）與 12 題內容  ← 改題目只改這裡
js/erd.js           ERD 文字版（AI Prompt 與純文字檢視用）
js/board.js         ERD 畫布：平移、縮放、拖曳資料表、全螢幕
js/prompt.js        題組級／情境級 AI Prompt 組裝
js/storage.js       localStorage 讀寫、損壞處理
js/export.js        匯出 Markdown／JSON
js/app.js           路由、畫面、自動儲存
tests/run.js        邏輯測試（不需安裝套件）
```

## 修改題目或 ERD

只需要編輯 `js/data.js`（新增資料表時記得在 `layout` 補上畫布位置）。畫面、ERD 畫布、ERD 文字版、AI Prompt 與匯出內容都由這份資料產生，不必改其他檔案。改完後執行測試確認資料完整：

```bash
node tests/run.js
```

## AI 提問如何運作

每個題組有「帶本題組去問 AI」、每個情境有「帶這題與我的回答去問 AI」。按下後會顯示組好的完整提問（教練規則、系統背景、ERD 文字結構、題目、驗收條件、學生回答），學生按「複製完整提問」，再自行開啟 ChatGPT／Claude／Gemini 貼上送出。

網站不會呼叫任何 AI API，也不會自動填入或送出；未作答時會產生請 AI 以提問引導的版本。

## 本機資料

- localStorage key：`seal-fde-scenario-v1`（輸入後 0.4 秒自動儲存，離開頁面時也會寫入）。
- 資料格式損壞時，原始內容會另存到 `seal-fde-scenario-v1-corrupt-backup`，並以空白資料繼續。
- 「清除本機資料」只會移除上述兩個 key。
- 資料不會跨裝置同步，請用首頁的「匯出作答」保存或繳交。

## 驗收結果

以 `node tests/run.js`（15 項）與 Chrome 實際操作驗證。

- [x] 首頁顯示三大題組，合計 12 個情境。
- [x] 每組 ERD 可正確顯示全部資料表與 PK/FK 關聯。
- [x] 每個情境有完整客戶背景、A/B/C 任務與驗收條件。
- [x] 每個回答欄位都接受自然語言，不要求 SQL。
- [x] 三個題組都具備「帶本題組去問 AI」按鈕。
- [x] 12 個情境都具備「帶這題與我的回答去問 AI」按鈕。
- [x] AI Prompt 包含正確題目、ERD 文字結構、回答與教練規則。
- [x] 題組級 Prompt 包含該組四題及各自的回答，不混入其他組資料。
- [x] 未作答時也能產生引導型 Prompt。
- [x] Prompt 可複製；剪貼簿不可用時改為全選內容並提示手動複製。
- [x] AI 連結以新分頁開啟，文案說明需自行貼上送出。
- [x] 重新整理頁面後答案與完成狀態保留。
- [x] 匯出 Markdown 的中文、換行與完整題目編號正確。
- [x] 窄版畫面無橫向溢出，ERD 畫布可拖曳、縮放與全螢幕，AI 對話框可用（Chrome 視窗最窄只能縮到約 600px，未在實體手機上測試）。
- [x] 清除本機資料需確認，且不會清除其他 key。
- [x] 不包含 API Secret、資料上傳或追蹤程式。
