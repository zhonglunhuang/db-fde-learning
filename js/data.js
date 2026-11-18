/* 三大題組、12 個情境的完整內容。修改題目、ERD 或狀態定義時只需要改這個檔案；
   畫面、ERD 圖、ERD 文字版與 AI Prompt 都由這份資料產生。 */
(function (root) {
  var FDE = (root.FDE = root.FDE || {});
  FDE.groups = [
    {
      id: 'A',
    /* ERD 畫布上各資料表的預設位置 [x, y] */
    layout: { students: [0, 0], courses: [0, 250], enrollments: [340, 120], payments: [680, 90] },
      name: '海豹學院線上課程管理系統',
      intro: '報名、付款、退款與名額限制：從一筆報名看懂金流與狀態的關係。',
      background:
        '海豹學院經營線上課程平台，目前約有 500 位學生、20 門課程。學生報名課程後需完成付款才能上課；平台串接第三方金流，支援付款與退款，每門課程都有名額上限。一筆報名可能對應多筆付款紀錄（例如第一次付款失敗後重試）。',
      tables: [
        {
          name: 'students',
          label: '學生',
          desc: '學生帳號的基本資料',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '學生編號' },
            { name: 'name', type: 'VARCHAR', desc: '姓名' },
            { name: 'email', type: 'VARCHAR', key: 'UK', desc: '電子信箱（不可重複）' },
            { name: 'status', type: 'ENUM', desc: '帳號狀態' },
            { name: 'created_at', type: 'DATETIME', desc: '註冊時間' },
          ],
        },
        {
          name: 'courses',
          label: '課程',
          desc: '課程的售價、名額與上架狀態',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '課程編號' },
            { name: 'title', type: 'VARCHAR', desc: '課程名稱' },
            { name: 'price', type: 'DECIMAL', desc: '課程售價' },
            { name: 'capacity', type: 'INT', desc: '名額上限' },
            { name: 'status', type: 'ENUM', desc: '課程狀態' },
          ],
        },
        {
          name: 'enrollments',
          label: '報名',
          desc: '某位學生報名某門課程的紀錄',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '報名編號' },
            { name: 'student_id', type: 'BIGINT', key: 'FK', desc: '報名的學生' },
            { name: 'course_id', type: 'BIGINT', key: 'FK', desc: '報名的課程' },
            { name: 'status', type: 'ENUM', desc: '報名狀態' },
            { name: 'enrolled_at', type: 'DATETIME', desc: '報名時間' },
          ],
        },
        {
          name: 'payments',
          label: '付款',
          desc: '某筆報名的付款交易紀錄',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '付款編號' },
            { name: 'enrollment_id', type: 'BIGINT', key: 'FK', desc: '對應的報名' },
            { name: 'transaction_no', type: 'VARCHAR', key: 'UK', desc: '金流交易序號（不可重複）' },
            { name: 'amount', type: 'DECIMAL', desc: '交易金額' },
            { name: 'status', type: 'ENUM', desc: '付款狀態' },
            { name: 'paid_at', type: 'DATETIME', desc: '付款成功時間' },
            { name: 'created_at', type: 'DATETIME', desc: '付款紀錄建立時間' },
          ],
        },
      ],
      relations: [
        { one: 'students', many: 'enrollments', fk: 'student_id', verb: 'enrolls', desc: '一位學生可以有多筆報名' },
        { one: 'courses', many: 'enrollments', fk: 'course_id', verb: 'contains', desc: '一門課程可以有多筆報名' },
        { one: 'enrollments', many: 'payments', fk: 'enrollment_id', verb: 'has', desc: '一筆報名可以有多筆付款紀錄' },
      ],
      statuses: [
        {
          field: 'students.status',
          values: [
            { value: 'active', meaning: '啟用' },
            { value: 'disabled', meaning: '停用' },
          ],
        },
        {
          field: 'courses.status',
          values: [
            { value: 'draft', meaning: '草稿' },
            { value: 'published', meaning: '已上架' },
            { value: 'closed', meaning: '已關閉' },
          ],
        },
        {
          field: 'enrollments.status',
          values: [
            { value: 'pending', meaning: '待付款' },
            { value: 'paid', meaning: '已付款' },
            { value: 'cancelled', meaning: '已取消' },
            { value: 'expired', meaning: '逾期未付款' },
            { value: 'refunded', meaning: '已退款' },
          ],
        },
        {
          field: 'payments.status',
          values: [
            { value: 'pending', meaning: '處理中' },
            { value: 'success', meaning: '付款成功' },
            { value: 'failed', meaning: '付款失敗' },
            { value: 'refunded', meaning: '已退款' },
          ],
        },
      ],
      notes: [],
      scenarios: [
        {
          id: 'A1',
          title: '付款後無法上課',
          summary: '15 位學生扣款成功，但課程仍顯示待付款。',
          clientQuote:
            '客服這兩天接到一堆抱怨，大概有 15 位學生說信用卡已經扣款成功，可是進到課程頁面還是顯示「待付款」，沒辦法上課。可以幫我們查一下是怎麼回事，然後趕快處理嗎？',
          tasks: {
            investigation:
              '你會如何找出所有受影響的學生與交易？請說明要看哪些資料、用什麼條件判斷「已扣款但未開通」，以及如何確認名單完整（不只客服回報的 15 位）。',
            solution:
              '你會如何安全地修復這些報名紀錄？請說明修改前要做哪些準備、如何避免改到不該改的資料，以及修改後如何驗證結果正確。',
            edgeCase:
              '追加情境：你進一步發現這 15 筆當中，有 3 筆後來已經退款。原本的方案需要如何調整？這 3 筆應該怎麼處理？',
          },
          acceptance: [
            '能清楚定義「受影響紀錄」的判斷條件，並確認名單完整。',
            '修復前保留異常清單，修復後有比對與驗證。',
            '不會錯誤開通已退款的課程。',
          ],
          focusTables: ['students', 'enrollments', 'payments'],
        },
        {
          id: 'A2',
          title: '營收對不起來',
          summary: '系統營收 150 萬，金流對帳單只有 138 萬。',
          clientQuote:
            '財務說上個月系統後台顯示的課程營收是 150 萬，但金流公司對帳單上只有 138 萬，差了 12 萬。老闆要我明天給個說法，到底哪個數字才對？',
          tasks: {
            investigation:
              '你會如何定義每門課程的「成功付款金額」、「退款金額」與「淨收款」？請說明各自要看哪些資料、用什麼條件計算。',
            solution:
              '你會如何追查這 12 萬的差異來源？請說明如何檢查重複付款與退款造成的差異，以及如何和金流對帳單核對。',
            edgeCase:
              '追加情境：有些學生在月底付款，但銀行隔月才實際入帳。這會如何影響對帳？現有的資料足以區分這兩個時間點嗎？',
          },
          acceptance: [
            '三個金額指標定義明確，計算口徑前後一致。',
            '不混淆「付款成功」與「實際入帳」。',
            '能指出現有 ERD 缺少哪些資料（缺口）以及為什麼需要。',
          ],
          focusTables: ['courses', 'enrollments', 'payments'],
        },
        {
          id: 'A3',
          title: '課程超收',
          summary: '容量 20 人的課程，卻有 21 人報名成功。',
          clientQuote:
            '「資料庫入門實戰班」明明設定只收 20 人，結果現在有 21 個人報名成功，教室坐不下。這已經不是第一次了，可以查一下還有哪些課也超收，然後讓它不要再發生嗎？',
          tasks: {
            investigation:
              '你會如何找出所有超收的課程？請說明哪些報名狀態應該算「佔用名額」，以及如何和課程的名額上限比較。',
            solution:
              '兩位學生幾乎同時報名最後一個名額時，為什麼會造成超收？你會如何設計報名流程來防止，並驗證這個設計真的有效？',
            edgeCase:
              '追加情境：業務希望「報名後 15 分鐘內未付款，就自動釋出名額」。佔用名額的定義與流程要如何調整？有哪些例外需要處理（例如第 16 分鐘才付款成功）？',
          },
          acceptance: [
            '明確定義哪些報名狀態佔用名額。',
            '能說明同時報名（競爭條件）為什麼會超收，以及如何防止。',
            '說明保留期限如何運作，以及逾時後才付款成功的處理方式。',
          ],
          focusTables: ['courses', 'enrollments', 'payments'],
        },
        {
          id: 'A4',
          title: '學生統計不一致',
          summary: '學生列表 500 人，儀表板卻顯示 536 人。',
          clientQuote:
            '學生管理列表上寫總共 500 位學生，可是營運儀表板上的「學生數」卻是 536。兩邊都是我們自己的系統，為什麼數字不一樣？我要拿哪個數字去跟投資人報告？',
          tasks: {
            investigation:
              '你會如何追查 536 這個數字是怎麼算出來的？請說明什麼樣的資料關聯會讓同一位學生被重複計算，以及如何確認。',
            solution:
              '請定義「註冊學生數」、「已報名學生數」、「付費學生數」三個指標：各自的計算對象與條件是什麼？如何確保同一位學生不被重複計算？',
            edgeCase:
              '追加情境：有些帳號已被停用，但仍保留歷史報名與付款紀錄。這三個指標要不要把他們算進去？如何讓列表與儀表板的數字一致？',
          },
          acceptance: [
            '找出重複計數的原因。',
            '三個指標定義清楚，同一位學生不重複計算。',
            '停用帳號的處理規則明確，各報表的統計口徑一致。',
          ],
          focusTables: ['students', 'enrollments', 'payments'],
        },
      ],
    },
    {
      id: 'B',
    /* ERD 畫布上各資料表的預設位置 [x, y] */
    layout: { customers: [0, 0], coupon_redemptions: [0, 260], orders: [340, 40], order_payments: [340, 300], order_items: [680, 0], inventory_movements: [680, 290], products: [1020, 130] },
      name: '電商與庫存管理系統',
      intro: '毛利、庫存、折價券與報表效能：促銷之後才浮現的營運問題。',
      background:
        '一家電商公司約有 3,000 位會員、200 種商品，每月約 5,000 筆訂單。最近舉辦大型促銷後，陸續出現毛利偏低、庫存超賣、折價券被重複領取與報表變慢等營運問題。訂單明細會記錄下單當時的售價與成本；庫存的每一次增減都會記錄成一筆庫存異動。',
      tables: [
        {
          name: 'customers',
          label: '會員',
          desc: '會員帳號的基本資料',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '會員編號' },
            { name: 'name', type: 'VARCHAR', desc: '姓名' },
            { name: 'email', type: 'VARCHAR', key: 'UK', desc: '電子信箱（不可重複）' },
            { name: 'phone', type: 'VARCHAR', desc: '電話（可重複）' },
            { name: 'status', type: 'ENUM', desc: '帳號狀態' },
          ],
        },
        {
          name: 'products',
          label: '商品',
          desc: '商品目前的售價、成本與庫存',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '商品編號' },
            { name: 'name', type: 'VARCHAR', desc: '商品名稱' },
            { name: 'price', type: 'DECIMAL', desc: '目前售價' },
            { name: 'cost', type: 'DECIMAL', desc: '目前成本' },
            { name: 'stock', type: 'INT', desc: '目前庫存數量' },
            { name: 'status', type: 'ENUM', desc: '商品狀態' },
          ],
        },
        {
          name: 'orders',
          label: '訂單',
          desc: '會員的一筆訂單',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '訂單編號' },
            { name: 'customer_id', type: 'BIGINT', key: 'FK', desc: '下單的會員' },
            { name: 'status', type: 'ENUM', desc: '訂單狀態' },
            { name: 'discount_amount', type: 'DECIMAL', desc: '整筆訂單的折扣金額' },
            { name: 'created_at', type: 'DATETIME', desc: '下單時間' },
          ],
        },
        {
          name: 'order_items',
          label: '訂單明細',
          desc: '訂單中的每一項商品',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '明細編號' },
            { name: 'order_id', type: 'BIGINT', key: 'FK', desc: '所屬訂單' },
            { name: 'product_id', type: 'BIGINT', key: 'FK', desc: '購買的商品' },
            { name: 'quantity', type: 'INT', desc: '購買數量' },
            { name: 'unit_price', type: 'DECIMAL', desc: '下單當時的單價' },
            { name: 'unit_cost', type: 'DECIMAL', desc: '下單當時的單位成本' },
          ],
        },
        {
          name: 'order_payments',
          label: '訂單付款',
          desc: '訂單的付款交易紀錄',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '付款編號' },
            { name: 'order_id', type: 'BIGINT', key: 'FK', desc: '對應的訂單' },
            { name: 'transaction_no', type: 'VARCHAR', key: 'UK', desc: '金流交易序號（不可重複）' },
            { name: 'amount', type: 'DECIMAL', desc: '交易金額' },
            { name: 'status', type: 'ENUM', desc: '付款狀態' },
            { name: 'paid_at', type: 'DATETIME', desc: '付款成功時間' },
          ],
        },
        {
          name: 'inventory_movements',
          label: '庫存異動',
          desc: '商品庫存每一次增減的紀錄',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '異動編號' },
            { name: 'product_id', type: 'BIGINT', key: 'FK', desc: '異動的商品' },
            { name: 'order_id', type: 'BIGINT', key: 'FK', desc: '相關訂單（可為空，例如進貨或盤點）' },
            { name: 'quantity_change', type: 'INT', desc: '數量變化（正數為增加，負數為減少）' },
            { name: 'reason', type: 'VARCHAR', desc: '異動原因' },
            { name: 'created_at', type: 'DATETIME', desc: '異動時間' },
          ],
        },
        {
          name: 'coupon_redemptions',
          label: '折價券領取',
          desc: '會員領取折價券的紀錄',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '領取編號' },
            { name: 'customer_id', type: 'BIGINT', key: 'FK', desc: '領取的會員' },
            { name: 'coupon_code', type: 'VARCHAR', desc: '折價券代碼' },
            { name: 'redeemed_at', type: 'DATETIME', desc: '領取時間' },
          ],
        },
      ],
      relations: [
        { one: 'customers', many: 'orders', fk: 'customer_id', verb: 'places', desc: '一位會員可以有多筆訂單' },
        { one: 'customers', many: 'coupon_redemptions', fk: 'customer_id', verb: 'redeems', desc: '一位會員可以有多筆領券紀錄' },
        { one: 'orders', many: 'order_items', fk: 'order_id', verb: 'contains', desc: '一筆訂單包含多項商品明細' },
        { one: 'products', many: 'order_items', fk: 'product_id', verb: 'appears_in', desc: '一種商品可以出現在多筆訂單明細' },
        { one: 'orders', many: 'order_payments', fk: 'order_id', verb: 'has', desc: '一筆訂單可以有多筆付款紀錄' },
        { one: 'products', many: 'inventory_movements', fk: 'product_id', verb: 'tracks', desc: '一種商品有多筆庫存異動' },
        {
          one: 'orders',
          many: 'inventory_movements',
          fk: 'order_id',
          optional: true,
          verb: 'references',
          desc: '庫存異動可以對應一筆訂單，也可以不對應任何訂單',
        },
      ],
      statuses: [
        {
          field: 'customers.status',
          values: [
            { value: 'active', meaning: '啟用' },
            { value: 'disabled', meaning: '停用' },
          ],
        },
        {
          field: 'products.status',
          values: [
            { value: 'active', meaning: '販售中' },
            { value: 'inactive', meaning: '已下架' },
          ],
        },
        {
          field: 'orders.status',
          values: [
            { value: 'pending', meaning: '未付款' },
            { value: 'paid', meaning: '已付款、未出貨' },
            { value: 'shipped', meaning: '已出貨' },
            { value: 'completed', meaning: '已完成' },
            { value: 'cancelled', meaning: '已取消' },
            { value: 'refunded', meaning: '已退款' },
          ],
        },
        {
          field: 'order_payments.status',
          values: [
            { value: 'pending', meaning: '處理中' },
            { value: 'success', meaning: '付款成功' },
            { value: 'failed', meaning: '付款失敗' },
            { value: 'refunded', meaning: '已退款' },
          ],
        },
        {
          field: 'inventory_movements.reason（常見值）',
          values: [
            { value: 'purchase', meaning: '進貨' },
            { value: 'sale', meaning: '銷售扣減' },
            { value: 'return', meaning: '退貨歸還' },
            { value: 'adjustment', meaning: '盤點調整' },
          ],
        },
      ],
      notes: [
        'coupon_redemptions 應有 (customer_id, coupon_code) 複合唯一約束：同一位會員不能重複領取同一張折價券。',
        'order_items 的 unit_price 與 unit_cost 是下單當時的數值，不會隨 products 的售價或成本調整而改變。',
        'orders.discount_amount 記錄的是整筆訂單的折扣，沒有拆到個別商品。',
      ],
      scenarios: [
        {
          id: 'B1',
          title: '熱銷卻不賺錢',
          summary: '商品賣了 1,000 件、營收 80 萬，毛利卻很低。',
          clientQuote:
            '我們的主打商品上個月賣了 1,000 件、營收 80 萬，是全站銷售冠軍，可是財務說它幾乎沒賺錢。賣最好的商品怎麼可能不賺？幫我看一下到底哪些商品真的有賺。',
          tasks: {
            investigation:
              '你會如何分析各商品的銷量、營收與成本？請說明成本要採用哪一份資料、為什麼，以及哪些訂單應該納入計算。',
            solution:
              '你會如何比較「營收排行」與「毛利排行」，並向客戶說明兩者的差異？如何驗證你的計算是正確的？',
            edgeCase:
              '追加情境：部分訂單使用了折價券，也有訂單只退了其中幾項商品。這對各商品的毛利計算有什麼影響？現有的資料足以算到商品層級嗎？',
          },
          acceptance: [
            '成本採用下單當時的歷史成本，並說明理由。',
            '能區分營收與毛利，並解釋兩種排行為什麼不同。',
            '指出商品層級的折扣分攤與部分退款的資料缺口。',
          ],
          focusTables: ['products', 'orders', 'order_items', 'order_payments'],
        },
        {
          id: 'B2',
          title: '庫存超賣',
          summary: '庫存只有 10 件，卻賣出了 15 件。',
          clientQuote:
            '限量商品明明庫存只有 10 件，促銷當天卻賣出了 15 件，現在有 5 位客人拿不到貨，客服被罵翻了。先幫我算清楚到底缺多少，再想辦法讓這種事不要再發生。',
          tasks: {
            investigation:
              '你會如何計算這項商品的「待履行需求」與實際缺口？請說明要看哪些資料，以及如何確認目前庫存數量和庫存異動紀錄是否一致。',
            solution:
              '多位客人同時下單時，為什麼會發生超賣？你會如何設計扣庫存的流程來避免，並驗證它有效？',
            edgeCase:
              '追加情境：這些訂單有的未付款、有的已付款未出貨、有的已出貨。不同狀態對「可賣庫存」的影響有什麼不同？取消訂單時庫存如何歸還？',
          },
          acceptance: [
            '正確算出待履行需求與缺口。',
            '同一筆訂單的庫存不會被重複扣減。',
            '說明「預留庫存」與「出貨扣減」的差異，以及取消時如何歸還。',
          ],
          focusTables: ['products', 'orders', 'order_items', 'inventory_movements'],
        },
        {
          id: 'B3',
          title: '重複領券',
          summary: '疑似有人用不同 Email 註冊多個帳號，重複領新會員券。',
          clientQuote:
            '新會員 100 元折價券本來每人限領一次，但行銷發現有些人好像用不同 Email 註冊了好幾個帳號重複領。幫我把這些人抓出來，然後把漏洞堵起來。',
          tasks: {
            investigation:
              '你會如何找出可疑的會員？請說明哪些線索可以判斷「可能是同一個人」，以及每種線索的可信程度。',
            solution:
              '你會如何防止同一個帳號重複領取同一張券？對於「一人註冊多個帳號」又能做哪些防範？如何驗證？',
            edgeCase:
              '追加情境：客服提醒，有些家庭成員會共用同一支電話。你的判斷方式與處理方式要如何調整？',
          },
          acceptance: [
            '列出判斷可疑帳號的線索，並說明各自的限制。',
            '同一帳號無法重複領取同一張券，而且資料層面有保障。',
            '不將可疑資料直接當成同一人，保留人工確認的空間。',
          ],
          focusTables: ['customers', 'coupon_redemptions', 'orders'],
        },
        {
          id: 'B4',
          title: '報表變慢',
          summary: '訂單成長到百萬筆，報表從 0.2 秒變成 8 秒。',
          clientQuote:
            '訂單累積到一百萬筆之後，每天早上要看的銷售報表從 0.2 秒變成要等 8 秒，主管每天都在抱怨。可以讓它快回來嗎？',
          tasks: {
            investigation:
              '你會如何找出報表變慢的原因？請說明需要收集哪些資訊（報表在查什麼、資料量多大、時間花在哪裡），以及如何確認真正的瓶頸。',
            solution:
              '你會考慮哪些優化方向？如何選擇？如何驗證優化有效，而且報表數字沒有因此改變？',
            edgeCase:
              '追加情境：加了索引之後報表變快了，但下單寫入卻變慢。你會如何評估這個取捨？還有哪些替代做法？',
          },
          acceptance: [
            '先量測再優化，有優化前後的對照。',
            '能說明各方案的取捨與適用限制。',
            '確認優化後的報表數字與原本一致。',
          ],
          focusTables: ['orders', 'order_items', 'products'],
        },
      ],
    },
    {
      id: 'C',
    /* ERD 畫布上各資料表的預設位置 [x, y] */
    layout: { tenants: [0, 0], rooms: [0, 290], leases: [340, 80], rent_bills: [680, 0], deposit_deductions: [680, 270], deposit_refunds: [680, 510], rent_allocations: [1020, 0], bank_transactions: [1020, 240] },
      name: '海豹生活包租代管系統',
      intro: '租金對帳、房態、押金與個資：每一筆錢與每一份租約都要說得清楚。',
      background:
        '海豹生活是一家包租代管公司，管理約 100 間房，累積約 150 份歷史租約。系統記錄租客、房間、租約、每月租金帳單、銀行入帳交易，以及退租時的押金扣款與返還。一筆銀行交易可以分配到多張帳單，一張帳單也可以由多筆交易付清。因為涉及金流與個資，資料的正確性與可稽核性特別重要。',
      tables: [
        {
          name: 'tenants',
          label: '租客',
          desc: '租客的基本資料與聯絡方式',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '租客編號' },
            { name: 'name', type: 'VARCHAR', desc: '姓名' },
            { name: 'email', type: 'VARCHAR', desc: '電子信箱' },
            { name: 'phone', type: 'VARCHAR', desc: '電話' },
            { name: 'status', type: 'ENUM', desc: '租客狀態' },
            { name: 'created_at', type: 'DATETIME', desc: '建檔時間' },
          ],
        },
        {
          name: 'rooms',
          label: '房間',
          desc: '代管的房間與目前房態',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '房間編號' },
            { name: 'room_number', type: 'VARCHAR', key: 'UK', desc: '房號（不可重複）' },
            { name: 'monthly_rent', type: 'DECIMAL', desc: '目前定價月租' },
            { name: 'status', type: 'ENUM', desc: '房態' },
          ],
        },
        {
          name: 'leases',
          label: '租約',
          desc: '某位租客承租某間房的契約',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '租約編號' },
            { name: 'tenant_id', type: 'BIGINT', key: 'FK', desc: '承租的租客' },
            { name: 'room_id', type: 'BIGINT', key: 'FK', desc: '承租的房間' },
            { name: 'start_date', type: 'DATE', desc: '租期開始日' },
            { name: 'end_date', type: 'DATE', desc: '租期結束日' },
            { name: 'monthly_rent', type: 'DECIMAL', desc: '這份租約約定的月租' },
            { name: 'deposit_amount', type: 'DECIMAL', desc: '押金金額' },
            { name: 'status', type: 'ENUM', desc: '租約狀態' },
          ],
        },
        {
          name: 'rent_bills',
          label: '租金帳單',
          desc: '租約每個月產生的應收帳單',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '帳單編號' },
            { name: 'lease_id', type: 'BIGINT', key: 'FK', desc: '所屬租約' },
            { name: 'billing_month', type: 'DATE', desc: '帳單月份' },
            { name: 'amount', type: 'DECIMAL', desc: '應收金額' },
            { name: 'due_date', type: 'DATE', desc: '繳款期限' },
            { name: 'status', type: 'ENUM', desc: '帳單狀態' },
          ],
        },
        {
          name: 'bank_transactions',
          label: '銀行交易',
          desc: '銀行帳戶實際收到的每一筆匯款',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '交易編號' },
            { name: 'bank_reference', type: 'VARCHAR', key: 'UK', desc: '銀行交易序號（不可重複）' },
            { name: 'sender_name', type: 'VARCHAR', desc: '匯款人姓名' },
            { name: 'amount', type: 'DECIMAL', desc: '匯款金額' },
            { name: 'transferred_at', type: 'DATETIME', desc: '匯款時間' },
            { name: 'note', type: 'VARCHAR', desc: '匯款備註' },
          ],
        },
        {
          name: 'rent_allocations',
          label: '租金分配',
          desc: '把某筆銀行交易的金額分配給某張帳單',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '分配編號' },
            { name: 'bank_transaction_id', type: 'BIGINT', key: 'FK', desc: '來源銀行交易' },
            { name: 'rent_bill_id', type: 'BIGINT', key: 'FK', desc: '沖銷的帳單' },
            { name: 'allocated_amount', type: 'DECIMAL', desc: '分配金額' },
          ],
        },
        {
          name: 'deposit_deductions',
          label: '押金扣款',
          desc: '退租時從押金扣除的項目',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '扣款編號' },
            { name: 'lease_id', type: 'BIGINT', key: 'FK', desc: '所屬租約' },
            { name: 'description', type: 'VARCHAR', desc: '扣款說明' },
            { name: 'amount', type: 'DECIMAL', desc: '扣款金額' },
            { name: 'status', type: 'ENUM', desc: '扣款狀態' },
          ],
        },
        {
          name: 'deposit_refunds',
          label: '押金退款',
          desc: '押金返還給租客的紀錄',
          columns: [
            { name: 'id', type: 'BIGINT', key: 'PK', desc: '退款編號' },
            { name: 'lease_id', type: 'BIGINT', key: 'FK', desc: '所屬租約' },
            { name: 'amount', type: 'DECIMAL', desc: '退款金額' },
            { name: 'status', type: 'ENUM', desc: '退款狀態' },
            { name: 'refunded_at', type: 'DATETIME', desc: '退款完成時間' },
          ],
        },
      ],
      relations: [
        { one: 'tenants', many: 'leases', fk: 'tenant_id', verb: 'signs', desc: '一位租客可以有多份租約' },
        { one: 'rooms', many: 'leases', fk: 'room_id', verb: 'assigned_to', desc: '一間房可以有多份（不同時期的）租約' },
        { one: 'leases', many: 'rent_bills', fk: 'lease_id', verb: 'generates', desc: '一份租約產生多張租金帳單' },
        { one: 'rent_bills', many: 'rent_allocations', fk: 'rent_bill_id', verb: 'receives', desc: '一張帳單可以收到多筆分配' },
        {
          one: 'bank_transactions',
          many: 'rent_allocations',
          fk: 'bank_transaction_id',
          verb: 'allocated_to',
          desc: '一筆銀行交易可以分配到多張帳單',
        },
        { one: 'leases', many: 'deposit_deductions', fk: 'lease_id', verb: 'has', desc: '一份租約可以有多筆押金扣款' },
        { one: 'leases', many: 'deposit_refunds', fk: 'lease_id', verb: 'refunds', desc: '一份租約可以有多筆押金退款紀錄' },
      ],
      statuses: [
        {
          field: 'tenants.status',
          values: [
            { value: 'active', meaning: '承租中' },
            { value: 'inactive', meaning: '已無有效租約' },
          ],
        },
        {
          field: 'rooms.status',
          values: [
            { value: 'vacant', meaning: '可出租' },
            { value: 'occupied', meaning: '出租中' },
            { value: 'maintenance', meaning: '整理／維修中' },
          ],
        },
        {
          field: 'leases.status',
          values: [
            { value: 'draft', meaning: '待簽約' },
            { value: 'active', meaning: '生效中' },
            { value: 'ended', meaning: '到期結束' },
            { value: 'terminated', meaning: '提前終止' },
          ],
        },
        {
          field: 'rent_bills.status',
          values: [
            { value: 'unpaid', meaning: '未繳' },
            { value: 'partial', meaning: '部分繳納' },
            { value: 'paid', meaning: '已繳清' },
            { value: 'void', meaning: '作廢' },
          ],
        },
        {
          field: 'deposit_deductions.status',
          values: [
            { value: 'pending', meaning: '待審核' },
            { value: 'approved', meaning: '已核准' },
            { value: 'disputed', meaning: '爭議中' },
            { value: 'rejected', meaning: '已駁回' },
          ],
        },
        {
          field: 'deposit_refunds.status',
          values: [
            { value: 'pending', meaning: '處理中' },
            { value: 'success', meaning: '退款成功' },
            { value: 'failed', meaning: '退款失敗' },
          ],
        },
      ],
      notes: [
        'rent_bills 應有 (lease_id, billing_month) 複合唯一約束：同一份租約同一個月份只能有一張帳單。',
        'bank_transactions 與租客之間沒有直接關聯，必須透過 rent_allocations 才能知道一筆匯款付的是哪張帳單。',
      ],
      scenarios: [
        {
          id: 'C1',
          title: '租金對帳',
          summary: '應收 120 萬、12 筆未繳，其中 5 人提供了轉帳證明。',
          clientQuote:
            '這個月應收租金 120 萬，系統顯示還有 12 筆帳單沒繳。可是其中 5 位租客說他們早就轉帳了，還傳了轉帳證明給我們。到底是誰沒繳、誰其實繳了？',
          tasks: {
            investigation:
              '你會如何核對本月的應收、已收，以及「還沒有配對到帳單」的銀行交易？如何找出這 5 位租客的匯款？',
            solution:
              '你會如何設計銀行交易與帳單之間的分配方式？如何確保一筆款項不會被重複分配，而且帳單狀態正確？',
            edgeCase:
              '追加情境：有租客一筆匯款付了兩個月的租金；也有家人代為匯款，匯款人姓名和租客不同。你的分配方式要如何處理這些情況？',
          },
          acceptance: [
            '能核對應收、已收與未配對的交易。',
            '同一筆款項不會被重複分配。',
            '無法自動判斷的交易可以人工確認，並留下紀錄。',
          ],
          focusTables: ['leases', 'rent_bills', 'bank_transactions', 'rent_allocations', 'tenants'],
        },
        {
          id: 'C2',
          title: '租約到期房態錯誤',
          summary: '已退租的房間仍顯示出租中，租期還可能重疊。',
          clientQuote:
            '有幾間房的租客明明已經退租了，系統上還是顯示「出租中」，業務沒辦法帶看、也不能上架。另外我懷疑有的房間同一段時間掛了兩份租約。幫我整理一下。',
          tasks: {
            investigation:
              '你會如何找出房態與租約不一致的房間？又如何找出同一間房租期重疊的租約？',
            solution:
              '你會如何安全地更新房態？請說明更新前要確認什麼、更新後如何驗證，以及未來如何避免再發生。',
            edgeCase:
              '追加情境：有些租約是「續約待簽」；也有租客提前退租，但還沒有完成點交。這些情況下房態應該如何判斷？',
          },
          acceptance: [
            '能找出房態異常與租期重疊的租約。',
            '房態更新前有確認、更新後有驗證。',
            '區分「租約到期」、「完成點交」與「可出租」三件事。',
          ],
          focusTables: ['rooms', 'leases', 'tenants'],
        },
        {
          id: 'C3',
          title: '押金未結清',
          summary: '租客已退租，押金卻遲遲沒有返還。',
          clientQuote:
            '有租客打來抱怨，退租都一個多月了押金還沒退。我想知道現在到底有多少人的押金還沒結清、各差多少，哪些已經拖超過 30 天。',
          tasks: {
            investigation:
              '你會如何計算每份租約還應該退多少押金？請說明要用到哪些資料，以及哪些紀錄應該算、哪些不該算。',
            solution:
              '你會如何追蹤「退租超過 30 天仍未結清」的案件？「結清」要怎麼定義？如何讓團隊持續掌握進度？',
            edgeCase:
              '追加情境：有些扣款租客提出爭議、尚未定案；有些退款匯出失敗後又重試。你的計算方式要如何調整？',
          },
          acceptance: [
            '應退金額的計算方式正確、定義明確。',
            '「逾期」與「結清」的定義清楚，可以持續追蹤。',
            '不計入爭議中的扣款與失敗的退款，重試的退款不重複計算。',
          ],
          focusTables: ['leases', 'deposit_deductions', 'deposit_refunds', 'tenants'],
        },
        {
          id: 'C4',
          title: '刪除個資',
          summary: '租客要求刪除個人資料，但仍有歷史財務紀錄。',
          clientQuote:
            '有位前租客依個資法要求我們刪除他的所有個人資料。但他在我們這邊住了兩年，有租約、帳單、押金一堆紀錄。可以直接刪嗎？要怎麼處理才不會出事？',
          tasks: {
            investigation:
              '你會如何盤點這位租客的資料分布在哪些地方？哪些屬於個人資料，哪些屬於財務或契約紀錄？',
            solution:
              '你會如何規劃「刪除」、「去識別化」與「保留」三種處理方式？各自適用哪些資料、為什麼？如何驗證處理完成？',
            edgeCase:
              '追加情境：客戶主管說「不要那麼麻煩，直接把 tenants 那筆紀錄刪掉就好」。這樣做會發生什麼事？你會如何回應與建議？',
          },
          acceptance: [
            '完整盤點與這位租客有關的資料關聯。',
            '不破壞財務紀錄的完整性，帳仍然對得起來。',
            '保留必要的稽核資訊，並說明保留的理由與待確認事項。',
          ],
          focusTables: ['tenants', 'leases', 'rent_bills', 'bank_transactions', 'deposit_deductions', 'deposit_refunds'],
        },
      ],
    },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
