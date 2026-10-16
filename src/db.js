// Một PrismaClient dùng chung cho cả app: tạo nhiều client sẽ mở nhiều pool kết nối tới Supabase.
// Chỉ dùng ở server; không truyền `prisma` hay `process.env` vào res.render.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

// Supabase pooler bắt buộc SSL và dùng chứng chỉ do Supabase tự cấp (Node không tin sẵn).
// Nạp CA của Supabase để kết nối vừa mã hoá vừa xác minh đúng server, thay vì tắt kiểm tra chứng chỉ.
const ca = readFileSync(new URL("../certs/supabase-ca.crt", import.meta.url), "utf8");

// Prisma 7 bắt buộc driver adapter; adapter-pg dùng thư viện `pg` để nói chuyện với PostgreSQL.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, ssl: { ca } });

export const prisma = new PrismaClient({ adapter });

// P2025: update/delete vào bản ghi không còn tồn tại (vd. vừa bị xoá ở tab khác) → route trả 404 thay vì 500.
export const isNotFound = (err) => err?.code === "P2025";
// P2002: vi phạm @unique (vd. 2 người cùng lưu một tên ở 2 tab) → route trả 400 "tên đã tồn tại".
export const isUniqueViolation = (err) => err?.code === "P2002";
// P2003: vi phạm khoá ngoại (vd. xoá nguyên liệu vừa được gán cho món ở tab khác) → route trả 409 / 400 thay vì 500.
export const isForeignKeyViolation = (err) => err?.code === "P2003";

// Tên đã có (không phân biệt hoa thường) ở bản ghi khác chưa? `delegate` = prisma.chef / prisma.ingredient.
// @unique trong schema phân biệt hoa thường, nên kiểm tra thêm ở app để "tỏi" không trùng với "Tỏi".
export async function nameTaken(delegate, name, excludeId = null) {
  const found = await delegate.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}
