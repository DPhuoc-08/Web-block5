import { str } from "./common.js";

// Bộ lọc thực đơn đi qua query string (GET): điều kiện hiển thị, không phải dữ liệu ghi.
// Giá trị lạ hoặc sai (?price=abc, ?sort=xyz, loại không tồn tại) bị bỏ qua → dùng mặc định,
// không trả 400: người dùng chỉ đang xem, sửa tay URL sai thì vẫn thấy thực đơn.

export const PRICE_RANGES = [
  { value: "duoi-40k", label: "Dưới 40.000đ", where: { lt: 40000 } },
  { value: "40k-60k", label: "40.000đ – 60.000đ", where: { gte: 40000, lte: 60000 } },
  { value: "tren-60k", label: "Trên 60.000đ", where: { gt: 60000 } },
];

export const SORTS = [
  { value: "", label: "Theo loại món", orderBy: { id: "asc" } },
  { value: "gia-tang", label: "Giá thấp → cao", orderBy: { price: "asc" } },
  { value: "gia-giam", label: "Giá cao → thấp", orderBy: { price: "desc" } },
  { value: "ten", label: "Tên A → Z", orderBy: { name: "asc" } },
];

// `categories`: danh sách loại đang có trong DB, để chỉ nhận loại hợp lệ.
export function parseMenuFilters(query, categories) {
  const q = str(query.q);
  const category = categories.includes(str(query.category)) ? str(query.category) : "";
  const price = PRICE_RANGES.find((p) => p.value === str(query.price));
  const sort = SORTS.find((s) => s.value === str(query.sort)) ?? SORTS[0];
  const onlyAvailable = query.available === "1";

  // Các điều kiện ghép bằng AND: món phải thoả tất cả tiêu chí đang chọn.
  const conditions = [];
  if (q) conditions.push({ name: { contains: q, mode: "insensitive" } });
  if (category) conditions.push({ category });
  if (price) conditions.push({ price: price.where });
  if (onlyAvailable) conditions.push({ available: true });

  return {
    filters: { q, category, price: price?.value ?? "", sort: sort.value, available: onlyAvailable },
    where: conditions.length ? { AND: conditions } : {},
    orderBy: [sort.orderBy, { id: "asc" }],
    // Đang lọc gì đó (khác mặc định) → view hiện số kết quả và nút xoá bộ lọc.
    isFiltered: Boolean(q || category || price || onlyAvailable || sort.value),
  };
}
