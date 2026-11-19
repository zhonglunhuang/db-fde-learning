/* 海豹學院 Day 06 範例 API：報名課程與付款。
   連線設定來自環境變數 PGHOST／PGDATABASE／PGUSER／PGPASSWORD（由 docker-compose.yml 傳入）。 */
const http = require('node:http');
const os = require('node:os');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const pool = new Pool({ max: 5, connectionTimeoutMillis: 3000 });
// 資料庫重啟時，閒置連線會報錯；記錄下來即可，下一次查詢會自動重新連線。
pool.on('error', (e) => console.error('資料庫連線中斷：' + e.message));
const PORT = process.env.PORT || 3000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 10000) reject(new HttpError(413, '內容太長'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new HttpError(400, 'JSON 格式錯誤'));
      }
    });
    req.on('error', reject);
  });
}

async function health() {
  const r = await pool.query('SELECT now() AS db_time, (SELECT count(*)::int FROM courses) AS courses');
  return { ok: true, db: 'connected', dbTime: r.rows[0].db_time, courses: r.rows[0].courses, container: os.hostname() };
}

async function listCourses() {
  const r = await pool.query(
    `SELECT c.id, c.title, c.price::int AS price, c.capacity,
            count(e.id) FILTER (WHERE e.status IN ('pending', 'paid'))::int AS taken
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id
      WHERE c.status = 'published'
      GROUP BY c.id
      ORDER BY c.id`
  );
  return r.rows;
}

async function listEnrollments() {
  const r = await pool.query(
    `SELECT e.id, s.name AS student, c.title AS course, c.price::int AS price, e.status, e.enrolled_at
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN courses c ON c.id = e.course_id
      ORDER BY e.id DESC
      LIMIT 50`
  );
  return r.rows;
}

/** 報名：同一個 email 視為同一位學生；名額滿了或重複報名都會被擋下。 */
async function createEnrollment(body) {
  const name = String(body.name || '').trim().slice(0, 50);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
  const courseId = Number(body.courseId);
  if (!name) throw new HttpError(400, '請填寫姓名');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Email 格式不正確');
  if (!Number.isInteger(courseId)) throw new HttpError(400, '請選擇課程');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 鎖住這門課，避免兩個人同時搶最後一個名額。
    const course = (await client.query("SELECT id, capacity FROM courses WHERE id = $1 AND status = 'published' FOR UPDATE", [courseId])).rows[0];
    if (!course) throw new HttpError(404, '找不到這門課程');
    const taken = (await client.query("SELECT count(*)::int AS n FROM enrollments WHERE course_id = $1 AND status IN ('pending', 'paid')", [courseId])).rows[0].n;
    if (taken >= course.capacity) throw new HttpError(409, '這門課程已額滿');
    const student = (await client.query(
      `INSERT INTO students (name, email) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`, [name, email])).rows[0];
    const dup = (await client.query('SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2', [student.id, courseId])).rows[0];
    if (dup) throw new HttpError(409, '這個 Email 已經報名過這門課程');
    const enrollment = (await client.query(
      'INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) RETURNING id, status', [student.id, courseId])).rows[0];
    await client.query('COMMIT');
    return enrollment;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** 模擬付款成功：新增一筆付款紀錄，並把報名改成已付款（同一個交易內完成）。 */
async function payEnrollment(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const e = (await client.query(
      `SELECT e.id, e.status, c.price FROM enrollments e JOIN courses c ON c.id = e.course_id
        WHERE e.id = $1 FOR UPDATE OF e`, [id])).rows[0];
    if (!e) throw new HttpError(404, '找不到這筆報名');
    if (e.status !== 'pending') throw new HttpError(409, '這筆報名不是待付款狀態');
    const txn = 'TXN-' + crypto.randomUUID().slice(0, 13).toUpperCase();
    await client.query(
      "INSERT INTO payments (enrollment_id, transaction_no, amount, status, paid_at) VALUES ($1, $2, $3, 'success', now())",
      [id, txn, e.price]);
    await client.query("UPDATE enrollments SET status = 'paid' WHERE id = $1", [id]);
    await client.query('COMMIT');
    return { id: Number(id), status: 'paid', transactionNo: txn };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname.replace(/\/+$/, '');
  const started = Date.now();
  let status = 200;
  try {
    let m;
    if (req.method === 'GET' && path === '/api/health') send(res, 200, await health());
    else if (req.method === 'GET' && path === '/api/courses') send(res, 200, await listCourses());
    else if (req.method === 'GET' && path === '/api/enrollments') send(res, 200, await listEnrollments());
    else if (req.method === 'POST' && path === '/api/enrollments') send(res, (status = 201), await createEnrollment(await readJson(req)));
    else if (req.method === 'POST' && (m = path.match(/^\/api\/enrollments\/(\d+)\/pay$/))) send(res, 200, await payEnrollment(m[1]));
    else throw new HttpError(404, '沒有這個 API');
  } catch (e) {
    status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) send(res, status, { error: status === 500 ? '伺服器錯誤，請查看 api 的 log' : e.message });
  }
  console.log(`${req.method} ${path} ${status} ${Date.now() - started}ms`);
});

server.listen(PORT, () => console.log(`API 已啟動，port ${PORT}`));

// docker compose down／restart 時優雅關閉。
process.on('SIGTERM', () => server.close(() => pool.end().then(() => process.exit(0))));
