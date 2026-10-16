// Phân hệ người dùng: chỉ đọc (GET). Mỗi request đọc lại database nên trang luôn khớp dữ liệu mới nhất.
import { Router } from "express";
import { prisma } from "../db.js";
import { parseId } from "../validators/id.js";
import { parseMenuFilters, PRICE_RANGES, SORTS } from "../validators/menu-filters.js";

const router = Router();

// Gom món theo loại, giữ thứ tự loại xuất hiện; món không có loại xếp cuối vào nhóm "Khác".
function groupByCategory(dishes) {
  const groups = new Map();
  for (const dish of dishes) {
    const key = dish.category ?? "Khác";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(dish);
  }
  const list = [...groups].map(([name, items]) => ({ name, dishes: items }));
  return list.sort((a, b) => (a.name === "Khác") - (b.name === "Khác"));
}

router.get("/dishes", async (req, res) => {
  // Danh sách loại lấy từ DB: vừa làm lựa chọn trong bộ lọc, vừa để kiểm tra ?category= hợp lệ.
  const categoryRows = await prisma.dish.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  const categories = categoryRows.map((row) => row.category);

  // Mọi tiêu chí lọc đi qua query string (?q=&category=&price=&available=1&sort=).
  const { filters, where, orderBy, isFiltered } = parseMenuFilters(req.query, categories);
  const dishes = await prisma.dish.findMany({ where, orderBy });

  // Dựng URL /dishes?... từ bộ lọc hiện tại + thay đổi: chip loại giữ nguyên các tiêu chí khác đang chọn.
  const filterUrl = (changes) => {
    const next = { ...filters, ...changes };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.category) params.set("category", next.category);
    if (next.price) params.set("price", next.price);
    if (next.available) params.set("available", "1");
    if (next.sort) params.set("sort", next.sort);
    const qs = params.toString();
    return qs ? `/dishes?${qs}` : "/dishes";
  };

  res.render("dishes/index", {
    filterUrl,
    dishes,
    // Sắp xếp mặc định → hiển thị theo nhóm loại như thực đơn; chọn sắp xếp khác → một danh sách phẳng.
    groups: filters.sort ? null : groupByCategory(dishes),
    filters,
    isFiltered,
    categories,
    priceRanges: PRICE_RANGES,
    sorts: SORTS,
  });
});

router.get("/dishes/:id", async (req, res) => {
  // Path param xác định bản ghi. Sai định dạng → 404 luôn, không truy vấn DB.
  const id = parseId(req.params.id);
  if (id === null) return res.status(404).render("404");

  const dish = await prisma.dish.findUnique({ where: { id } });
  if (!dish) return res.status(404).render("404");

  res.render("dishes/show", { dish });
});

export default router;
