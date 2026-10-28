import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { createClient } from "@supabase/supabase-js";
import { Telegraf } from "telegraf";

// 1. Инициализация сервера
const app = Fastify({ logger: true });
await app.register(cors);
await app.register(formbody);

// 2. Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Инициализация Telegram-бота через токен из Render
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error("Ошибка: Переменная TELEGRAM_BOT_TOKEN не найдена в Render!");
}
const bot = new Telegraf(botToken);

// Логика работы бота при команде /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || "User";

  try {
    // Пример запроса в Supabase: ищем пользователя в таблице 'users'
    const { data, error } = await supabase
      .from("users") 
      .select("*")
      .eq("telegram_id", userId);

    if (data && data.length === 0) {
      // Если пользователя нет в базе — регистрируем его
      await supabase
        .from("users")
        .insert([{ telegram_id: userId, username: username }]);
      
      await ctx.reply(`Привет, ${username}! Вы успешно зарегистрированы в базе данных Supabase!`);
    } else {
      // Если пользователь уже есть
      await ctx.reply(`Рад видеть вас снова, ${username}! Ваш профиль уже активен.`);
    }
  } catch (err) {
    console.error("Ошибка при работе с базой:", err);
    await ctx.reply("Привет! Сервер работает, но не удалось подключиться к таблице Supabase. Проверьте структуру БД.");
  }
});

// Запускаем постоянный опрос Telegram (polling)
bot.launch().then(() => {
  console.log("Telegram бот успешно запущен и слушает команды!");
}).catch((err) => {
  console.error("Не удалось запустить Telegram бота:", err);
});

// Тестовый роут для UptimeRobot, чтобы сервер не засыпал
app.get("/", async (request, reply) => {
  return { status: "Бот и веб-сервер работают круглосуточно!" };
});

// Запуск веб-сервера Fastify
const start = async () => {
  try {
    await app.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    console.log("Веб-сервер Fastify запущен!");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
