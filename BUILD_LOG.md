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

## Bước 2 — Trang người dùng
**Đã làm:** `src/app.js`, `src/routes/dishes.js`, `src/validators/id.js`; view `dishes/index`, `dishes/show`, `404`, `500`, `partials/header|footer`.

**Luồng request:**
- `GET /dishes` → đọc `req.query.q` → `findMany` (lọc `contains` + `insensitive` nếu có `q`) → render danh sách, mỗi món link `/dishes/:id`.
- `GET /dishes/:id` → `parseId(req.params.id)` → sai định dạng: `404` ngay, không truy vấn → `findUnique` → `null`: `404` → render chi tiết.
- Không route nào khớp → `404`. Lỗi trong handler → error handler (Express 5 tự chuyển lỗi async) → log stack, render `500`.

**Đã kiểm tra (curl):**
| Request | Kết quả |
| :--- | :--- |
| `/dishes`, `?q=phở`, `?q=khongco` | `200`; "phở" ra đúng "Phở bò tái"; không khớp hiện thông báo |
| `?q=a&q=b` | `200`, coi như không lọc (đủ 6 món), không lỗi |
| `/dishes/7` | `200`, đủ giá, loại, tình trạng, mô tả |
| `/dishes/999999`, `abc`, `2.5`, `0`, `99999999999`, `/khong-co-trang` | `404` |
| `?q=<script>` | Được escape thành `&lt;script&gt;` |
| DB không kết nối được | `500`, HTML chỉ có thông báo chung; stack nằm trong log server |

**Quyết định và lý do:**
- **`parseId` chỉ nhận `^[1-9]\d*$` và ≤ 2147483647:** `Number()` một mình chấp nhận `"2.5"`, `"2e1"`, `" 2"`; số vượt giới hạn cột `Int` sẽ làm Prisma báo lỗi → thành `500` thay vì `404`. Hàm đặt ở `validators/` để route admin dùng lại.
- **`q` chỉ nhận khi là chuỗi:** `?q=a&q=b` cho ra mảng; truyền mảng vào `contains` sẽ lỗi `500`.
- **`GET /` redirect sang `/dishes`:** đề không có trang chủ; trang 404/500 cần chỗ để quay về. Đây là redirect hiển thị (GET → GET), không phải thao tác ghi.
- **CSS viết thẳng trong `partials/header.ejs`:** chỉ vài dòng, chưa cần file tĩnh và `express.static`.

**Điều chưa chắc:**
- Header chưa có link "Quản trị" vì `/admin` chưa tồn tại; thêm ở bước 3.

## Bước 3 — CRUD món ăn (`/admin/dishes`)
**Đã làm:** `src/routes/admin/dishes.js`, `src/validators/dish.js`, `isNotFound` trong `src/db.js`, `methodOverride("_method")` trong `app.js`; view `admin/dishes/index`, `form` (dùng chung thêm/sửa), `delete`; header thêm link "Quản trị".

**Luồng ghi (Post/Redirect/Get):**
- Thêm: `POST /admin/dishes` → `validateDish(req.body)` → lỗi: `400` + render lại form giữ giá trị → hợp lệ: `await create` → `303` sang `/dishes/:id`.
- Sửa: form `POST ...?_method=PATCH` → method-override đổi thành `PATCH` → `parseId` → kiểm tra tồn tại (`404`) → validate (`400`) → `await update` → `303` sang `/dishes/:id`.
- Xoá: link GET mở trang xác nhận → nút `formaction="...?_method=DELETE"` → `DELETE` → `await delete` → `303` về `/admin/dishes`.

**Đã kiểm tra (curl):**
| Trường hợp | Kết quả |
| :--- | :--- |
| Tên trống / giá âm / giá `abc` / giá `1.5` / form rỗng | `400`, hiện lỗi đúng trường, giữ giá trị đã nhập |
| Thêm hợp lệ kèm trường lạ `id=1`, `createdAt` | `303` sang `/dishes/13`; trường lạ bị bỏ qua (id do DB sinh) |
| Không tick "Đang phục vụ" | Lưu `available = false` |
| Sửa hợp lệ | `303` sang `/dishes/:id`, dữ liệu mới hiển thị đúng |
| Sửa/xoá/mở form với id `abc` hoặc `999999` | `404` |
| Mở trang xác nhận xoá (GET) | `200`, món vẫn còn |
| `GET ...?_method=DELETE` | Không xoá (method-override chỉ đổi request POST) |
| Xoá | `303` về danh sách; xoá lần 2 → `404` |
| `fetch` / `XMLHttpRequest` / `<script>` trong `src/views` | 0 chỗ |

**Quyết định và lý do:**
- **`validateDish` trả `data` / `errors` / `values`:** `data` chỉ gồm 5 cột được phép, không đưa nguyên `req.body` vào Prisma; `values` giữ chuỗi người dùng gõ (vd. giá `"1.5"`) để render lại form khi `400`.
- **Giá chỉ nhận chữ số (`^\d+$`)**, ≤ giới hạn `Int`. `Number()` một mình nhận `"1e3"`, `" 5"`, `""` (= 0).
- **Trường rỗng `description`, `category` → `null`**, không lưu chuỗi rỗng.
- **Không đặt `required`/`min` trên input:** để server là nơi kiểm tra; trên trình duyệt vẫn thử được trường hợp `400`. (`type="number"` vẫn chặn ký tự chữ ở trình duyệt.)
- **PATCH kiểm tra tồn tại trước validate:** id không tồn tại → `404`, không render form sửa cho bản ghi không có.
- **Bắt `P2025` khi update/delete** (bản ghi bị xoá ở tab khác giữa chừng) → `404` thay vì `500`.
- **Form sửa dùng `action="...?_method=PATCH"`; trang xoá dùng `formaction` trên nút** như ví dụ `block5.md`. Hai cách tương đương.

**Phương án đã bỏ:**
- Nút xoá ngay trong form sửa (như ví dụ `formaction` của `block5.md`): bỏ qua bước xác nhận mà đề bắt buộc.

**Dữ liệu:** món thử "Bún bò Huế" (id 13) và "Cà phê sữa đá" (id 14) tạo khi test đã được xoá; DB còn đúng 6 món seed.
