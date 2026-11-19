/* Day 06 部署實作的全部內容。修改步驟或指令只需要改這個檔案。
   指令中的 {{IP}}、{{DOMAIN}} 會換成學員在頁面上填的 Droplet IP 與網域。
   where：local = 自己電腦的終端機、server = 已連線的 Droplet、web = 瀏覽器。 */
(function (root) {
  var FDE = (root.FDE = root.FDE || {});

  var REPO = 'https://github.com/zhonglunhuang/db-fde-learning.git';

  FDE.lab = {
    id: 'day06',
    title: 'Day 06｜部署實作',
    lead: '在 DigitalOcean 開一台機器，把前端、API 與資料庫部署上線',
    repo: REPO,
    hostname: 'seal-day06',
    architecture: [
      { name: '瀏覽器', sub: '你的電腦' },
      { name: 'Caddy', sub: 'web・port 80／443' },
      { name: 'Node.js API', sub: 'api・不對外' },
      { name: 'PostgreSQL', sub: 'db・不對外' },
    ],
    prerequisites: [
      'DigitalOcean 帳號（註冊需要信用卡或 PayPal）。',
      '終端機：macOS 用「終端機」，Windows 用「PowerShell」。',
      '費用：約 US$6／月的方案按秒計費，一堂課不到 US$0.1。下課前務必完成最後一節「刪除機器」。',
    ],
    sections: [
      {
        id: 'key',
        title: '建立 SSH 金鑰',
        goal: '用金鑰取代密碼登入機器。',
        steps: [
          {
            id: 'key-1', where: 'local',
            text: '產生金鑰，三個問題都直接按 Enter。已經有 id_ed25519 的人跳過這一步。',
            cmd: 'ssh-keygen -t ed25519 -C "seal-day06"',
          },
          {
            id: 'key-2', where: 'local',
            text: '顯示公鑰，複製整行。',
            cmd: 'cat ~/.ssh/id_ed25519.pub',
            expect: '一行以 ssh-ed25519 開頭的文字。',
            note: '只能給別人 .pub 結尾的公鑰；沒有 .pub 的那個檔案是私鑰，不要貼給任何人或 AI。',
          },
        ],
      },
      {
        id: 'droplet',
        title: '開一台 Droplet',
        goal: '在 DigitalOcean 建立一台 Ubuntu 機器。',
        steps: [
          {
            id: 'droplet-1', where: 'web',
            text: '登入 cloud.digitalocean.com，右上角 Create → Droplets，依序選擇：',
            list: [
              'Region：Singapore（SGP1）',
              'Image：Ubuntu 24.04 (LTS) x64',
              'Size：Basic → Regular → 1 GB／1 CPU（約 US$6／月）',
              'Authentication：SSH Key → New SSH Key，貼上剛才複製的公鑰',
              'Hostname：seal-day06',
              '其他加購項目（Backups、Volume、Database）都不要勾',
            ],
          },
          {
            id: 'droplet-2', where: 'web',
            text: '按 Create Droplet，約一分鐘後複製機器的 IPv4 位址，貼到本頁上方的「Droplet IP」欄位。',
            expect: '本頁所有指令裡的「你的IP」都換成你的 IP。',
          },
        ],
      },
      {
        id: 'secure',
        title: '連線與基本安全設定',
        goal: '登入機器、更新系統、開防火牆、改用一般使用者操作。',
        steps: [
          {
            id: 'secure-1', where: 'local',
            text: '用 root 連線，第一次會問是否信任這台機器，輸入 yes。',
            cmd: 'ssh root@{{IP}}',
            expect: '提示字元變成 root@seal-day06。',
          },
          {
            id: 'secure-2', where: 'server',
            text: '更新系統套件，約 2–5 分鐘。',
            cmd: 'apt update && DEBIAN_FRONTEND=noninteractive apt -y upgrade',
          },
          {
            id: 'secure-3', where: 'server',
            text: '開啟防火牆，只放行 SSH、HTTP、HTTPS。',
            cmd: 'ufw allow OpenSSH\nufw allow 80/tcp\nufw allow 443/tcp\nufw --force enable\nufw status',
            expect: 'Status: active，清單內有 OpenSSH、80/tcp、443/tcp。',
          },
          {
            id: 'secure-4', where: 'server',
            text: '建立日常操作用的 deploy 使用者，並沿用同一把金鑰。',
            cmd: 'adduser --disabled-password --gecos "" deploy\nusermod -aG sudo deploy\necho "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy\nchmod 440 /etc/sudoers.d/deploy\ncp -r /root/.ssh /home/deploy/\nchown -R deploy:deploy /home/deploy/.ssh',
          },
          {
            id: 'secure-5', where: 'local',
            text: '輸入 exit 離開 root，改用 deploy 重新連線。之後的步驟都用 deploy。',
            cmd: 'ssh deploy@{{IP}}',
            expect: '提示字元變成 deploy@seal-day06。',
          },
        ],
      },
      {
        id: 'docker',
        title: '安裝 Docker',
        goal: '讓機器能執行容器。',
        steps: [
          {
            id: 'docker-1', where: 'server',
            text: '用官方腳本安裝 Docker，並允許 deploy 使用。',
            cmd: 'curl -fsSL https://get.docker.com | sudo sh\nsudo usermod -aG docker deploy',
          },
          {
            id: 'docker-2', where: 'local',
            text: '輸入 exit 後重新連線，群組設定才會生效。',
            cmd: 'ssh deploy@{{IP}}',
          },
          {
            id: 'docker-3', where: 'server',
            text: '確認 Docker 可以運作。',
            cmd: 'docker run --rm hello-world\ndocker compose version',
            expect: 'Hello from Docker!，以及 Docker Compose 的版本號。',
          },
        ],
      },
      {
        id: 'deploy',
        title: '部署應用程式',
        goal: '把課程報名系統（題組 A 的資料表）跑起來。',
        steps: [
          {
            id: 'deploy-1', where: 'server',
            text: '下載程式碼，進入範例應用程式的資料夾。',
            cmd: 'git clone ' + REPO + '\ncd db-fde-learning/day06-app',
          },
          {
            id: 'deploy-2', where: 'server',
            text: '建立設定檔 .env，並產生一組隨機的資料庫密碼。',
            cmd: 'cp .env.example .env\nsed -i "s/change-me/$(openssl rand -hex 16)/" .env\ncat .env',
            expect: 'POSTGRES_PASSWORD= 後面是一串亂碼，不是 change-me。',
            note: '密碼放在 .env、不進 git，是部署時管理機密的基本做法。',
          },
          {
            id: 'deploy-3', where: 'server',
            text: '建置並啟動三個容器，約 1–2 分鐘。',
            cmd: 'docker compose up -d --build',
          },
          {
            id: 'deploy-4', where: 'server',
            text: '確認三個容器都在執行，並從機器內部呼叫 API。',
            cmd: 'docker compose ps\ncurl -s localhost/api/health',
            expect: 'db、api、web 的狀態都是 Up（db 為 healthy），API 回傳 "ok":true。',
          },
          {
            id: 'deploy-5', where: 'web',
            text: '用瀏覽器開啟你的網站，送出一筆報名，再按「模擬付款」。',
            link: 'http://{{IP}}',
            expect: '頁面上方顯示綠色的「API 與資料庫連線正常」，報名狀態從待付款變成已付款。',
          },
        ],
      },
      {
        id: 'operate',
        title: '維運：看 log、查資料、處理故障',
        goal: '上線之後，知道去哪裡找答案。',
        steps: [
          {
            id: 'operate-1', where: 'server',
            text: '即時查看 API 的 log，同時在瀏覽器操作網站。按 Ctrl+C 離開。',
            cmd: 'docker compose logs -f api',
            expect: '每次操作都多一行，例如 POST /api/enrollments 201。',
          },
          {
            id: 'operate-2', where: 'server',
            text: '直接查資料庫，確認剛才的報名與付款真的寫進去了。',
            cmd: 'docker compose exec db psql -U academy -d academy -c "SELECT e.id, s.name, c.title, e.status FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id ORDER BY e.id;"\ndocker compose exec db psql -U academy -d academy -c "SELECT * FROM payments;"',
            expect: '看得到你的報名，以及對應的付款紀錄。',
          },
          {
            id: 'operate-3', where: 'server',
            text: '製造一次故障：停掉資料庫，重新整理網頁，再看 API 的 log。',
            cmd: 'docker compose stop db\ndocker compose logs --tail 20 api',
            expect: '網頁上方變成紅色；log 出現連不到 db 的錯誤。',
          },
          {
            id: 'operate-4', where: 'server',
            text: '修復：把資料庫開回來，重新整理網頁。',
            cmd: 'docker compose start db',
            expect: '網頁恢復綠色，先前的報名資料都還在。',
          },
          {
            id: 'operate-5', where: 'server',
            text: '把全部容器移除再重建，確認資料不會消失。',
            cmd: 'docker compose down\ndocker compose up -d',
            expect: '重新整理網頁，報名紀錄仍在。',
            note: '資料存在 volume 裡，不在容器裡。只有 docker compose down -v 才會連資料一起刪除。',
          },
        ],
      },
      {
        id: 'https',
        title: '選修：網域與 HTTPS',
        optional: true,
        goal: '有自己網域的人，把網站換成 https://。',
        steps: [
          {
            id: 'https-1', where: 'web',
            text: '到你的網域 DNS 管理介面新增一筆 A 紀錄指向 {{IP}}，並把網域填到本頁上方的「網域」欄位。',
          },
          {
            id: 'https-2', where: 'server',
            text: '確認 DNS 已經生效。',
            cmd: 'getent hosts {{DOMAIN}}',
            expect: '顯示的 IP 與你的 Droplet IP 相同。沒有輸出就再等幾分鐘。',
          },
          {
            id: 'https-3', where: 'server',
            text: '把網站位址改成網域並重啟，Caddy 會自動申請憑證。',
            cmd: 'cd ~/db-fde-learning/day06-app\nsed -i "s/^SITE_ADDRESS=.*/SITE_ADDRESS={{DOMAIN}}/" .env\ndocker compose up -d\ndocker compose logs --tail 30 web',
            expect: 'log 出現 certificate obtained successfully。',
          },
          {
            id: 'https-4', where: 'web',
            text: '用 https 開啟網站。',
            link: 'https://{{DOMAIN}}',
            expect: '網址列出現鎖頭。',
          },
        ],
      },
      {
        id: 'destroy',
        title: '刪除機器',
        goal: '停止計費。這一節一定要做。',
        steps: [
          {
            id: 'destroy-1', where: 'web',
            text: '到 DigitalOcean 控制台點進 seal-day06 → Destroy → Destroy this Droplet，輸入機器名稱確認。',
            note: '只關機（Power off）仍然會繼續計費，必須 Destroy。',
          },
          {
            id: 'destroy-2', where: 'web',
            text: '確認 Droplets 清單是空的。有設定 DNS 紀錄的人一併刪除。',
            expect: '清單中沒有任何機器。',
          },
        ],
      },
    ],
    faq: [
      { q: 'ssh 出現 Permission denied (publickey)', a: '建立 Droplet 時沒有選到你的金鑰，或公鑰貼錯。最快的做法是 Destroy 這台機器，重新建立並確認勾選了你的 SSH Key。' },
      { q: 'ssh 出現 Connection timed out', a: 'IP 填錯，或機器還在開機。回 DigitalOcean 控制台確認 IP，等一分鐘再試。' },
      { q: 'apt 出現 Could not get lock', a: '新機器開機後會自動在背景更新。等一兩分鐘再執行一次同樣的指令。' },
      { q: 'docker 出現 permission denied … docker.sock', a: '還沒有重新登入。輸入 exit 後重新 ssh deploy@你的IP。' },
      { q: 'docker compose 出現「請先建立 .env」', a: '不在 day06-app 資料夾，或還沒執行建立 .env 的步驟。先 cd ~/db-fde-learning/day06-app。' },
      { q: '瀏覽器打不開 http://你的IP', a: '確認網址是 http 不是 https。在機器上執行 docker compose ps 看 web 是否 Up，並用 sudo ufw status 確認 80/tcp 已放行。' },
      { q: '改了 .env 的密碼之後 API 連不上資料庫', a: '資料庫密碼只在第一次啟動時設定。練習環境可以執行 docker compose down -v 清空資料後重新 up。' },
    ],
  };

  /** 把指令中的佔位符換成學員填的值；沒填時顯示中文提示字。 */
  FDE.lab.fill = function (text, ctx) {
    var ip = ctx && ctx.ip ? ctx.ip : '你的IP';
    var domain = ctx && ctx.domain ? ctx.domain : '你的網域';
    return String(text).replace(/\{\{IP\}\}/g, ip).replace(/\{\{DOMAIN\}\}/g, domain);
  };

  FDE.lab.allSteps = function () {
    return FDE.lab.sections.reduce(function (acc, s) { return acc.concat(s.steps); }, []);
  };

  /** 必做步驟（不含選修）的總數與完成數。 */
  FDE.lab.progress = function (done) {
    var total = 0;
    var finished = 0;
    FDE.lab.sections.forEach(function (s) {
      if (s.optional) return;
      s.steps.forEach(function (st) {
        total += 1;
        if (done && done[st.id]) finished += 1;
      });
    });
    return { total: total, done: finished };
  };

  FDE.lab.isIp = function (v) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v || '');
    return !!m && m.slice(1).every(function (n) { return Number(n) <= 255; });
  };

  FDE.lab.isDomain = function (v) {
    return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(v || '');
  };
})(typeof window !== 'undefined' ? window : globalThis);
