import { str } from "./common.js";

// Cùng khuôn với validateDish: trả data (chỉ các cột của Chef), errors, values.
export function validateChef(body) {
  const values = { name: str(body.name), specialty: str(body.specialty) };

  const errors = {};
  if (!values.name) errors.name = "Tên đầu bếp không được để trống.";

  const data = { name: values.name, specialty: values.specialty || null };
  return { data, errors, values };
}

export function chefToValues(chef) {
  if (!chef) return { name: "", specialty: "" };
  return { name: chef.name, specialty: chef.specialty ?? "" };
}
