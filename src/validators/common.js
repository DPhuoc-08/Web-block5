// Dữ liệu form luôn là chuỗi; trường lặp (`name=a&name=b`) thành mảng → coi như rỗng.
export const str = (v) => (typeof v === "string" ? v.trim() : "");

export const hasErrors = (errors) => Object.keys(errors).length > 0;

// Điều kiện tìm kiếm cho trang danh sách admin: từ khoá khớp (không phân biệt hoa thường) ở BẤT KỲ cột nào trong `fields`.
// Không có từ khoá → {} (lấy tất cả). Prisma gửi `q` dạng tham số, không nối vào SQL.
export const searchWhere = (q, fields) =>
  q ? { OR: fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" } })) } : {};
