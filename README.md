# Turtle Survivor

海龜主角的 survivors-like 純靜態網頁遊戲 prototype，可直接部署到 GitHub Pages。

## 專案內容

- 主角：海龜
- 敵人：蝦子、螃蟹、龍蝦
- 武器：
  - 浣熊迫擊砲
  - 兔子迴旋刃
  - 星星防護罩
- 系統：
  - 敵人追擊
  - 經驗掉落與吸取
  - 升級三選一
  - 被動能力
  - Game Over

## 專案結構

- `index.html`：遊戲頁面
- `style.css`：畫面樣式
- `game.js`：遊戲主程式

## 本地開啟方式

因為這版是純靜態網站，不一定需要 Node.js。

### 方式 1：直接雙擊
直接用瀏覽器開啟 `index.html`。

### 方式 2：GitHub Pages
把整個資料夾推到 GitHub repository，然後在 repository 設定中啟用 GitHub Pages：

- Settings
- Pages
- Build and deployment
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

部署後網址通常會是：

- `https://<你的 GitHub 帳號>.github.io/<repo 名稱>/`

## 注意事項

- 已使用相對路徑 `./style.css` 與 `./game.js`，適合 GitHub Pages 子路徑部署。
- 目前使用 placeholder 幾何圖形，重點是先驗證玩法。

## 下一步建議

- 調整前期難度與出怪節奏
- 補升級平衡
- 加入音效與命中特效
- 補精英怪 / Boss
