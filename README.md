# Block 5 — Ứng dụng nhà hàng (SSR + Supabase + Prisma)

Ứng dụng Express render HTML phía server (EJS), đọc/ghi Supabase PostgreSQL qua Prisma ORM.

- **Trang người dùng:** xem thực đơn, tìm món theo tên, xem chi tiết món.
- **Trang quản trị (`/admin`):** thêm, sửa, xoá Món ăn, Đầu bếp, Nguyên liệu.

Không dùng `fetch`/AJAX: mọi dữ liệu đi qua HTML form. Ghi dữ liệu bằng `POST` / `PATCH` / `DELETE` (qua `method-override`), ghi xong redirect `303` (Post/Redirect/Get).

## Công nghệ

| Thành phần | Phiên bản |
| :--- | :--- |
| Node.js | 24+ (tối thiểu 22.18) |
| Express | 5.x |
| EJS | 7.x |
| Prisma ORM + `@prisma/adapter-pg` | 7.10.0 |
| Database | Supabase PostgreSQL (Session pooler) |

> Prisma 7 sinh client dạng TypeScript vào `generated/prisma/`. Node 22.18+ chạy được file `.ts` trực tiếp nên không cần cài thêm công cụ build.

## Cài đặt và chạy

### 1. Cài thư viện
```bash
npm install
```
Lệnh này cũng tự chạy `prisma generate` để sinh Prisma Client.

### 2. Tạo `.env`
```bash
cp .env.example .env
```
Điền `DATABASE_URL` lấy từ Supabase: **Connect → Session pooler** (cổng `5432`). Chuỗi đúng có dạng:
```
postgresql://postgres.<project-ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres
```

> ⚠️ Không commit `.env`, không dán chuỗi kết nối vào chat hay ảnh chụp màn hình.

### 3. Chứng chỉ SSL của Supabase
Supabase bắt buộc SSL và dùng chứng chỉ riêng. File CA đã có sẵn trong repo: `certs/supabase-ca.crt`.
Nếu project Supabase của bạn dùng chứng chỉ khác, tải lại tại **Project Settings → Database → SSL Configuration → Download certificate** và ghi đè file này.

### 4. Tạo bảng và dữ liệu mẫu
```bash
npx prisma db push   # tạo bảng dishes, chefs, ingredients từ prisma/schema.prisma
npx prisma db seed   # nạp 6 món, 3 đầu bếp, 5 nguyên liệu; mỗi lần chạy xoá dữ liệu cũ, id bắt đầu lại từ 1
```

### 5. Chạy server
```bash
npm run dev   # tự khởi động lại khi sửa code
# hoặc
npm start
```
Mở http://localhost:3000 (đổi cổng bằng biến `PORT` trong `.env`).

## Các trang

### Người dùng
| Method | URL | Mô tả |
| :--- | :--- | :--- |
| GET | `/dishes` | Thực đơn; tìm theo tên với `?q=...` (không phân biệt hoa thường) |
| GET | `/dishes/:id` | Chi tiết món; id sai định dạng hoặc không tồn tại → `404` |

### Quản trị
Cùng một bộ route cho `dishes`, `chefs`, `ingredients`:

| Method | URL | Mô tả | Kết quả |
| :--- | :--- | :--- | :--- |
| GET | `/admin/<entity>` | Danh sách | `200` |
| GET | `/admin/<entity>/new` | Form thêm | `200` |
| POST | `/admin/<entity>` | Thêm | `303` hoặc `400` |
| GET | `/admin/<entity>/:id/edit` | Form sửa | `200` hoặc `404` |
| PATCH | `/admin/<entity>/:id` | Cập nhật | `303`, `400` hoặc `404` |
| GET | `/admin/<entity>/:id/delete` | Trang xác nhận xoá | `200` hoặc `404` |
| DELETE | `/admin/<entity>/:id` | Xoá | `303` hoặc `404` |

Ghi thành công: món ăn → trang chi tiết `/dishes/:id` (thêm, sửa); đầu bếp, nguyên liệu → trang danh sách; xoá → trang danh sách.

## Cấu trúc thư mục
```
block5/
├── prisma/
│   ├── schema.prisma        # 3 model: Dish, Chef, Ingredient (code-first)
│   └── seed.js              # dữ liệu mẫu
├── prisma.config.js         # cấu hình Prisma CLI (nạp .env, lệnh seed)
├── certs/supabase-ca.crt    # CA của Supabase cho SSL
├── src/
│   ├── app.js               # Express, middleware, router, 404/500
│   ├── db.js                # PrismaClient dùng chung (adapter-pg + SSL)
│   ├── routes/
│   │   ├── dishes.js        # trang người dùng
│   │   └── admin/           # dishes.js, chefs.js, ingredients.js
│   ├── validators/          # parseId, validate từng model
│   └── views/               # EJS: dishes/, admin/, partials/, 404, 500
├── public/css/style.css     # giao diện; màu và khoảng cách đặt ở biến :root đầu file
├── .env.example
└── BUILD_LOG.md             # nhật ký từng bước: quyết định, lý do, kiểm tra
```

## Lỗi kết nối thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
| :--- | :--- | :--- |
| `P1001` tới `db.<ref>.supabase.co` | Dùng Direct connection (chỉ IPv6) | Đổi sang **Session pooler** |
| `P1001` tới `...pooler.supabase.com:6543` | Transaction pooler | Đổi cổng `5432`, bỏ `?pgbouncer=true` |
| `28P01 password authentication failed` | Sai mật khẩu database (hoặc còn `[YOUR-PASSWORD]`) | Reset database password trên Supabase |
| `SELF_SIGNED_CERT_IN_CHAIN` | Thiếu/sai file CA | Tải lại `certs/supabase-ca.crt` (bước 3) |
| `ENOENT ... supabase-ca.crt` | Không có file CA | Như trên |

Chi tiết quá trình làm và các quyết định: xem [BUILD_LOG.md](BUILD_LOG.md).
