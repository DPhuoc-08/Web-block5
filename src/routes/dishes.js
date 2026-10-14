// Phân hệ người dùng: chỉ đọc (GET). Mỗi request đọc lại database nên trang luôn khớp dữ liệu mới nhất.
import { Router } from "express";
import { prisma } from "../db.js";
import { parseId } from "../validators/id.js";

const router = Router();

router.get("/dishes", async (req, res) => {
  // Điều kiện tìm kiếm đi qua query string. `?q=a&q=b` cho ra mảng → chỉ nhận khi là chuỗi.
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const dishes = await prisma.dish.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { id: "asc" },
  });
  res.render("dishes/index", { dishes, q });
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
