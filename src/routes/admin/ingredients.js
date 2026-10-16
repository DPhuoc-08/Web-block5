// Quản trị nguyên liệu — cùng khuôn với admin/dishes.js.
// Khác duy nhất: không có trang chi tiết, nên thêm/sửa xong redirect 303 về danh sách.
import { Router } from "express";
import { prisma, isNotFound } from "../../db.js";
import { parseId } from "../../validators/id.js";
import { validateIngredient, ingredientToValues } from "../../validators/ingredient.js";
import { hasErrors, str, searchWhere } from "../../validators/common.js";

const router = Router();

const notFound = (res) => res.status(404).render("404");

const renderForm = (res, { status = 200, id = null, values, errors = {} }) =>
  res.status(status).render("admin/ingredients/form", { id, values, errors });

router.get("/", async (req, res) => {
  const q = str(req.query.q);
  const ingredients = await prisma.ingredient.findMany({ where: searchWhere(q, ["name", "unit"]), orderBy: { id: "asc" } });
  res.render("admin/ingredients/index", { ingredients, q });
});

router.get("/new", (req, res) => {
  renderForm(res, { values: ingredientToValues(null) });
});

router.post("/", async (req, res) => {
  const { data, errors, values } = validateIngredient(req.body);
  if (hasErrors(errors)) return renderForm(res, { status: 400, values, errors });

  await prisma.ingredient.create({ data });
  res.redirect(303, "/admin/ingredients");
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
  if (hasErrors(errors)) return renderForm(res, { status: 400, id, values, errors });

  try {
    await prisma.ingredient.update({ where: { id }, data });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    throw err;
  }
  res.redirect(303, "/admin/ingredients");
});

router.get("/:id/delete", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const ingredient = await prisma.ingredient.findUnique({ where: { id } });
  if (!ingredient) return notFound(res);

  res.render("admin/ingredients/delete", { ingredient });
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  try {
    await prisma.ingredient.delete({ where: { id } });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    throw err;
  }
  res.redirect(303, "/admin/ingredients");
});

export default router;
