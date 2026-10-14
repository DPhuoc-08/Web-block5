// Quản trị món ăn. GET chỉ hiển thị; ghi dữ liệu chỉ qua POST / PATCH / DELETE,
// ghi xong luôn redirect 303 (Post/Redirect/Get) để F5 không gửi lại request ghi.
import { Router } from "express";
import { prisma, isNotFound } from "../../db.js";
import { parseId } from "../../validators/id.js";
import { validateDish, dishToValues } from "../../validators/dish.js";
import { hasErrors } from "../../validators/common.js";

const router = Router();

const notFound = (res) => res.status(404).render("404");

// Form dùng chung cho thêm và sửa: có `id` → form sửa (PATCH), `id` null → form thêm (POST).
const renderForm = (res, { status = 200, id = null, values, errors = {} }) =>
  res.status(status).render("admin/dishes/form", { id, values, errors });

router.get("/", async (req, res) => {
  const dishes = await prisma.dish.findMany({ orderBy: { id: "asc" } });
  res.render("admin/dishes/index", { dishes });
});

router.get("/new", (req, res) => {
  renderForm(res, { values: dishToValues(null) });
});

router.post("/", async (req, res) => {
  const { data, errors, values } = validateDish(req.body);
  // Input sai → 400, không ghi DB, render lại form giữ nguyên giá trị đã nhập.
  if (hasErrors(errors)) return renderForm(res, { status: 400, values, errors });

  // Phải await xong mới redirect; nếu create lỗi, Express chuyển sang error handler (500), không báo thành công.
  const created = await prisma.dish.create({ data });
  res.redirect(303, `/dishes/${created.id}`);
});

router.get("/:id/edit", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const dish = await prisma.dish.findUnique({ where: { id } });
  if (!dish) return notFound(res);

  renderForm(res, { id, values: dishToValues(dish) });
});

router.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  // Kiểm tra tồn tại trước validate: id không có thì trả 404, không render form sửa cho bản ghi ma.
  const exists = await prisma.dish.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFound(res);

  const { data, errors, values } = validateDish(req.body);
  if (hasErrors(errors)) return renderForm(res, { status: 400, id, values, errors });

  try {
    await prisma.dish.update({ where: { id }, data });
  } catch (err) {
    // Bị xoá giữa lúc kiểm tra và lúc update.
    if (isNotFound(err)) return notFound(res);
    throw err;
  }
  res.redirect(303, `/dishes/${id}`);
});

// Trang xác nhận xoá: GET chỉ hiển thị, không xoá gì.
router.get("/:id/delete", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const dish = await prisma.dish.findUnique({ where: { id } });
  if (!dish) return notFound(res);

  res.render("admin/dishes/delete", { dish });
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  try {
    await prisma.dish.delete({ where: { id } });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    throw err;
  }
  res.redirect(303, "/admin/dishes");
});

export default router;
