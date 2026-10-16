// Quản trị món ăn. GET chỉ hiển thị; ghi dữ liệu chỉ qua POST / PATCH / DELETE,
// ghi xong luôn redirect 303 (Post/Redirect/Get) để F5 không gửi lại request ghi.
import { Router } from "express";
import { prisma, isNotFound, isForeignKeyViolation } from "../../db.js";
import { parseId } from "../../validators/id.js";
import { validateDish, dishToValues, CATEGORIES } from "../../validators/dish.js";
import { hasErrors, str, searchWhere } from "../../validators/common.js";

const router = Router();

const notFound = (res) => res.status(404).render("404");

// Danh sách đầu bếp + nguyên liệu lấy từ DB ở mỗi lần mở form: form luôn khớp dữ liệu mới nhất,
// và cũng là tập id hợp lệ để kiểm tra lựa chọn người dùng gửi lên.
async function loadOptions() {
  const [chefs, ingredients] = await Promise.all([
    prisma.chef.findMany({ select: { id: true, name: true, specialty: true }, orderBy: { name: "asc" } }),
    prisma.ingredient.findMany({ select: { id: true, name: true, unit: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    chefs,
    ingredients,
    chefIds: new Set(chefs.map((c) => c.id)),
    ingredientIds: new Set(ingredients.map((i) => i.id)),
  };
}

// Form dùng chung cho thêm và sửa: có `id` → form sửa (PATCH), `id` null → form thêm (POST).
const renderForm = (res, options, { status = 200, id = null, values, errors = {} }) =>
  res.status(status).render("admin/dishes/form", {
    id, values, errors, categories: CATEGORIES, chefs: options.chefs, ingredients: options.ingredients,
  });

router.get("/", async (req, res) => {
  // Tìm kiếm qua query string (?q=...): GET chỉ đọc, kết quả bookmark được.
  const q = str(req.query.q);
  const dishes = await prisma.dish.findMany({
    where: searchWhere(q, ["name", "category"]),
    include: { chef: { select: { name: true } } },
    orderBy: { id: "asc" },
  });
  res.render("admin/dishes/index", { dishes, q });
});

router.get("/new", async (req, res) => {
  renderForm(res, await loadOptions(), { values: dishToValues(null) });
});

router.post("/", async (req, res) => {
  const options = await loadOptions();
  const { data, ingredientIds, errors, values } = validateDish(req.body, options);
  // Input sai → 400, không ghi DB, render lại form giữ nguyên giá trị đã nhập (kể cả các ô đã tick).
  if (hasErrors(errors)) return renderForm(res, options, { status: 400, values, errors });

  let created;
  try {
    // Nested create: tạo món + các dòng dish_ingredients trong một lệnh (Prisma bọc trong transaction).
    created = await prisma.dish.create({
      data: { ...data, ingredients: { create: ingredientIds.map((ingredientId) => ({ ingredientId })) } },
    });
  } catch (err) {
    // Đầu bếp/nguyên liệu vừa bị xoá ở tab khác sau lúc kiểm tra → khoá ngoại từ chối → báo chọn lại (400).
    if (isForeignKeyViolation(err)) {
      return renderForm(res, await loadOptions(), {
        status: 400, values, errors: { chefId: "Đầu bếp hoặc nguyên liệu vừa bị xoá, vui lòng chọn lại." },
      });
    }
    throw err;
  }
  // Phải await xong mới redirect; nếu create lỗi khác, Express chuyển sang error handler (500), không báo thành công.
  res.redirect(303, `/dishes/${created.id}?msg=dish-created`);
});

router.get("/:id/edit", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  const dish = await prisma.dish.findUnique({ where: { id }, include: { ingredients: true } });
  if (!dish) return notFound(res);

  renderForm(res, await loadOptions(), { id, values: dishToValues(dish) });
});

router.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return notFound(res);

  // Kiểm tra tồn tại trước validate: id không có thì trả 404, không render form sửa cho bản ghi ma.
  const exists = await prisma.dish.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return notFound(res);

  const options = await loadOptions();
  const { data, ingredientIds, errors, values } = validateDish(req.body, options);
  if (hasErrors(errors)) return renderForm(res, options, { status: 400, id, values, errors });

  try {
    // Thay toàn bộ danh sách nguyên liệu: xoá liên kết cũ rồi tạo lại theo lựa chọn mới, trong cùng một lệnh update.
    await prisma.dish.update({
      where: { id },
      data: {
        ...data,
        ingredients: { deleteMany: {}, create: ingredientIds.map((ingredientId) => ({ ingredientId })) },
      },
    });
  } catch (err) {
    // Bị xoá giữa lúc kiểm tra và lúc update.
    if (isNotFound(err)) return notFound(res);
    if (isForeignKeyViolation(err)) {
      return renderForm(res, await loadOptions(), {
        status: 400, id, values, errors: { chefId: "Đầu bếp hoặc nguyên liệu vừa bị xoá, vui lòng chọn lại." },
      });
    }
    throw err;
  }
  res.redirect(303, `/dishes/${id}?msg=dish-updated`);
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
    // Khoá ngoại dish_ingredients.dishId là Cascade: xoá món thì xoá luôn các dòng liên kết của món.
    // Đầu bếp và nguyên liệu không bị ảnh hưởng (khoá ngoại nằm ở phía món).
    await prisma.dish.delete({ where: { id } });
  } catch (err) {
    if (isNotFound(err)) return notFound(res);
    throw err;
  }
  res.redirect(303, "/admin/dishes?msg=dish-deleted");
});

export default router;
