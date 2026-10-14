import { str } from "./common.js";

// Cùng khuôn với validateDish: trả data (chỉ các cột của Ingredient), errors, values.
export function validateIngredient(body) {
  const values = { name: str(body.name), unit: str(body.unit) };

  const errors = {};
  if (!values.name) errors.name = "Tên nguyên liệu không được để trống.";

  const data = { name: values.name, unit: values.unit || null };
  return { data, errors, values };
}

export function ingredientToValues(ingredient) {
  if (!ingredient) return { name: "", unit: "" };
  return { name: ingredient.name, unit: ingredient.unit ?? "" };
}
