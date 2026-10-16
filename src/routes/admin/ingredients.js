// Quản trị nguyên liệu — cùng khuôn với admin/dishes.js.
// Khác: không có trang chi tiết (thêm/sửa xong redirect 303 về danh sách), và quy tắc xoá:
// nguyên liệu đang được món nào dùng thì KHÔNG cho xoá (khoá ngoại dish_ingredients.ingredientId là Restrict) → 409.
import { Router } from "express";
import { prisma, isNotFound, isUniqueViolation, isForeignKeyViolation, nameTaken } from "../../db.js";
import { parseId } from "../../validators/id.js";
import { validateIngredient, ingredientToValues } from "../../validators/ingredient.js";
import { hasErrors, str, searchWhere } from "../../validators/common.js";

const router = Router();

const notFound = (res) => res.status(404).render("404");
const DUPLICATE = "Đã có nguyên liệu tên này.";

const renderForm = (res, { status = 200, id = null, values, errors = {} }) =>
  res.status(status).render("admin/ingredients/form", { id, values, errors });

// Trang xác nhận xoá kèm danh sách món đang dùng nguyên liệu (rỗng → được xoá).
async function renderDelete(res, ingredient, { status = 200, error = null } = {}) {
  const dishes = await prisma.dish.findMany({
    where: { ingredients: { some: { ingredientId: ingredient.id } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  res.status(status).render("admin/ingredients/delete", { ingredient, dishes, error });
}

router.get("/", async (req, res) => {
  const q = str(req.query.q);
  const ingredients = await prisma.ingredient.findMany({
    where: searchWhere(q, ["name", "unit"]),
    // Số món đang dùng: admin biết trước nguyên liệu nào xoá được (0 món).
    include: { _count: { select: { dishes: true } } },
    orderBy: { id: "asc" },
  });
  res.render("admin/ingredients/index", { ingredients, q });
});

router.get("/new", (req, res) => {
  renderForm(res, { values: ingredientToValues(null) });
});

router.post("/", async (req, res) => {
  const { data, errors, values } = validateIngredient(req.body);
  // Tên không được trùng (không phân biệt hoa thường): danh sách tick trong form món không có 2 dòng "Thịt bò".
  if (!errors.name && (await nameTaken(prisma.ingredient, data.name))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return renderForm(res, { status: 400, values, errors });

  try {
    await prisma.ingredient.create({ data });
  } catch (err) {
    if (isUniqueViolation(err)) return renderForm(res, { status: 400, values, errors: { name: DUPLICATE } });
    throw err;
  }
  res.redirect(303, "/admin/ingredients?msg=ingredient-created");
});

router.get("/:id/edit", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) return notFound(res);

  renderForm(res, { id, values: ingredientToValues(ingredient) });
});

router.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const exists = await prisma.ingredient.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFound(res);

  const { data, errors, values } = validateIngredient(req.body);
  if (!errors.name && (await nameTaken(prisma.ingredient, data.name, id))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return renderForm(res, { status: 400, id, values, errors });

  try {
    await prisma.ingredient.update({ where: { id }, data });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    if (isUniqueViolation(err)) return renderForm(res, { status: 400, id, values, errors: { name: DUPLICATE } });
    throw err;
  }
  res.redirect(303, "/admin/ingredients?msg=ingredient-updated");
});

// Trang xác nhận xoá: GET chỉ hiển thị. Đang được dùng → liệt kê món, không có nút Xoá.
router.get("/:id/delete", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) return notFound(res);

  await renderDelete(res, ingredient);
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const ingredient = await prisma.ingredient.findUnique({ where: { id }, include: { _count: { select: { dishes: true } } } });
  if (!ingredient) return notFound(res);

  // Lớp 1 (app): còn món dùng → 409 Conflict, không gửi lệnh xoá xuống DB.
  const blocked = "Nguyên liệu đang được dùng trong món ăn nên không thể xoá. Hãy bỏ nguyên liệu khỏi các món dưới đây trước.";
  if (ingredient._count.dishes > 0) return renderDelete(res, ingredient, { status: 409, error: blocked });

  try {
    await prisma.ingredient.delete({ where: { id } });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    // Lớp 2 (database): món vừa được gán nguyên liệu này ở tab khác → khoá ngoại Restrict chặn → 409.
    if (isForeignKeyViolation(err)) return renderDelete(res, ingredient, { status: 409, error: blocked });
    throw err;
  }
  res.redirect(303, "/admin/ingredients?msg=ingredient-deleted");
});

export default router;
