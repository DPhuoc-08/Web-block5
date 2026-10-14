// Nạp dữ liệu mẫu cho cả ba bảng. Chạy: `npx prisma db seed` (lệnh khai báo trong prisma.config.js).
import { prisma } from "../src/db.js";

async function main() {
  // Xoá dữ liệu cũ trước để chạy lại nhiều lần vẫn ra đúng một bộ dữ liệu, không bị nhân đôi.
  await prisma.dish.deleteMany();
  await prisma.chef.deleteMany();
  await prisma.ingredient.deleteMany();

  await prisma.dish.createMany({
    data: [
      { name: "Phở bò tái", description: "Nước dùng hầm xương 12 tiếng, bánh phở tươi.", price: 55000, category: "Món nước" },
      { name: "Bún chả Hà Nội", description: "Chả nướng than hoa, ăn kèm bún và rau sống.", price: 50000, category: "Món nước" },
      { name: "Cơm tấm sườn bì", description: "Sườn nướng mật ong, bì, chả trứng.", price: 60000, category: "Món cơm" },
      { name: "Gỏi cuốn tôm thịt", description: "Cuốn bánh tráng, chấm tương đậu phộng.", price: 35000, category: "Khai vị" },
      { name: "Chè ba màu", price: 25000, category: "Tráng miệng" },
      { name: "Bánh xèo miền Tây", description: "Tạm ngưng phục vụ trong tháng này.", price: 45000, category: "Món chiên", available: false },
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
