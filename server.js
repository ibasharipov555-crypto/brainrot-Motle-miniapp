import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import mongoose from "mongoose";
import AdminJS from "adminjs";
import AdminJSFastify from "@adminjs/fastify";
import * as AdminJSMongoose from "@adminjs/mongoose";

// ==========================================
// 1. Настройка моделей Базы Данных (Mongoose)
// ==========================================
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

// Схема Игроков (Балансы, монеты, инвентарь и время кейсов)
const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  coins: { type: Number, default: 0 },
  brainrots: { type: Number, default: 0 },
  inventory: [String],
  lastFreeCaseAt: { type: Date, default: null }, // Поле контроля 12-часового таймера бесплатного кейса
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


// ==========================================
// 2. Инициализация сервера Fastify
// ==========================================
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(formbody); // Необходимо для работы админки


// ==========================================
// 3. Интеграция Админ-панели (AdminJS)
// ==========================================
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


// ==========================================
// 4. Обычные роуты (API игры)
// ==========================================
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

// Получение данных игрока (или его регистрация при первом входе)
app.get("/api/user/:id", async (request, reply) => {
  const { id } = request.params;
  let user = await User.findOne({ telegramId: id });
  if (!user) {
    user = await User.create({ telegramId: id, username: "Player" });
  }
  return user;
});

// РОУТ: Открытие БЕСПЛАТНОГО кейса с проверкой кулдауна в 12 часов
app.post("/api/user/:id/free-case", async (request, reply) => {
  const { id } = request.params;
  
  let user = await User.findOne({ telegramId: id });
  if (!user) {
    user = await User.create({ telegramId: id, username: "Player" });
  }

  const NOW = new Date();
  const TWELVE_HOURS = 12 * 60 * 60 * 1000; // 12 часов в миллисекундах

  // Проверяем, сколько времени прошло с момента последнего открытия
  if (user.lastFreeCaseAt) {
    const timePassed = NOW - new Date(user.lastFreeCaseAt);
    if (timePassed < TWELVE_HOURS) {
      const timeRemaining = TWELVE_HOURS - timePassed;
      
      // Вычисляем оставшиеся часы и минуты для таймера
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

      return reply.status(400).send({
        success: false,
        message: "Бесплатный кейс еще недоступен!",
        timeRemaining: { hours, minutes, seconds },
        formattedTime: `Следующий через ${hours}ч ${minutes}м`
      });
    }
  }

  // Награда из бесплатного кейса (выбирается случайно)
  const freeRewards = ["Обычный Скибиди", "Медный Поп-Кэт", "Бронзовый Хаги", "50 монет", "100 монет"];
  const randomReward = freeRewards[Math.floor(Math.random() * freeRewards.length)];

  // Если выпали монеты, то зачисляем на баланс, иначе кладём предмет в массив inventory
  if (randomReward.includes("монет")) {
    const coinsAmount = parseInt(randomReward);
    user.coins += coinsAmount;
  } else {
    user.inventory.push(randomReward);
  }

  // Обновляем метку времени открытия и сохраняем изменения
  user.lastFreeCaseAt = NOW;
  await user.save();

  return {
    success: true,
    reward: randomReward,
    user: user
  };
});

// РОУТ: Покупка и открытие ПЛАТНОГО кейса («ДРАГОН», «ТАКО» и др.)
app.post("/api/user/:id/open-case", async (request, reply) => {
  const { id } = request.params;
  const { caseId } = request.body || {}; // Получаем ID покупаемого кейса из тела запроса

  if (!caseId) {
    return reply.status(400).send({ success: false, message: "Не указан ID кейса (caseId)" });
  }

  // 1. Проверяем, существует ли кейс в базе
  const targetCase = await Case.findById(caseId);
  if (!targetCase || !targetCase.isActive) {
    return reply.status(404).send({ success: false, message: "Кейс не найден или отключен" });
  }

  // 2. Ищем пользователя
  let user = await User.findOne({ telegramId: id });
  if (!user) return reply.status(404).send({ success: false, message: "Игрок не найден" });

  // 3. Проверяем баланс монет игрока
  if (user.coins < targetCase.price) {
    return reply.status(400).send({ success: false, message: "Недостаточно монет на балансе!" });
  }

  // 4. Проверяем, наполнен ли кейс предметами в админке
  if (!targetCase.items || targetCase.items.length === 0) {
    return reply.status(500).send({ success: false, message: "Этот кейс пока пуст. Наполните его предметами в админ-панели!" });
  }

  // 5. Проводим операцию: списываем баланс и выбираем случайный приз
  user.coins -= targetCase.price;
  const wonItem = targetCase.items[Math.floor(Math.random() * targetCase.items.length)];
  
  user.inventory.push(wonItem); // Добавляем предмет игроку
  await user.save();

  return {
    success: true,
    reward: wonItem,
    newBalance: user.coins
  };
});


// ==========================================
// 5. Подключение к БД и запуск сервера
// ==========================================
const port = Number(process.env.PORT || 3000);
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
