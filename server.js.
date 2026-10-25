import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import mongoose from "mongoose";
import AdminJS from "adminjs";
import AdminJSFastify from "@adminjs/fastify";
import * as AdminJSMongoose from "@adminjs/mongoose";

// 1. Настройка моделей Базы Данных (Mongoose)
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

// Схема Игроков (Балансы, монеты, брейнроты)
const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  coins: { type: Number, default: 0 },
  brainrots: { type: Number, default: 0 },
  inventory: [String],
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model("User", UserSchema);

// Схема Кейсов
const CaseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, default: 0 },
  items: [String], // Список предметов внутри кейса
  isActive: { type: Boolean, default: true }
});
const Case = mongoose.model("Case", CaseSchema);

// Схема Промокодов
const PromocodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  rewardCoins: { type: Number, default: 0 },
  maxUses: { type: Number, default: 100 },
  usedCount: { type: Number, default: 0 },
  usedBy: [Number] // Список Telegram ID, кто уже ввел
});
const Promocode = mongoose.model("Promocode", PromocodeSchema);

// Схема Событий (Ивентов)
const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  bonusMultiplier: { type: Number, default: 1.0 },
  isActive: { type: Boolean, default: true }
});
const Event = mongoose.model("Event", EventSchema);

// 2. Инициализация сервера Fastify
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(formbody); // Необходимо для работы админки

// 3. Интеграция Админ-панели (AdminJS)
const adminJs = new AdminJS({
  resources: [
    { resource: User, options: { navigation: "Игроки" } },
    { resource: Case, options: { navigation: "Магазин" } },
    { resource: Promocode, options: { navigation: "Маркетинг" } },
    { resource: Event, options: { navigation: "Маркетинг" } },
  ],
  rootPath: "/admin",
  branding: {
    companyName: "Brainrot Battle Admin",
    softwareBrochure: false,
  },
});

// Защита админки логином и паролем
await AdminJSFastify.buildAuthenticatedRouter(adminJs, {
  authenticate: async (email, password) => {
    // ⚠️ Впишите сюда ваши данные для входа на сайт админки
    if (email === "admin@brainrot.com" && password === "SuperSecretPassword123") {
      return { email };
    }
    return null;
  },
  cookiePassword: "some-secret-password-encryption-key-must-be-long",
}, app);

// 4. Обычные роуты (API игры)
app.get("/", async () => {
  return {
    name: "Brainrot Battle API",
    status: "online",
    adminPanel: "/admin"
  };
});

app.get("/health", async () => {
  return { ok: true, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" };
});

// Пример API: получение данных игрока
app.get("/api/user/:id", async (request, reply) => {
  const { id } = request.params;
  let user = await User.findOne({ telegramId: id });
  if (!user) {
    user = await User.create({ telegramId: id, username: "Player" });
  }
  return user;
});

// 5. Подключение к БД и запуск сервера
const port = Number(process.env.PORT || 3000);
// Берем ссылку из .env, если её нет — используем локальную заглушку
const mongoUri = process.env.DATABASE_URL || "mongodb://localhost:27017/brainrot";

try {
  app.log.info("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  app.log.info("Database connected successfully!");

  await app.listen({
    port,
    host: "0.0.0.0"
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
