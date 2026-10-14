const MAX_INT = 2147483647;

// Dữ liệu form luôn là chuỗi; trường lặp (`name=a&name=b`) thành mảng → coi như rỗng.
const str = (v) => (typeof v === "string" ? v.trim() : "");

// Nhận req.body, trả về:
// - data:   object sạch, chỉ gồm các cột của Dish → đưa vào prisma.dish.create/update
// - errors: { tênTrường: thông báo }; rỗng nghĩa là hợp lệ
// - values: giá trị người dùng đã nhập, để render lại form khi 400
// Không bao giờ đưa nguyên req.body vào Prisma: body có thể chứa trường lạ (id, createdAt...).
export function validateDish(body) {
  const values = {
    name: str(body.name),
    price: str(body.price),
    category: str(body.category),
    description: str(body.description),
    // Checkbox bỏ trống thì trình duyệt không gửi trường này.
    available: body.available === "on",
  };

  const errors = {};
  if (!values.name) errors.name = "Tên món không được để trống.";

  if (!values.price) {
    errors.price = "Giá không được để trống.";
  } else if (!/^\d+$/.test(values.price) || Number(values.price) > MAX_INT) {
    errors.price = "Giá phải là số nguyên không âm (đơn vị đồng), ví dụ 50000.";
  }

  const data = {
    name: values.name,
    price: Number(values.price),
    category: values.category || null,
    description: values.description || null,
    available: values.available,
  };

  return { data, errors, values };
}

// Giá trị ban đầu của form: trống khi thêm mới, lấy từ bản ghi khi sửa.
export function dishToValues(dish) {
  if (!dish) return { name: "", price: "", category: "", description: "", available: true };
  return {
    name: dish.name,
    price: String(dish.price),
    category: dish.category ?? "",
    description: dish.description ?? "",
    available: dish.available,
  };
}
