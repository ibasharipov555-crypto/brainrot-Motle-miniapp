import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { createClient } from "@supabase/supabase-js";
import { Telegraf } from "telegraf";

// 1. Создаём веб-сервер
const app = Fastify({ logger: true });

await app.register(cors);
await app.register(formbody);

// 2. Подключаем Supabase (исправленный вариант)
let supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("В Render не заданы SUPABASE_URL или SUPABASE_KEY");
}

// Этот код сам удалит лишние пробелы и косые черты, если они случайно есть
supabaseUrl = supabaseUrl.trim().replace(/\/$/, "");

console.log(`Инициализация Supabase с URL: "${supabaseUrl}"`);

const supabase = createClient(supabaseUrl, supabaseKey);

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  throw new Error("В Render не задан TELEGRAM_BOT_TOKEN");
}

const bot = new Telegraf(botToken);

// 4. Регистрация игрока
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || "User";

  try {
    const { data: player, error: findError } = await supabase
      .from("players")
      .select("id, telegram_id, username, coins")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (findError) {
      console.error("Ошибка поиска игрока:", findError.message);
      await ctx.reply("Не удалось загрузить профиль. Попробуй позже.");
      

    if (!player) {
      const { data: newPlayer, error: insertError } = await supabase
        .from("players")
        .insert({
          telegram_id: telegramId,
          username: username,
          coins: 0
        })
        .select("id, telegram_id, username, coins")
        .single();

      if (insertError) {
        console.error("Ошибка регистрации:", insertError.message);
        await ctx.reply("Не удалось создать профиль. Попробуй позже.");
        return;
      }

      await ctx.reply(
        `Привет, ${username}!\n` +
        `Профиль создан.\n` +
        `Баланс: ${newPlayer.coins ?? 0} монет.`
      );
      return;
    }

    if (player.username !== username) {
      const { error: updateError } = await supabase
        .from("players")
        .update({ username })
        .eq("telegram_id", telegramId);

      if (updateError) {
        console.error("Ошибка обновления имени:", updateError.message);
      }
    }

    await ctx.reply(
      `С возвращением, ${username}!\n` +
      `Твой баланс: ${player.coins ?? 0} монет.`
    );
  } catch (error) {
    console.error("Ошибка обработки /start:", error);
    await ctx.reply("Ошибка сервера. Попробуй позже.");
  }
});

// 5. Проверка состояния сервера
app.get("/", async () => {
  return {
    name: "Brainrot Battle API",
    status: "online"
  };
});

app.get("/health", async () => {
  return { ok: true };
});

// 6. Запускаем сервер и Telegram-бота
const start = async () => {
  try {
    // Сначала полностью запускаем веб-сервер, чтобы Render увидел рабочий порт
    const address = await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: "0.0.0.0"
    });
    console.log(`Сервер запущен на адресе: ${address}`);

    // Запускаем бота без await, чтобы он работал параллельно и не вешал инициализацию
    bot.launch()
      .then(() => console.log("Telegram-бот успешно запущен в режиме Long Polling."))
      .catch((err) => console.error("Ошибка запуска Telegram-бота:", err));

  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

// Корректное завершение работы
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
