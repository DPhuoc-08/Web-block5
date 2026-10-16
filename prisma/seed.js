// Nạp dữ liệu mẫu cho cả bốn bảng. Chạy: `npx prisma db seed` (lệnh khai báo trong prisma.config.js).
// Dữ liệu đủ để test: 20 món / 7 loại, 7 đầu bếp, 30 nguyên liệu. Cố ý có:
//   - 1 đầu bếp chưa phụ trách món nào (xoá được ngay) và các đầu bếp đang phụ trách món (phải chuyển món trước khi xoá)
//   - 1 nguyên liệu chưa món nào dùng (xoá được) và các nguyên liệu dùng chung nhiều món (bị chặn xoá)
//   - 2 món tạm hết, 1 món chưa có ảnh, 1 món chưa có mô tả
import { prisma } from "../src/db.js";

const commons = "https://upload.wikimedia.org/wikipedia/commons/thumb";

const CHEFS = [
  { name: "Nguyễn Văn An", specialty: "Món nước miền Bắc" },
  { name: "Trần Thị Bích", specialty: "Món nướng, món cơm" },
  { name: "Lê Hoàng Minh", specialty: "Tráng miệng" },
  { name: "Phạm Quốc Huy", specialty: "Món xào, món chiên" },
  { name: "Võ Thị Mai", specialty: "Món miền Trung" },
  { name: "Đặng Gia Bảo", specialty: "Đồ uống" },
  { name: "Bùi Thanh Tâm", specialty: "Phụ bếp" }, // chưa phụ trách món nào
];

const INGREDIENTS = [
  ["Thịt bò", "kg"], ["Thịt heo", "kg"], ["Sườn heo", "kg"], ["Giò heo", "kg"], ["Gà ta", "con"],
  ["Cánh gà", "kg"], ["Tôm sú", "kg"], ["Cá basa", "kg"], ["Trứng gà", "quả"], ["Bánh phở", "kg"],
  ["Bún tươi", "kg"], ["Hủ tiếu khô", "kg"], ["Sợi mì Quảng", "kg"], ["Bánh tráng", "xấp"], ["Gạo tấm", "kg"],
  ["Gạo thơm", "kg"], ["Bột gạo", "kg"], ["Rau thơm", "bó"], ["Rau muống", "bó"], ["Giá đỗ", "kg"],
  ["Hành lá", "bó"], ["Tỏi", "kg"], ["Sả", "kg"], ["Nước mắm", "lít"], ["Đậu xanh", "kg"],
  ["Nước cốt dừa", "lít"], ["Sữa đặc", "hộp"], ["Cà phê", "kg"], ["Quả bơ", "kg"],
  ["Nấm hương", "kg"], // chưa món nào dùng
];

// [tên, loại, giá, mô tả, đầu bếp, [nguyên liệu], ảnh, ghi công ảnh, còn phục vụ]
const DISHES = [
  ["Phở bò tái", "Món nước", 55000, "Nước dùng hầm xương 12 tiếng, bánh phở tươi.", "Nguyễn Văn An",
    ["Thịt bò", "Bánh phở", "Hành lá", "Rau thơm"],
    `${commons}/4/42/Ph%E1%BB%9F_b%C3%B2_in_a_German_restaurant_01.jpg/960px-Ph%E1%BB%9F_b%C3%B2_in_a_German_restaurant_01.jpg`,
    "Kritzolina · CC BY-SA 4.0 · Wikimedia Commons"],
  ["Bún chả Hà Nội", "Món nước", 50000, "Chả nướng than hoa, ăn kèm bún và rau sống.", "Nguyễn Văn An",
    ["Thịt heo", "Bún tươi", "Nước mắm", "Rau thơm"],
    `${commons}/4/4d/B%C3%BAn_ch%E1%BA%A3_Vietnamese_food.jpg/960px-B%C3%BAn_ch%E1%BA%A3_Vietnamese_food.jpg`,
    "stuart_spivack · CC BY 2.0 · Wikimedia Commons"],
  ["Bún bò Huế", "Món nước", 55000, "Nước dùng sả ớt, giò heo, bún sợi to.", "Võ Thị Mai",
    ["Thịt bò", "Giò heo", "Bún tươi", "Sả", "Rau thơm"], null, null],
  ["Hủ tiếu Nam Vang", "Món nước", 50000, "Hủ tiếu dai, thịt heo, tôm, nước dùng ngọt thanh.", "Nguyễn Văn An",
    ["Hủ tiếu khô", "Thịt heo", "Tôm sú", "Hành lá", "Giá đỗ"], null, null],
  ["Mì Quảng", "Món nước", 45000, "Sợi mì vàng, tôm thịt, ăn kèm bánh tráng nướng.", "Võ Thị Mai",
    ["Sợi mì Quảng", "Tôm sú", "Thịt heo", "Bánh tráng", "Rau thơm"], null, null],
  ["Cơm tấm sườn bì", "Món cơm", 60000, "Sườn nướng mật ong, bì, chả trứng.", "Trần Thị Bích",
    ["Gạo tấm", "Sườn heo", "Trứng gà", "Nước mắm"],
    `${commons}/0/0f/C%C6%A1m_t%E1%BA%A5m_SG_l%E1%BB%81_%C4%91%C6%B0%E1%BB%9Dng_%28c%C6%A1m_s%C6%B0%E1%BB%9Dn%2C_mi%E1%BA%BFng_s%C6%B0%E1%BB%9Dn_n%C6%B0%E1%BB%9Bng_m%E1%BA%ADt_ong%29_ng30th7n2022_%281%29.jpg/960px-C%C6%A1m_t%E1%BA%A5m_SG_l%E1%BB%81_%C4%91%C6%B0%E1%BB%9Dng_%28c%C6%A1m_s%C6%B0%E1%BB%9Dn%2C_mi%E1%BA%BFng_s%C6%B0%E1%BB%9Dn_n%C6%B0%E1%BB%9Bng_m%E1%BA%ADt_ong%29_ng30th7n2022_%281%29.jpg`,
    "Phương Huy · CC0 · Wikimedia Commons"],
  ["Cơm gà Hội An", "Món cơm", 55000, "Cơm nấu nước luộc gà, gà xé trộn rau răm.", "Võ Thị Mai",
    ["Gà ta", "Gạo thơm", "Rau thơm", "Hành lá"], null, null], // cố ý chưa có ảnh
  ["Cá kho tộ", "Món cơm", 65000, "Cá basa kho tộ đất, nước màu, tiêu.", "Trần Thị Bích",
    ["Cá basa", "Nước mắm", "Tỏi", "Hành lá"], null, null],
  ["Bò lúc lắc", "Món xào", 85000, "Bò cắt hạt lựu xào lửa lớn, ăn kèm salad.", "Phạm Quốc Huy",
    ["Thịt bò", "Tỏi", "Trứng gà"], null, null],
  ["Rau muống xào tỏi", "Món xào", 30000, "Rau muống xào giòn với tỏi phi.", "Phạm Quốc Huy",
    ["Rau muống", "Tỏi", "Nước mắm"], null, null],
  ["Gỏi cuốn tôm thịt", "Khai vị", 35000, "Cuốn bánh tráng, chấm tương đậu phộng.", "Trần Thị Bích",
    ["Tôm sú", "Thịt heo", "Bánh tráng", "Bún tươi", "Rau thơm"],
    `${commons}/9/90/G%E1%BB%8Fi_cu%E1%BB%91n.jpg/960px-G%E1%BB%8Fi_cu%E1%BB%91n.jpg`,
    "Tran Hai Duong · CC0 · Wikimedia Commons"],
  ["Chả giò", "Khai vị", 40000, "Chả giò chiên giòn, nhân thịt heo và tôm.", "Phạm Quốc Huy",
    ["Bánh tráng", "Thịt heo", "Tôm sú", "Trứng gà"], null, null],
  ["Bánh xèo miền Tây", "Món chiên", 45000, "Tạm ngưng phục vụ trong tháng này.", "Phạm Quốc Huy",
    ["Bột gạo", "Nước cốt dừa", "Tôm sú", "Giá đỗ"],
    `${commons}/a/a5/B%C3%A1nh_x%C3%A8o_with_n%C6%B0%E1%BB%9Bc_m%E1%BA%AFm.jpg/960px-B%C3%A1nh_x%C3%A8o_with_n%C6%B0%E1%BB%9Bc_m%E1%BA%AFm.jpg`,
    "Vivian D Nguyen · CC BY-SA 2.0 · Wikimedia Commons", false],
  ["Cánh gà chiên nước mắm", "Món chiên", 60000, "Cánh gà chiên giòn, sốt nước mắm tỏi.", "Phạm Quốc Huy",
    ["Cánh gà", "Nước mắm", "Tỏi"], null, null],
  ["Cơm chiên Dương Châu", "Món chiên", 50000, "Cơm chiên trứng, tôm, lạp xưởng, rau củ.", "Trần Thị Bích",
    ["Gạo thơm", "Trứng gà", "Tôm sú", "Hành lá"], null, null],
  ["Chè ba màu", "Tráng miệng", 25000, null, "Lê Hoàng Minh", // cố ý chưa có mô tả
    ["Đậu xanh", "Nước cốt dừa"],
    "https://live.staticflickr.com/65535/51714302932_da40b9d5bc_c.jpg", "avlxyz · CC BY-NC 2.0 · Flickr"],
  ["Bánh flan", "Tráng miệng", 20000, "Flan trứng sữa, nước đường thắng, đá bào.", "Lê Hoàng Minh",
    ["Trứng gà", "Sữa đặc", "Cà phê"], null, null],
  ["Cà phê sữa đá", "Đồ uống", 25000, "Cà phê phin pha sữa đặc, uống với đá.", "Đặng Gia Bảo",
    ["Cà phê", "Sữa đặc"], null, null],
  ["Nước mía", "Đồ uống", 15000, "Ép tươi tại chỗ, thêm tắc.", "Đặng Gia Bảo",
    ["Sả"], null, null, false],
  ["Sinh tố bơ", "Đồ uống", 35000, "Bơ sáp xay với sữa đặc.", "Đặng Gia Bảo",
    ["Quả bơ", "Sữa đặc"], null, null],
];

// Ảnh của các món mới: URL do API Wikimedia Commons trả về (đã kiểm tra tải được), tách riêng cho dễ đọc.
const NEW_IMAGES = {
  "Bún bò Huế": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/0/00/Bun-Bo-Hue-from-Huong-Giang-2011.jpg/960px-Bun-Bo-Hue-from-Huong-Giang-2011.jpg", "Kham Tran · CC BY 3.0 · Wikimedia Commons"],
  "Hủ tiếu Nam Vang": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/H%E1%BB%A7_ti%E1%BA%BFu_Nam_Vang_S%C3%A0i_G%C3%B2n.jpg/960px-H%E1%BB%A7_ti%E1%BA%BFu_Nam_Vang_S%C3%A0i_G%C3%B2n.jpg", "Tonbi ko · CC BY-SA 4.0 · Wikimedia Commons"],
  "Mì Quảng": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Mi_Quang_1A_Danang.jpg/960px-Mi_Quang_1A_Danang.jpg", "Jpatokal · CC BY-SA 4.0 · Wikimedia Commons"],
  "Chả giò": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Ch%E1%BA%A3_gi%C3%B2_SG_%28nem_r%C3%A1n_gi%C3%B2n%29_%E1%BB%9F_qu%C3%A1n_b%C3%BAn_ri%C3%AAu_B%C3%A0_Ti_ng26th7n2023_%281%29.jpg/960px-Ch%E1%BA%A3_gi%C3%B2_SG_%28nem_r%C3%A1n_gi%C3%B2n%29_%E1%BB%9F_qu%C3%A1n_b%C3%BAn_ri%C3%AAu_B%C3%A0_Ti_ng26th7n2023_%281%29.jpg", "Phương Huy · CC BY-SA 4.0 · Wikimedia Commons"],
  "Bò lúc lắc": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Product_Shots_of_Food-Bo_Luc_Lac.jpg/960px-Product_Shots_of_Food-Bo_Luc_Lac.jpg", "Nick Nguyen · CC BY-SA 2.0 · Wikimedia Commons"],
  "Rau muống xào tỏi": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Rau_mu%E1%BB%91ng_x%C3%A0o_t%E1%BB%8Fi%2C_th%C3%A1ng_4_n%C4%83m_2018.jpg/960px-Rau_mu%E1%BB%91ng_x%C3%A0o_t%E1%BB%8Fi%2C_th%C3%A1ng_4_n%C4%83m_2018.jpg", "Phương Huy · Public domain · Wikimedia Commons"],
  "Cá kho tộ": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Ph%C3%BA_Qu%E1%BB%91c_2022_%28c%C3%A1_kho_t%E1%BB%99%29_%281%29.jpg/960px-Ph%C3%BA_Qu%E1%BB%91c_2022_%28c%C3%A1_kho_t%E1%BB%99%29_%281%29.jpg", "Phương Huy · CC BY-SA 4.0 · Wikimedia Commons"],
  "Bánh flan": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cc/Ly_b%C3%A1nh_l%C4%83ng_%28flan%29_Vi%E1%BB%87t_Nam.jpg/960px-Ly_b%C3%A1nh_l%C4%83ng_%28flan%29_Vi%E1%BB%87t_Nam.jpg", "Phương Huy · CC BY-SA 4.0 · Wikimedia Commons"],
  "Cà phê sữa đá": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ec/Ca_Phe_Sua_Da.jpg/960px-Ca_Phe_Sua_Da.jpg", "Clarin · CC BY 2.5 · Wikimedia Commons"],
  "Nước mía": ["https://upload.wikimedia.org/wikipedia/commons/6/63/Sugarcanejuice.jpg", "Food Trails · CC BY-SA 2.0 · Wikimedia Commons"],
  "Sinh tố bơ": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Sinh_t%E1%BB%91_b%C6%A1.jpg/960px-Sinh_t%E1%BB%91_b%C6%A1.jpg", "Hoangkid · Public domain · Wikimedia Commons"],
  "Cánh gà chiên nước mắm": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/C%C3%A1nh_g%C3%A0_chi%C3%AAn_n%C6%B0%E1%BB%9Bc_m%E1%BA%AFm%2C_th%C3%A1ng_8_n%C4%83m_2018_%281%29.JPG/960px-C%C3%A1nh_g%C3%A0_chi%C3%AAn_n%C6%B0%E1%BB%9Bc_m%E1%BA%AFm%2C_th%C3%A1ng_8_n%C4%83m_2018_%281%29.JPG", "Phương Huy · Public domain · Wikimedia Commons"],
  "Cơm chiên Dương Châu": ["https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/C%C6%A1m_chi%C3%AAn_D%C6%B0%C6%A1ng_Ch%C3%A2u_%E1%BB%9F_%C4%90%C3%B4ng_H%C3%A0_n%C4%83m_2017.jpg/960px-C%C6%A1m_chi%C3%AAn_D%C6%B0%C6%A1ng_Ch%C3%A2u_%E1%BB%9F_%C4%90%C3%B4ng_H%C3%A0_n%C4%83m_2017.jpg", "Phương Huy · CC BY-SA 4.0 · Wikimedia Commons"],
};

async function main() {
  // Xoá dữ liệu cũ VÀ đặt lại bộ đếm id về 1. Prisma không có hàm reset bộ đếm nên dùng câu SQL cố định này
  // (không chứa dữ liệu người dùng → không có rủi ro SQL injection). Liệt kê cả 4 bảng vì chúng nối nhau bằng khoá ngoại.
  await prisma.$executeRaw`TRUNCATE TABLE "dish_ingredients", "dishes", "chefs", "ingredients" RESTART IDENTITY`;

  await prisma.chef.createMany({ data: CHEFS });
  await prisma.ingredient.createMany({ data: INGREDIENTS.map(([name, unit]) => ({ name, unit })) });

  // Bảng tra tên → id để nối món với đầu bếp và nguyên liệu.
  const chefId = Object.fromEntries((await prisma.chef.findMany()).map((c) => [c.name, c.id]));
  const ingredientId = Object.fromEntries((await prisma.ingredient.findMany()).map((i) => [i.name, i.id]));

  for (const [name, category, price, description, chef, ingredients, imageUrl, imageCredit, available = true] of DISHES) {
    const [img, credit] = NEW_IMAGES[name] ?? [imageUrl, imageCredit];
    // Nested create: tạo món + các dòng dish_ingredients trong cùng một lệnh (Prisma bọc trong transaction).
    await prisma.dish.create({
      data: {
        name, category, price, description, available,
        imageUrl: img, imageCredit: credit,
        chef: { connect: { id: chefId[chef] } },
        ingredients: { create: ingredients.map((n) => ({ ingredient: { connect: { id: ingredientId[n] } } })) },
      },
    });
  }

  const [dishes, chefs, ingredients, links] = await Promise.all([
    prisma.dish.count(), prisma.chef.count(), prisma.ingredient.count(), prisma.dishIngredient.count(),
  ]);
  console.log(`Seed xong: ${dishes} món, ${chefs} đầu bếp, ${ingredients} nguyên liệu, ${links} liên kết món–nguyên liệu.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
