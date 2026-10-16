// Quản trị đầu bếp — cùng khuôn với admin/dishes.js.
// Khác duy nhất: không có trang chi tiết, nên thêm/sửa xong redirect 303 về danh sách.
import { Router } from "express";
import { prisma, isNotFound } from "../../db.js";
import { parseId } from "../../validators/id.js";
import { validateChef, chefToValues } from "../../validators/chef.js";
import { hasErrors, str, searchWhere } from "../../validators/common.js";

const router = Router();

const notFound = (res) => res.status(404).render("404");

const renderForm = (res, { status = 200, id = null, values, errors = {} }) =>
  res.status(status).render("admin/chefs/form", { id, values, errors });

router.get("/", async (req, res) => {
  const q = str(req.query.q);
  const chefs = await prisma.chef.findMany({ where: searchWhere(q, ["name", "specialty"]), orderBy: { id: "asc" } });
  res.render("admin/chefs/index", { chefs, q });
});

router.get("/new", (req, res) => {
  renderForm(res, { values: chefToValues(null) });
});

router.post("/", async (req, res) => {
  const { data, errors, values } = validateChef(req.body);
  if (hasErrors(errors)) return renderForm(res, { status: 400, values, errors });

  await prisma.chef.create({ data });
  res.redirect(303, "/admin/chefs");
});

router.get("/:id/edit", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const chef = await prisma.chef.findUnique({ where: { id } });
  if (!chef) return notFound(res);

  renderForm(res, { id, values: chefToValues(chef) });
});

router.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const exists = await prisma.chef.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFound(res);

  const { data, errors, values } = validateChef(req.body);
  if (hasErrors(errors)) return renderForm(res, { status: 400, id, values, errors });

  try {
    await prisma.chef.update({ where: { id }, data });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    throw err;
  }
  res.redirect(303, "/admin/chefs");
});

router.get("/:id/delete", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const chef = await prisma.chef.findUnique({ where: { id } });
  if (!chef) return notFound(res);

  res.render("admin/chefs/delete", { chef });
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  try {
    await prisma.chef.delete({ where: { id } });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    throw err;
  }
  res.redirect(303, "/admin/chefs");
});

export default router;
