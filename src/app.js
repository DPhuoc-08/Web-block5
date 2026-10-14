import express from "express";
import methodOverride from "method-override";
import { fileURLToPath } from "node:url";
import dishesRouter from "./routes/dishes.js";
import adminDishesRouter from "./routes/admin/dishes.js";
import adminChefsRouter from "./routes/admin/chefs.js";
import adminIngredientsRouter from "./routes/admin/ingredients.js";

const app = express();

app.set("view engine", "ejs");
app.set("views", fileURLToPath(new URL("./views", import.meta.url)));

// Parse body của form HTML (application/x-www-form-urlencoded) thành req.body.
app.use(express.urlencoded({ extended: false }));

// Form HTML chỉ gửi được GET/POST. Browser gửi POST kèm ?_method=PATCH|DELETE,
// middleware đổi req.method trước khi tới router để khớp router.patch / router.delete.
// Phải đặt trước các router.
app.use(methodOverride("_method"));

app.get("/", (req, res) => res.redirect("/dishes"));
app.use(dishesRouter);
app.get("/admin", (req, res) => res.redirect("/admin/dishes"));
app.use("/admin/dishes", adminDishesRouter);
app.use("/admin/chefs", adminChefsRouter);
app.use("/admin/ingredients", adminIngredientsRouter);

// Không route nào khớp → 404.
app.use((req, res) => {
  res.status(404).render("404");
});

// Express 5 tự chuyển lỗi của handler async tới đây.
// Ghi stack vào log server; người dùng chỉ thấy thông báo chung, không thấy err.message của DB.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render("500");
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
});
