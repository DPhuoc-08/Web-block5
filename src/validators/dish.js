import { str } from "./common.js";
import { parseId } from "./id.js";

const MAX_INT = 2147483647;

// Loại món chọn từ danh sách cố định (select), không gõ tự do: tránh "món nước" và "Món nước" thành 2 loại khác nhau.
export const CATEGORIES = ["Khai vị", "Món nước", "Món cơm", "Món xào", "Món chiên", "Tráng miệng", "Đồ uống"];

// Link ảnh chỉ nhận http(s): chặn `javascript:`, `data:`... vì giá trị này được đặt vào <img src>.
function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Checkbox cùng name: tick 1 ô → chuỗi, tick nhiều ô → mảng, không tick → undefined. Đưa về mảng chuỗi.
const asList = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).filter((x) => typeof x === "string");

// Nhận req.body và các id hợp lệ đang có trong DB, trả về:
// - data:   object sạch → đưa vào prisma.dish.create/update (route tự dựng phần nguyên liệu từ ingredientIds)
// - errors: { tênTrường: thông báo }; rỗng nghĩa là hợp lệ
// - values: giá trị người dùng đã nhập (kể cả các ô đã tick), để render lại form khi 400
// Không bao giờ đưa nguyên req.body vào Prisma: body có thể chứa trường lạ (id, createdAt...).
export function validateDish(body, { chefIds, ingredientIds }) {
  const pickedIngredients = asList(body.ingredientIds).map(parseId);

  const values = {
    name: str(body.name),
    price: str(body.price),
    category: str(body.category),
    description: str(body.description),
    imageUrl: str(body.imageUrl),
    imageCredit: str(body.imageCredit),
    // Checkbox bỏ trống thì trình duyệt không gửi trường này.
    available: body.available === "on",
    chefId: str(body.chefId),
    // Bỏ trùng; giữ cả id lạ (null) để báo lỗi bên dưới.
    ingredientIds: [...new Set(pickedIngredients)],
  };

  const errors = {};
  if (!values.name) errors.name = "Tên món không được để trống.";

  if (!values.price) {
    errors.price = "Giá không được để trống.";
  } else if (!/^\d+$/.test(values.price) || Number(values.price) > MAX_INT) {
    errors.price = "Giá phải là số nguyên không âm (đơn vị đồng), ví dụ 50000.";
  }

  if (!CATEGORIES.includes(values.category)) errors.category = "Vui lòng chọn loại món.";

  // Đầu bếp: bắt buộc, và id gửi lên phải có thật trong DB (form có thể bị sửa tay để gửi id bịa).
  const chefId = parseId(values.chefId);
  if (!values.chefId) {
    errors.chefId = "Vui lòng chọn đầu bếp phụ trách.";
  } else if (chefId === null || !chefIds.has(chefId)) {
    errors.chefId = "Đầu bếp đã chọn không tồn tại, vui lòng chọn lại.";
  }

  // Nguyên liệu: ít nhất 1, và mọi id phải có thật trong DB.
  if (values.ingredientIds.length === 0) {
    errors.ingredientIds = "Vui lòng chọn ít nhất một nguyên liệu.";
  } else if (values.ingredientIds.some((id) => id === null || !ingredientIds.has(id))) {
    errors.ingredientIds = "Có nguyên liệu không tồn tại, vui lòng chọn lại.";
  }

  // Ảnh không bắt buộc; có nhập thì phải là link http(s) hợp lệ.
  if (values.imageUrl && (!isHttpUrl(values.imageUrl) || values.imageUrl.length > 1000)) {
    errors.imageUrl = "Link ảnh phải bắt đầu bằng http:// hoặc https:// (tối đa 1000 ký tự).";
  }
  if (values.imageCredit.length > 200) {
    errors.imageCredit = "Ghi công ảnh tối đa 200 ký tự.";
  }

  const data = {
    name: values.name,
    price: Number(values.price),
    category: values.category,
    description: values.description || null,
    imageUrl: values.imageUrl || null,
    imageCredit: values.imageCredit || null,
    available: values.available,
    chefId,
  };

  return { data, ingredientIds: values.ingredientIds, errors, values };
}

// Giá trị ban đầu của form: trống khi thêm mới, lấy từ bản ghi (kèm nguyên liệu) khi sửa.
export function dishToValues(dish) {
  if (!dish) {
    return {
      name: "", price: "", category: "", description: "", imageUrl: "", imageCredit: "",
      available: true, chefId: "", ingredientIds: [],
    };
  }
  return {
    name: dish.name,
    price: String(dish.price),
    category: dish.category ?? "",
    description: dish.description ?? "",
    imageUrl: dish.imageUrl ?? "",
    imageCredit: dish.imageCredit ?? "",
    available: dish.available,
    chefId: String(dish.chefId),
    ingredientIds: dish.ingredients.map((link) => link.ingredientId),
  };
}
