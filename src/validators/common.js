// Dữ liệu form luôn là chuỗi; trường lặp (`name=a&name=b`) thành mảng → coi như rỗng.
export const str = (v) => (typeof v === "string" ? v.trim() : "");

export const hasErrors = (errors) => Object.keys(errors).length > 0;
