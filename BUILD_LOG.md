# BUILD_LOG — Block 5

## Bước 1a — Khởi tạo project
**Đã làm:** tạo `Week3/block5/`, `git init`, `package.json`, `.gitignore`, `.env.example`; cài gói.

| Gói | Phiên bản | Ghi chú |
| :--- | :--- | :--- |
| express | 5.3.0 | Bản mới nhất (đã chốt) |
| ejs | 7.0.1 | Bản mới nhất |
| method-override | 3.0.0 | |
| dotenv | 18.0.7 | Nạp `.env` cho cả app và Prisma CLI (đã chốt) |
| prisma (dev), @prisma/client, @prisma/adapter-pg | 7.10.0 | Ghim chính xác, xem bên dưới |
| pg | 8.x | Driver PostgreSQL mà adapter-pg cần |

**Quyết định và lý do:**
- **Ghim Prisma 7.10.0:** tag `latest` của gói `prisma` đang trỏ tới `8.0.0-rc.22` (bản thử nghiệm), còn `@prisma/client` ổn định ở 7.10.0. CLI và client phải cùng phiên bản; plan đã chốt 7.x.
- **`"type": "module"` (ESM):** Prisma 7 phát hành dạng ES module. Vì vậy code dùng `import` thay cho `require` như ví dụ trong `block5.md` — cách viết khác nhưng ý nghĩa giống nhau.
- **`postinstall: prisma generate`:** Prisma Client được sinh vào `generated/` (không commit), nên sau `npm install` tự sinh lại.
- **`.env.example`** chỉ chứa mẫu chuỗi kết nối, không có giá trị thật; được commit. `.env` nằm trong `.gitignore`.

**Phương án đã bỏ:**
- `npm audit fix --force`: sẽ hạ Prisma xuống 6.19.3, trái với plan.

**Điều chưa chắc:**
- `npm audit` báo 4 lỗi mức high, đều nằm trong Prisma CLI (dev): `deepmerge-ts` (gộp object đệ quy) và `mysql2` (dự án dùng Postgres, không gọi tới). Không chạy trong app → chấp nhận, theo dõi khi Prisma ra bản vá.

## Bước 1b — Model và cấu hình Prisma
**Đã làm:** `prisma/schema.prisma` (3 model `Dish`, `Chef`, `Ingredient`), `prisma.config.js`, `src/db.js`. Đã chạy `npx prisma validate` và `npx prisma generate` thành công; import `src/db.js` bằng Node thuần thấy đủ `prisma.dish/chef/ingredient`.

**Quyết định và lý do:**
- **Model:** `Dish` đúng mẫu `block5.md`. `Chef`, `Ingredient` theo cùng kiểu: `name` bắt buộc, trường còn lại `String?`; map tên bảng số nhiều (`chefs`, `ingredients`) như `dishes`.
- **Generator `prisma-client`** (mặc định của Prisma 7), sinh client vào `generated/prisma`.
- **Chuỗi kết nối ở 2 nơi, cùng đọc `DATABASE_URL`:** `prisma.config.js` cho CLI (`db push`, `db seed`); driver adapter `PrismaPg` trong `src/db.js` cho app. Prisma 7 không còn khai báo `url` trong `schema.prisma`.
- **Một `PrismaClient` dùng chung** (`src/db.js`) để không mở nhiều pool kết nối.
- **`prisma.config.js` thay vì `.ts`:** dự án viết JavaScript; Prisma CLI đọc được file `.js` (đã thấy "Loaded Prisma config from prisma.config.js").

**Phương án đã bỏ:**
- `env("DATABASE_URL")` của `prisma/config`: báo lỗi khi chưa có `.env` → `prisma generate` (lúc `npm install`) hỏng. Dùng `process.env.DATABASE_URL`.
- Cài `tsx` để chạy client TypeScript mà Prisma sinh ra: không cần, Node 25 tự bỏ khai báo kiểu khi import file `.ts`.
- Generator cũ `prisma-client-js` (sinh JS vào `node_modules`): Prisma đánh dấu deprecated.

**Giả định:**
- Cần Node có hỗ trợ chạy `.ts` trực tiếp (máy hiện tại: Node 25.2.1). Node quá cũ sẽ không import được `generated/prisma/client.ts`.

## Bước 1c — Kết nối Supabase, db push, seed
**Đã làm:** `npx prisma db push` tạo 3 bảng `dishes`, `chefs`, `ingredients` trên Supabase. Viết `prisma/seed.js` (6 món, 3 đầu bếp, 5 nguyên liệu), chạy `npx prisma db seed`. Kiểm tra bằng truy vấn đọc: tìm `"PHỞ"` (không phân biệt hoa thường) ra "Phở bò tái". Chạy seed lần 2 vẫn đúng 6/3/5 bản ghi.

**Sự cố khi kết nối và cách xử lý:**
| Lỗi | Nguyên nhân | Sửa |
| :--- | :--- | :--- |
| `P1001` tới `db.<ref>.supabase.co` | Dùng nhầm Direct connection (chỉ IPv6) | Đổi sang Session pooler |
| `P1001` tới `...pooler.supabase.com:6543` | Transaction pooler (`6543`, `?pgbouncer=true`) và mật khẩu còn là `[YOUR-PASSWORD]` | Cổng `5432`, bỏ `?pgbouncer=true`, điền mật khẩu thật |
| `28P01 password authentication failed` | Sai mật khẩu database | Reset mật khẩu database trên Supabase |
| Kết nối không SSL bị treo; SSL mặc định báo `SELF_SIGNED_CERT_IN_CHAIN` | Pooler bắt buộc SSL, chứng chỉ do Supabase tự cấp | Nạp CA của Supabase (xem dưới) |

**Quyết định và lý do:**
- **SSL có xác minh bằng CA của Supabase** (`certs/supabase-ca.crt`, "Supabase Root 2021 CA", hạn 2031), truyền `ssl: { ca }` vào `PrismaPg`. Kết nối vừa mã hoá vừa xác minh đúng server. File CA là công khai → commit được.
- Prisma CLI (`db push`, `db seed`) tự dùng SSL nên không cần cấu hình thêm trong `prisma.config.js`.
- **Seed xoá dữ liệu cũ trước khi tạo** → chạy lại nhiều lần không bị trùng.

**Phương án đã bỏ:**
- `ssl: { rejectUnauthorized: false }`: chạy ngay nhưng không xác minh server (có thể bị giả mạo nếu mạng bị can thiệp). Người dùng chọn dùng CA.

**Điều chưa chắc / cần biết:**
- Chạy lại seed thì id không quay về 1 (Postgres không dùng lại giá trị autoincrement). Không ảnh hưởng vì link luôn lấy id từ database.
- Nếu Supabase đổi chứng chỉ gốc (sau 2031 hoặc sớm hơn), cần tải lại file CA.
