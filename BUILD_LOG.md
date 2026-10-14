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
