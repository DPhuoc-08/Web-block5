// Quản trị đầu bếp — cùng khuôn với admin/dishes.js.
// Khác: không có trang chi tiết (thêm/sửa xong redirect 303 về danh sách), và quy tắc xoá:
// đầu bếp còn phụ trách món thì KHÔNG xoá thẳng được (khoá ngoại dishes.chefId là Restrict) —
// admin phải chọn đầu bếp nhận lại các món; chuyển món + xoá chạy trong một transaction.
import { Router } from "express";
import { prisma, isNotFound, isUniqueViolation, isForeignKeyViolation, nameTaken } from "../../db.js";
import { parseId } from "../../validators/id.js";
import { validateChef, chefToValues } from "../../validators/chef.js";
import { hasErrors, str, searchWhere } from "../../validators/common.js";

const router = Router();

const notFound = (res) => res.status(404).render("404");
const DUPLICATE = "Đã có đầu bếp tên này.";

const renderForm = (res, { status = 200, id = null, values, errors = {} }) =>
  res.status(status).render("admin/chefs/form", { id, values, errors });

// Dữ liệu cho trang xác nhận xoá: các món đầu bếp đang phụ trách + các đầu bếp khác có thể nhận món.
async function renderDelete(res, chef, { status = 200, error = null, transferTo = "" } = {}) {
  const [dishes, otherChefs] = await Promise.all([
    prisma.dish.findMany({ where: { chefId: chef.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.chef.findMany({ where: { NOT: { id: chef.id } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  res.status(status).render("admin/chefs/delete", { chef, dishes, otherChefs, error, transferTo });
}

router.get("/", async (req, res) => {
  const q = str(req.query.q);
  const chefs = await prisma.chef.findMany({
    where: searchWhere(q, ["name", "specialty"]),
    // Số món đang phụ trách: admin biết trước đầu bếp nào xoá thẳng được, ai phải chuyển món trước.
    include: { _count: { select: { dishes: true } } },
    orderBy: { id: "asc" },
  });
  res.render("admin/chefs/index", { chefs, q });
});

router.get("/new", (req, res) => {
  renderForm(res, { values: chefToValues(null) });
});

router.post("/", async (req, res) => {
  const { data, errors, values } = validateChef(req.body);
  // Tên không được trùng (không phân biệt hoa thường), để danh sách chọn đầu bếp trong form món không bị lẫn.
  if (!errors.name && (await nameTaken(prisma.chef, data.name))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return renderForm(res, { status: 400, values, errors });

  try {
    await prisma.chef.create({ data });
  } catch (err) {
    // Hai request cùng lưu một tên gần như cùng lúc: @unique ở database chặn request sau.
    if (isUniqueViolation(err)) return renderForm(res, { status: 400, values, errors: { name: DUPLICATE } });
    throw err;
  }
  res.redirect(303, "/admin/chefs?msg=chef-created");
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
  if (!errors.name && (await nameTaken(prisma.chef, data.name, id))) errors.name = DUPLICATE;
  if (hasErrors(errors)) return renderForm(res, { status: 400, id, values, errors });

  try {
    await prisma.chef.update({ where: { id }, data });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    if (isUniqueViolation(err)) return renderForm(res, { status: 400, id, values, errors: { name: DUPLICATE } });
    throw err;
  }
  res.redirect(303, "/admin/chefs?msg=chef-updated");
});

// Trang xác nhận xoá: GET chỉ hiển thị. Nếu đầu bếp còn món → hiện danh sách món + form chọn người nhận.
router.get("/:id/delete", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const chef = await prisma.chef.findUnique({ where: { id } });
  if (!chef) return notFound(res);

  await renderDelete(res, chef);
});

router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const chef = await prisma.chef.findUnique({ where: { id }, include: { _count: { select: { dishes: true } } } });
  if (!chef) return notFound(res);

  // Không còn món nào: xoá thẳng.
  if (chef._count.dishes === 0) {
    try {
      await prisma.chef.delete({ where: { id } });
    } catch (err) {
      if (isNotFound(err)) return notFound(res);
      // Vừa có món được gán cho đầu bếp này ở tab khác → khoá ngoại chặn → 409, hiện form chuyển món.
      if (isForeignKeyViolation(err)) {
        return renderDelete(res, chef, { status: 409, error: "Đầu bếp vừa được gán món mới. Hãy chọn người nhận các món rồi xoá." });
      }
      throw err;
    }
    return res.redirect(303, "/admin/chefs?msg=chef-deleted");
  }

  // Còn món: bắt buộc chọn đầu bếp nhận món.
  const rawTarget = str(req.body.transferTo);
  if (!rawTarget) {
    return renderDelete(res, chef, { status: 409, error: "Đầu bếp đang phụ trách món. Hãy chọn người nhận các món trước khi xoá." });
  }
  const targetId = parseId(rawTarget);
  const target = targetId && targetId !== id ? await prisma.chef.findUnique({ where: { id: targetId }, select: { id: true } }) : null;
  if (!target) {
    return renderDelete(res, chef, { status: 400, error: "Đầu bếp nhận món không hợp lệ, vui lòng chọn lại.", transferTo: rawTarget });
  }

  try {
    // Một transaction: chuyển TẤT CẢ món hiện có (kể cả món vừa được gán) sang người nhận, rồi xoá đầu bếp.
    // Bước nào lỗi thì cả hai cùng huỷ — không bao giờ có cảnh đã chuyển món mà chưa xoá, hay ngược lại.
    await prisma.$transaction([
      prisma.dish.updateMany({ where: { chefId: id }, data: { chefId: targetId } }),
      prisma.chef.delete({ where: { id } }),
    ]);
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    // Người nhận vừa bị xoá ở tab khác → khoá ngoại chặn khi chuyển món.
    if (isForeignKeyViolation(err)) {
      return renderDelete(res, chef, { status: 409, error: "Đầu bếp nhận món vừa bị xoá, vui lòng chọn người khác." });
    }
    throw err;
  }
  res.redirect(303, "/admin/chefs?msg=chef-transferred");
});

export default router;
