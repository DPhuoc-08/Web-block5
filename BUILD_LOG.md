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
- ~~Chạy lại seed thì id không quay về 1~~ → đã sửa, xem mục "Seed: id bắt đầu từ 1".
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
| Không nối chuỗi input vào SQL | ✅ | Route chỉ dùng hàm Prisma; SQL thô duy nhất là câu `TRUNCATE` cố định trong `prisma/seed.js` (không nhận input) |
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

**Đã làm (bổ sung):** `kichban.html`: cấu trúc DB (3 bảng, vì sao đủ), chức năng chính (người dùng + admin), luồng từng thao tác (danh sách/tìm, chi tiết, thêm, sửa, xoá, khác biệt của Chef/Ingredient), bảng mã lỗi, kịch bản demo theo tiêu chí nghiệm thu. Dùng chung bộ màu với `hotrotrinhbay.html`.

**Quyết định:** chỉ trình bày phần đề yêu cầu; phần mở rộng (ảnh món, bộ lọc) chỉ nhắc một dòng để tránh lan man. Nội dung luồng đối chiếu với code thật (`src/routes/*`, `src/validators/*`), không chỉ theo plan.

## Seed: id bắt đầu từ 1
**Vấn đề:** `deleteMany()` chỉ xoá dòng, không reset bộ đếm autoincrement của PostgreSQL → sau nhiều lần seed, món đầu tiên có id 7, 13...

**Đã làm:** trong `prisma/seed.js`, thay 3 lệnh `deleteMany()` bằng `prisma.$executeRaw\`TRUNCATE TABLE "dishes", "chefs", "ingredients" RESTART IDENTITY\``. Seed 2 lần liên tiếp: dishes 1–6, chefs 1–3, ingredients 1–5; món thêm mới tiếp theo nhận id 7.

**Quyết định và lý do:**
- Prisma không có hàm reset bộ đếm id → dùng một câu SQL **cố định** qua tagged template `$executeRaw`. Không nhận dữ liệu người dùng nên không có rủi ro SQL injection; chỉ nằm trong script seed, không nằm trong route.
- `TRUNCATE` cả 3 bảng trong một câu: nhanh hơn xoá từng dòng và reset luôn bộ đếm.

**Phương án đã bỏ:** `ALTER SEQUENCE ... RESTART WITH 1` sau `deleteMany()`: phải biết tên sequence của từng bảng và vẫn cần SQL thô, dài hơn mà không lợi gì.

**Lưu ý:** seed xoá toàn bộ dữ liệu hiện có (kể cả món thêm qua trang admin) — chỉ chạy khi muốn đưa database về dữ liệu mẫu.

## Mở rộng (theo yêu cầu sau nghiệm thu): ảnh món, lọc món, tìm kiếm admin, áp dụng mockup

### A — Ảnh minh hoạ cho món ăn
**Đã làm:** thêm `imageUrl String?`, `imageCredit String?` vào model `Dish`; `npx prisma db push` (chỉ thêm cột, không mất dữ liệu), `prisma generate`; seed gắn ảnh cho cả 6 món.

**Nguồn ảnh (ảnh thật, giấy phép mở, nhúng trực tiếp bằng link — không tự vẽ, không tải về repo):**
| Món | Tác giả · Giấy phép · Nguồn |
| :--- | :--- |
| Phở bò tái | Kritzolina · CC BY-SA 4.0 · [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Ph%E1%BB%9F_b%C3%B2_in_a_German_restaurant_01.jpg) |
| Bún chả Hà Nội | stuart_spivack · CC BY 2.0 · [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:B%C3%BAn_ch%E1%BA%A3_Vietnamese_food.jpg) |
| Cơm tấm sườn bì | Phương Huy · CC0 · [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:C%C6%A1m_t%E1%BA%A5m_SG_l%E1%BB%81_%C4%91%C6%B0%E1%BB%9Dng_(c%C6%A1m_s%C6%B0%E1%BB%9Dn,_mi%E1%BA%BFng_s%C6%B0%E1%BB%9Dn_n%C6%B0%E1%BB%9Bng_m%E1%BA%ADt_ong)_ng30th7n2022_(1).jpg) |
| Gỏi cuốn tôm thịt | Tran Hai Duong · CC0 · [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:G%E1%BB%8Fi_cu%E1%BB%91n.jpg) |
| Chè ba màu | avlxyz · CC BY-NC 2.0 · [Flickr](https://www.flickr.com/photos/10559879@N00/51714302932) |
| Bánh xèo miền Tây | Vivian D Nguyen · CC BY-SA 2.0 · [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:B%C3%A1nh_x%C3%A8o_with_n%C6%B0%E1%BB%9Bc_m%E1%BA%AFm.jpg) |

**Quyết định và lý do:**
- **Wikimedia Commons trước:** ảnh có giấy phép rõ ràng, cho phép nhúng trực tiếp; API trả về tác giả + giấy phép. Dùng bản thumbnail 960px thay vì ảnh gốc (vài MB).
- **Chè ba màu lấy từ Flickr (qua Openverse):** Commons không có ảnh đúng món (chỉ có chè thập cẩm, quầy hàng). CC BY-NC phù hợp vì đây là đồ án học tập, không thương mại.
- **Lưu `imageCredit`** và hiển thị cạnh ảnh: CC BY / BY-SA yêu cầu ghi công tác giả và giấy phép.
- **Chọn ảnh bằng mắt:** ghép 12 ảnh ứng viên vào một trang, chụp màn hình để chọn ảnh đúng món, đúng mô tả (vd. cơm tấm có miếng sườn nướng mật ong).

**Phương án đã bỏ:** tự vẽ/sinh ảnh (người dùng yêu cầu ảnh thật); tải ảnh về `public/` (tăng dung lượng repo, phải tự quản lý bản quyền file).

**Điều chưa chắc:** ảnh phụ thuộc máy chủ bên ngoài — nếu link chết, view hiện khung "Chưa có ảnh" (bước giao diện). Flickr trả lỗi 500 cho request có User-Agent quá đơn giản (curl); trình duyệt tải bình thường.

### B — Tìm kiếm trang quản trị + trường ảnh trong form món
**Đã làm:** `searchWhere(q, fields)` trong `validators/common.js` (OR `contains` + `insensitive` trên nhiều cột); route danh sách của 3 thực thể đọc `?q=`; partial `admin-search.ejs` (form GET, nút "Xoá tìm kiếm", dòng "Tìm thấy N kết quả"). `validateDish` thêm `imageUrl` (không bắt buộc; có thì phải là URL `http:`/`https:`, ≤ 1000 ký tự) và `imageCredit` (≤ 200 ký tự); form sửa hiện ảnh xem trước.

**Quyết định và lý do:**
- **Tìm trên 2 cột mỗi thực thể** (món: tên/loại; đầu bếp: tên/chuyên môn; nguyên liệu: tên/đơn vị): admin thường nhớ một trong hai.
- **Chỉ nhận link `http(s)`:** link ảnh được đặt vào `<img src>`; chặn `javascript:`, `data:`.

### C — Lọc món phía người dùng
**Đã làm:** `validators/menu-filters.js` đọc `q`, `category`, `price`, `available`, `sort` từ query string → `where` (AND các điều kiện) + `orderBy`. Danh sách loại lấy từ DB (`distinct`). Chip loại là link GET giữ nguyên các tiêu chí khác (`filterUrl`); các tiêu chí còn lại là form GET.

**Quyết định và lý do:**
- **Tất cả qua query string (GET):** đúng vai trò "query = điều kiện hiển thị" của `block5.md`; kết quả bookmark được; không cần JavaScript.
- **Giá trị sai bị bỏ qua, không trả 400:** người dùng chỉ đang xem; `?price=abc` hay loại không tồn tại → coi như không lọc.
- **Sắp xếp mặc định → nhóm theo loại** (như thực đơn in); chọn sắp xếp khác → một danh sách phẳng, vì sắp theo giá mà vẫn chia nhóm thì thứ tự giá bị cắt vụn.
- **Khoảng giá cố định** (dưới 40k / 40–60k / trên 60k): đủ cho thực đơn nhỏ, dễ chọn hơn 2 ô nhập min–max.

### D — Áp dụng mockup + nâng cấp giao diện
**Đã làm:** viết lại `public/css/style.css` và các view: header chung (đánh dấu trang hiện tại), thực đơn có ảnh thumbnail + nhóm loại chảy 2 cột, chi tiết món ảnh lớn + ghi công ảnh, admin đơn giản (nền xám nhạt, bảng có ảnh nhỏ, ô tìm kiếm), 404/500.

**Quyết định và lý do:**
- **Giữ bố cục mockup, đổi phong cách để tránh "AI look"** (người dùng yêu cầu): bỏ nền kem + font serif + màu đất nung (kiểu phối mặc định của công cụ thiết kế AI); dùng nền trắng, một font **Be Vietnam Pro** (hỗ trợ tiếng Việt tốt), một màu nhấn xanh lá đậm `#1f5b43`, để **ảnh món ăn** là điểm nhấn. Không gradient, không emoji.
- **Ảnh lỗi/thiếu:** khung "Chưa có ảnh"; món tạm hết: ảnh xám + giá gạch ngang.
- **Accessibility:** ô nhập có `<label>`, vùng chạm ≥ 44px, trạng thái chip bằng `aria-current`, link trang hiện tại có `aria-current="page"`.

**Đã kiểm tra:** 14 tổ hợp lọc (từng tiêu chí, kết hợp nhiều tiêu chí, giá trị sai, `?q=a&q=b`) ra đúng số món và thứ tự; tìm kiếm admin 3 thực thể đúng; link ảnh `javascript:` và `abc` → `400`, link hợp lệ → `303` + có ảnh xem trước; CRUD chefs 25/25, ingredients 25/25; chụp màn hình 1280px và 375px, sửa 2 lỗi thấy được (nhóm 1 món để trống cột phải; ảnh dọc bị kéo cao ở trang chi tiết). Seed lại sau test → id vẫn 1–6.

**Phương án đã bỏ:** lưới thẻ ảnh lớn kiểu app giao đồ ăn (xa bố cục mockup đã duyệt); giữ nguyên nền kem + serif của mockup (người dùng muốn tránh "AI look").

## Tái cấu trúc theo yêu cầu mới của giảng viên

### R1 — Responsive (ưu tiên số 1)
**Đã làm:** viết lại phần responsive trong `public/css/style.css` với 3 điểm chuyển; thêm `data-label` + class `title`/`thumb` cho các ô bảng admin.
| Điểm chuyển | Thay đổi |
| :--- | :--- |
| ≤ 1024px (máy tính bảng) | Giảm khoảng cách và cỡ tiêu đề trang chi tiết |
| ≤ 820px (máy tính bảng dọc + điện thoại) | **Bảng admin → thẻ**: mỗi dòng một thẻ, nhãn cột lấy từ `data-label`; thẻ xếp lưới (1 cột điện thoại, 2 cột tablet dọc); món ăn: ảnh nhỏ cạnh tên; đầu bếp/nguyên liệu: tên lên đầu thẻ; nút Sửa/Xoá ≥ 44px |
| ≤ 600px (điện thoại) | Header một dòng (ẩn "/ Quản trị" vì nav đã có); chip loại cuộn ngang 1 dòng; ô lọc xếp lưới 2 cột; tab admin cuộn ngang; ô tìm admin + nút Tìm cùng hàng; nút trong form chia đều chiều ngang |

**Lý do:**
- **Ngưỡng 820px cho bảng:** bảng món 7 cột tràn ngang ở iPad dọc 768px (nút "Xoá" bị cắt khi chụp thử); bảng chỉ cuộn ngang là kém thân thiện trên màn hình cảm ứng.
- **Không JavaScript:** toàn bộ chuyển đổi bằng CSS (`display`, `grid`, `:has()`), giữ đúng yêu cầu SSR thuần.

**Đã kiểm tra:** chụp màn hình trước/sau ở 360px (thực đơn, admin món, admin đầu bếp, form sửa, chi tiết) và 768px (thực đơn, admin món); CRUD chefs 25/25, ingredients 25/25; các trang chính `200`, id sai `404`.

**Phương án đã bỏ:** gói bộ lọc vào `<details>` trên điện thoại — `<details>` không mở sẵn được riêng cho màn hình lớn nếu không có JavaScript; thay bằng bố cục lọc gọn (chip cuộn ngang + lưới 2 cột).

### R2 — Quan hệ khoá ngoại + dữ liệu giả
**Đã làm:** `schema.prisma`: `Dish.chefId → Chef` (onDelete **Restrict**), bảng trung gian `DishIngredient` (`dish_ingredients`, khoá chính `[dishId, ingredientId]`; `dishId` **Cascade**, `ingredientId` **Restrict**); `@unique` cho tên đầu bếp và tên nguyên liệu. Seed mới: 20 món / 7 loại, 7 đầu bếp, 30 nguyên liệu, 71 liên kết; ảnh thật cho 19 món (thêm 13 ảnh Wikimedia Commons, chọn bằng bảng ảnh ứng viên).

**Quyết định và lý do:**
- **Mỗi món 1 đầu bếp (1-n)** — người dùng chọn: "đầu bếp đảm trách".
- **Bảng trung gian tường minh** thay vì many-to-many ngầm định của Prisma: bảng ngầm định luôn Cascade cả hai phía nên không chặn được việc xoá nguyên liệu đang dùng.
- **Restrict ở database + kiểm tra ở app:** app hiện thông báo dễ hiểu; database là lớp chặn cuối khi có request đồng thời.
- **Dữ liệu giả có chủ đích:** 1 đầu bếp 0 món (xoá được), 1 nguyên liệu chưa dùng (xoá được), nguyên liệu dùng chung nhiều món (Rau thơm, Tôm sú: 6 món), 2 món tạm hết, 1 món chưa có ảnh (Cơm gà Hội An: Commons không có ảnh đúng món), 1 món chưa có mô tả.
- **Reset database:** thêm cột bắt buộc `chefId` vào bảng có dữ liệu không được, nên dùng `npx prisma db push --force-reset`. Prisma 7 chặn lệnh này khi do AI gọi; đã giải thích hậu quả (xoá vĩnh viễn, chỉ dùng cho DB phát triển) và người dùng đồng ý rõ ràng trước khi chạy.

**Đã kiểm tra ở tầng DB:** xoá nguyên liệu đang dùng → `P2003`; xoá đầu bếp còn món → `P2003`; tạo nguyên liệu trùng tên → `P2002`; xoá món → liên kết của món bị xoá, nguyên liệu + đầu bếp còn nguyên.

**Phương án đã bỏ:** đầu bếp nhiều-nhiều (khó xác định "ai đảm trách"); `onDelete: SetNull` cho đầu bếp (món sẽ không có người phụ trách, trái quy tắc bắt buộc).

### R3 — Form món: chọn đầu bếp, tick nguyên liệu, loại cố định
**Đã làm:** `validateDish(body, { chefIds, ingredientIds })` nhận tập id hợp lệ lấy từ DB; route nạp danh sách đầu bếp + nguyên liệu mỗi lần mở form; form có select loại (`CATEGORIES`), radio đầu bếp, checkbox nguyên liệu (`name="ingredientIds"` lặp → mảng). Tạo món dùng nested create; sửa món thay toàn bộ liên kết (`deleteMany` + `create`) trong cùng một lệnh update.

**Quyết định và lý do:**
- **(P1) Kiểm tra id có thật trong DB:** form có thể bị sửa tay gửi id bịa → `400` thay vì lỗi Prisma `500`.
- **(P2) Giữ lựa chọn khi `400`:** radio đã chọn, các ô đã tick, loại đã chọn được render lại.
- **(P4) Loại món là danh sách cố định trong code**, không tạo bảng: đủ cho yêu cầu, tránh "món nước"/"Món nước" thành 2 chip lọc.
- **Tick trùng một nguyên liệu** (form bị sửa) → gộp lại, không lỗi khoá chính.
- **Đầu bếp/nguyên liệu vừa bị xoá ở tab khác** lúc đang lưu món → khoá ngoại từ chối (`P2003`) → `400` "vui lòng chọn lại".

**Đã kiểm tra:** thiếu loại/đầu bếp/nguyên liệu → `400` đủ 3 lỗi; giữ lựa chọn khi giá sai; `chefId=9999`, `ingredientIds=abc|9999`, loại ngoài danh sách → `400`; thêm hợp lệ → `303` + DB đúng đầu bếp, nguyên liệu; sửa đổi đầu bếp + nguyên liệu → DB đúng; xoá món → liên kết bị xoá.

### R4 — Quy tắc xoá, hiển thị quan hệ, thông báo sau khi lưu
**Đã làm:**
- **Xoá nguyên liệu:** trang xác nhận liệt kê món đang dùng (link "Sửa món"), không có nút Xoá; `DELETE` khi còn dùng → **`409`**; bắt thêm `P2003` (lớp database) → `409`.
- **Xoá đầu bếp:** 0 món → xoá thẳng; còn món → trang xác nhận liệt kê món (link "Đổi đầu bếp riêng món này") + select người nhận; `DELETE` không chọn → **`409`**, người nhận sai (chính mình, `abc`, không tồn tại) → `400`; hợp lệ → `$transaction([updateMany chuyển món, delete])` → `303`.
- **(P3) Chặn trùng tên** đầu bếp/nguyên liệu không phân biệt hoa thường (`nameTaken`, `mode: "insensitive"`) + bắt `P2002` → `400`.
- **(P5)** Trang chi tiết món hiện đầu bếp phụ trách + nguyên liệu. **(P6)** Cột "Phụ trách N món" / "Dùng trong N món" ở admin. Bảng admin món thêm cột đầu bếp.
- **(P7)** Thông báo sau khi lưu: redirect `303` kèm `?msg=<mã>`, middleware tra bảng `FLASH` cố định (không in nội dung từ URL ra trang).
- **Sửa lỗi phát hiện khi test:** Express 5 để `req.body` là `undefined` khi POST không có body → đọc `req.body.x` ném lỗi `500`. Thêm middleware `req.body ??= {}` → mọi route nhận dữ liệu thiếu thành `400`/`409`.
- **Sửa lỗi phát hiện khi chụp màn hình:** radio đầu bếp bị kéo rộng 100% (CSS chung của `input` chỉ chừa checkbox); nguyên liệu 1 cột quá dài trên điện thoại → 2 cột.

**Quyết định và lý do:**
- **Chuyển món + xoá trong một transaction:** không bao giờ có trạng thái đã chuyển món mà chưa xoá (hoặc ngược lại); `updateMany` chạy trong transaction nên cả món vừa được gán ở tab khác cũng được chuyển.
- **`409 Conflict`** (người dùng chọn) cho xoá bị chặn: request hợp lệ nhưng xung đột với trạng thái dữ liệu hiện tại; `400` dành cho dữ liệu gửi lên sai.

**Đã kiểm tra:** 9 request không body (POST/PATCH/DELETE) → `400`/`409`, không `500`; xoá "Thịt bò" (3 món) → `409`, còn trong DB; xoá "Nấm hương" → `303`; chuyển 3 món của đầu bếp 1 sang đầu bếp 2 → đầu bếp 2 có 7 món, tổng vẫn 20 món; xoá đầu bếp 0 món → `303`; trùng tên ("tỏi", "SƯỜN HEO", "võ thị mai") → `400`, lưu lại tên cũ của chính mình → `303`; CRUD chefs 25/25, ingredients 25/25; chụp màn hình form (1280/820/360px), trang xoá đầu bếp/nguyên liệu, chi tiết món, danh sách admin có thông báo. Seed lại sau test.
