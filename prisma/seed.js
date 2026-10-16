// Nạp dữ liệu mẫu cho cả ba bảng. Chạy: `npx prisma db seed` (lệnh khai báo trong prisma.config.js).
import { prisma } from "../src/db.js";

async function main() {
  // Xoá dữ liệu cũ VÀ đặt lại bộ đếm id về 1, để mỗi lần seed đều ra cùng một bộ dữ liệu với id 1, 2, 3...
  // deleteMany() chỉ xoá dòng, không reset bộ đếm autoincrement (id sẽ tiếp tục 7, 8...), và Prisma
  // không có hàm reset nên dùng câu SQL cố định này. Không có dữ liệu người dùng → không có rủi ro SQL injection.
  await prisma.$executeRaw`TRUNCATE TABLE "dishes", "chefs", "ingredients" RESTART IDENTITY`;

  // Ảnh: link trực tiếp tới ảnh có giấy phép mở (Wikimedia Commons, Flickr). App chỉ hiển thị, không tải về.
  // imageCredit ghi tác giả + giấy phép, vì các giấy phép CC BY yêu cầu ghi công khi dùng ảnh.
  const commons = "https://upload.wikimedia.org/wikipedia/commons/thumb";
  await prisma.dish.createMany({
    data: [
      {
        name: "Phở bò tái", description: "Nước dùng hầm xương 12 tiếng, bánh phở tươi.", price: 55000, category: "Món nước",
        imageUrl: `${commons}/4/42/Ph%E1%BB%9F_b%C3%B2_in_a_German_restaurant_01.jpg/960px-Ph%E1%BB%9F_b%C3%B2_in_a_German_restaurant_01.jpg`,
        imageCredit: "Kritzolina · CC BY-SA 4.0 · Wikimedia Commons",
      },
      {
        name: "Bún chả Hà Nội", description: "Chả nướng than hoa, ăn kèm bún và rau sống.", price: 50000, category: "Món nước",
        imageUrl: `${commons}/4/4d/B%C3%BAn_ch%E1%BA%A3_Vietnamese_food.jpg/960px-B%C3%BAn_ch%E1%BA%A3_Vietnamese_food.jpg`,
        imageCredit: "stuart_spivack · CC BY 2.0 · Wikimedia Commons",
      },
      {
        name: "Cơm tấm sườn bì", description: "Sườn nướng mật ong, bì, chả trứng.", price: 60000, category: "Món cơm",
        imageUrl: `${commons}/0/0f/C%C6%A1m_t%E1%BA%A5m_SG_l%E1%BB%81_%C4%91%C6%B0%E1%BB%9Dng_%28c%C6%A1m_s%C6%B0%E1%BB%9Dn%2C_mi%E1%BA%BFng_s%C6%B0%E1%BB%9Dn_n%C6%B0%E1%BB%9Bng_m%E1%BA%ADt_ong%29_ng30th7n2022_%281%29.jpg/960px-C%C6%A1m_t%E1%BA%A5m_SG_l%E1%BB%81_%C4%91%C6%B0%E1%BB%9Dng_%28c%C6%A1m_s%C6%B0%E1%BB%9Dn%2C_mi%E1%BA%BFng_s%C6%B0%E1%BB%9Dn_n%C6%B0%E1%BB%9Bng_m%E1%BA%ADt_ong%29_ng30th7n2022_%281%29.jpg`,
        imageCredit: "Phương Huy · CC0 · Wikimedia Commons",
      },
      {
        name: "Gỏi cuốn tôm thịt", description: "Cuốn bánh tráng, chấm tương đậu phộng.", price: 35000, category: "Khai vị",
        imageUrl: `${commons}/9/90/G%E1%BB%8Fi_cu%E1%BB%91n.jpg/960px-G%E1%BB%8Fi_cu%E1%BB%91n.jpg`,
        imageCredit: "Tran Hai Duong · CC0 · Wikimedia Commons",
      },
      {
        name: "Chè ba màu", price: 25000, category: "Tráng miệng",
        imageUrl: "https://live.staticflickr.com/65535/51714302932_da40b9d5bc_c.jpg",
        imageCredit: "avlxyz · CC BY-NC 2.0 · Flickr",
      },
      {
        name: "Bánh xèo miền Tây", description: "Tạm ngưng phục vụ trong tháng này.", price: 45000, category: "Món chiên", available: false,
        imageUrl: `${commons}/a/a5/B%C3%A1nh_x%C3%A8o_with_n%C6%B0%E1%BB%9Bc_m%E1%BA%AFm.jpg/960px-B%C3%A1nh_x%C3%A8o_with_n%C6%B0%E1%BB%9Bc_m%E1%BA%AFm.jpg`,
        imageCredit: "Vivian D Nguyen · CC BY-SA 2.0 · Wikimedia Commons",
      },
    ],
  });

  await prisma.chef.createMany({
    data: [
      { name: "Nguyễn Văn An", specialty: "Món nước miền Bắc" },
      { name: "Trần Thị Bích", specialty: "Món nướng" },
      { name: "Lê Hoàng Minh", specialty: "Tráng miệng" },
    ],
  });

  await prisma.ingredient.createMany({
    data: [
      { name: "Thịt bò", unit: "kg" },
      { name: "Bánh phở", unit: "kg" },
      { name: "Sườn heo", unit: "kg" },
      { name: "Tôm sú", unit: "con" },
      { name: "Rau thơm", unit: "bó" },
    ],
  });

  const [dishes, chefs, ingredients] = await Promise.all([
    prisma.dish.count(),
    prisma.chef.count(),
    prisma.ingredient.count(),
  ]);
  console.log(`Seed xong: ${dishes} món, ${chefs} đầu bếp, ${ingredients} nguyên liệu.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
