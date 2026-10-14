import express from "express";
import { fileURLToPath } from "node:url";
import dishesRouter from "./routes/dishes.js";

const app = express();

app.set("view engine", "ejs");
app.set("views", fileURLToPath(new URL("./views", import.meta.url)));

// Parse body của form HTML (application/x-www-form-urlencoded) thành req.body.
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => res.redirect("/dishes"));
app.use(dishesRouter);

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
