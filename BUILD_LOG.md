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

## Bước 4 — Nhân bản cho Đầu bếp và Nguyên liệu, đối chiếu nghiệm thu
**Đã làm:** `routes/admin/chefs.js`, `routes/admin/ingredients.js`, `validators/chef.js`, `validators/ingredient.js`, `validators/common.js` (`str`, `hasErrors` dùng chung cho cả 3 validator); view `admin/chefs/*`, `admin/ingredients/*`, `partials/admin-nav.ejs`; `GET /admin` → redirect `/admin/dishes`.

**Quyết định và lý do:**
- **Mỗi thực thể một router + validator + thư mục view riêng**, cùng khuôn với món ăn (theo cấu trúc trong plan). Đọc riêng từng file vẫn thấy trọn luồng request.
- **Thêm/sửa đầu bếp, nguyên liệu → `303` về danh sách** (không có trang chi tiết; đã chốt trong plan).
- **Tách `str`, `hasErrors` sang `validators/common.js`:** 3 validator cùng dùng; món ăn chạy lại test hồi quy vẫn đúng.
- **`GET /admin` redirect sang `/admin/dishes`** và thanh điều hướng 3 mục trên các trang danh sách admin: chỉ để đi lại giữa các trang, không thêm chức năng.

**Phương án đã bỏ:**
- Một hàm tạo router CRUD chung cho cả 3 thực thể: ít code hơn nhưng thêm một lớp trừu tượng, khó theo dõi luồng khi học; món ăn lại khác (có giá, checkbox, redirect sang trang chi tiết).

**Đã kiểm tra:** script curl 25 phép thử cho mỗi thực thể (tên trống/toàn khoảng trắng → `400` giữ giá trị; trường lạ `id` bị bỏ; trường phụ rỗng → `null`; sửa/xoá/mở form với id `abc`, `999999` → `404`; GET trang xoá và `GET ?_method=DELETE` không xoá; xoá lần 2 → `404`): **chefs 25/25, ingredients 25/25**. Món ăn hồi quy: thêm/sửa/xoá/400 đúng. Dữ liệu test đã tự xoá; DB còn 6 món, 3 đầu bếp, 5 nguyên liệu.

### Checklist review (`block5.md`)
| Mục | Kết quả | Cách kiểm tra |
| :--- | :--- | :--- |
| Không có link/route `GET` thay đổi dữ liệu | ✅ | Quét handler `router.get`: không gọi `create/update/delete`; không thẻ `<a>` nào chứa `_method`; test `GET ?_method=DELETE` không xoá |
| Sửa/xoá qua `PATCH`/`DELETE` bằng method-override | ✅ | `methodOverride("_method")` đặt trước router; form `?_method=PATCH`, `?_method=DELETE` |
| Ghi thành công redirect `303` | ✅ | 9/9 `res.redirect` trong `routes/admin` đều `303` |
| Template không có `fetch`/AJAX | ✅ | Không có `fetch(`, `XMLHttpRequest`, `<script>` trong `src/views` |
| Không nối chuỗi input vào SQL | ✅ | Chỉ dùng hàm Prisma; không có `$queryRaw`/`$executeRaw` |
| `req.body` được lọc, validate trước `create`/`update` | ✅ | Luôn qua `validateX(req.body).data`; test trường lạ `id`, `createdAt` bị bỏ |
| Chuỗi kết nối không có trong mã nguồn, log, template | ✅ | `git grep` toàn bộ lịch sử: không có; `.env` chưa từng commit; log lỗi `500` không chứa chuỗi kết nối; không render `process.env`/`prisma` |

### Tiêu chí nghiệm thu (`block5.md`)
| # | Tiêu chí | Kết quả |
| :--- | :--- | :--- |
| 1 | Danh sách + chi tiết món chạy đúng; id sai định dạng/không tồn tại → 404 | ✅ Bước 2 |
| 2 | CRUD đủ cho Món ăn, Đầu bếp, Nguyên liệu tại `/admin` | ✅ Bước 3, 4 |
| 3 | Tạo `POST`, cập nhật `PATCH`, xoá `DELETE`; không AJAX/fetch | ✅ |
| 4 | Input sai → `400` giữ dữ liệu trên form; thành công → `303` | ✅ |
| 5 | Xoá có trang xác nhận; reload sau submit không gửi lại / tạo trùng | ✅ PRG `303` → F5 chỉ tải lại trang GET đích |

**Điều chưa chắc / ngoài phạm vi:**
- Bấm submit 2 lần thật nhanh hoặc 2 tab cùng gửi vẫn có thể tạo 2 bản ghi (PRG không chặn được). Đã chốt phương án A: không thêm unique constraint.
- Tiêu chí 5 (F5) kiểm tra bằng thiết kế PRG + curl thấy `303`; nên thử thêm bằng trình duyệt thật.

## Giao diện — bộ CSS đơn giản
**Đã làm:** tách CSS khỏi `partials/header.ejs` sang `public/css/style.css`, phục vụ bằng `express.static`. Chỉnh markup ở mức tối thiểu: thực đơn dạng lưới thẻ; bảng admin trong khung; nút dùng `.btn`, `.btn-primary`, `.btn-danger`, `.btn-sm`; ô lỗi có class `invalid` (viền đỏ); trang xác nhận xoá, 404, 500 dạng thẻ.

**Quyết định và lý do:**
- **File CSS riêng thay vì inline:** CSS đã dài ~150 dòng; trình duyệt cache được file, view gọn hơn. Bước 2 để inline vì lúc đó chỉ vài dòng.
- **Biến CSS ở `:root`** (màu, bo góc, bóng): đổi tông màu chỉ sửa một chỗ. Tông ấm (nền kem, màu nhấn đất nung) hợp chủ đề nhà hàng.
- **Không dùng thư viện CSS, không JavaScript:** giữ đúng phạm vi bài (SSR thuần, không thêm công cụ).
- **Bảng admin `white-space: nowrap` + cuộn ngang trong khung** ở màn hình hẹp: trước đó chữ bị bóp xuống từng từ và cột Sửa/Xoá bị đẩy ra ngoài.

**Đã kiểm tra:** `/css/style.css` trả `200 text/css`; tất cả trang `200`/`404` như trước; chạy lại test CRUD chefs 25/25, ingredients 25/25, món ăn thêm/sửa/xoá đúng; không có `<script>` trong views. Chụp màn hình bằng Chrome headless ở 1100px và trong iframe 375px (Chrome headless không thu cửa sổ dưới 500px, nên ảnh "390px" ban đầu bị cắt mép, không phải lỗi CSS). Sửa sau khi xem ảnh: link header dính nhau, bảng admin trên mobile, dòng lỗi bị in đậm.

## Tài liệu trình bày
**Đã làm:** `hotrotrinhbay.html` (cùng khung với block4): mục tiêu + tiêu chí nghiệm thu, luồng đọc/ghi (PRG) và xử lý lỗi, cây thư mục rút gọn, bảng công nghệ kèm lý do, mục "cố ý không dùng". Không so sánh với block trước (theo yêu cầu). HTML tĩnh, mở trực tiếp bằng trình duyệt; đã chụp màn hình kiểm tra hiển thị.
