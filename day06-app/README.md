# Day 06 部署實作：範例應用程式

課程報名系統（題組 A 的資料表），由三個容器組成：

| 服務 | 內容 | 對外 |
| --- | --- | --- |
| `web` | Caddy：提供 `web/` 的前端頁面，把 `/api` 轉給 `api` | 80、443 |
| `api` | Node.js：報名、模擬付款、健康檢查 | 不對外 |
| `db` | PostgreSQL 17：資料存在 `db_data` volume，首次啟動執行 `db/init.sql` | 不對外 |

完整的上課步驟在網站的「Day 06」頁面。只想在自己電腦或任何有 Docker 的機器上跑起來：

```bash
cp .env.example .env        # 並修改 POSTGRES_PASSWORD
docker compose up -d --build
curl -s localhost/api/health
```

開啟 <http://localhost/>。停止：`docker compose down`（加 `-v` 會連資料一起刪除）。

有網域時，把 `.env` 的 `SITE_ADDRESS` 改成網域再 `docker compose up -d`，Caddy 會自動申請 HTTPS 憑證。

## API

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/health` | API 與資料庫是否正常 |
| GET | `/api/courses` | 已上架課程與已佔用名額 |
| GET | `/api/enrollments` | 最近 50 筆報名 |
| POST | `/api/enrollments` | 報名，內容 `{ "name", "email", "courseId" }`；額滿或重複報名回 409 |
| POST | `/api/enrollments/:id/pay` | 模擬付款成功：新增付款紀錄並把報名改為已付款 |
