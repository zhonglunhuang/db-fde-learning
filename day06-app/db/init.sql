-- 題組 A「線上課程管理系統」的資料表與範例資料。
-- 只在資料庫第一次啟動（db_data volume 是空的）時執行。

CREATE TABLE students (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(50)  NOT NULL,
  email      VARCHAR(120) NOT NULL UNIQUE,
  status     VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id       BIGSERIAL PRIMARY KEY,
  title    VARCHAR(120)   NOT NULL,
  price    NUMERIC(10, 0) NOT NULL,
  capacity INT            NOT NULL,
  status   VARCHAR(20)    NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed'))
);

CREATE TABLE enrollments (
  id          BIGSERIAL PRIMARY KEY,
  student_id  BIGINT      NOT NULL REFERENCES students (id),
  course_id   BIGINT      NOT NULL REFERENCES courses (id),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired', 'refunded')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE TABLE payments (
  id             BIGSERIAL PRIMARY KEY,
  enrollment_id  BIGINT         NOT NULL REFERENCES enrollments (id),
  transaction_no VARCHAR(40)    NOT NULL UNIQUE,
  amount         NUMERIC(10, 0) NOT NULL,
  status         VARCHAR(20)    NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

INSERT INTO courses (title, price, capacity, status) VALUES
  ('資料庫思維入門', 3600, 30, 'published'),
  ('FDE 商業情境實戰', 12000, 5, 'published'),
  ('雲端部署一日通', 4800, 3, 'published'),
  ('進階資料建模（籌備中）', 9800, 20, 'draft');

INSERT INTO students (name, email) VALUES
  ('王小明', 'ming@example.com'),
  ('陳美玲', 'meiling@example.com');

INSERT INTO enrollments (student_id, course_id, status) VALUES
  (1, 1, 'paid'),
  (2, 3, 'pending');

INSERT INTO payments (enrollment_id, transaction_no, amount, status, paid_at) VALUES
  (1, 'TXN-SEED-0001', 3600, 'success', now());
