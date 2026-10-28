import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { createClient } from "@supabase/supabase-js";
import { Telegraf } from "telegraf";

// Отключаем строгую проверку SSL-сертификатов Node.js для обхода fetch failed
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 1. Создаём веб-сервер
const app = Fastify({ logger: true });

await app.register(cors);
await app.register(formbody);

// 2. Подключаем Supabase (Адрес зашит напрямую для обхода багов Render)
const supabaseUrl = "https://supabase.in";

const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  throw new Error("В Render не задан SUPABASE_KEY");
}

console.log(`Инициализация Supabase с жестко зашитым URL: "${supabaseUrl}"`);
const supabase = createClient(supabaseUrl, supabaseKey);

// 3. Подключаем Telegram
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
      return;
    }

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
    const address = await app.listen({
      port: Number(process.env.PORT) || 3000,
      host: "0.0.0.0"
    });
    console.log(`Сервер запущен на адресе: ${address}`);

    bot.launch()
      .then(() => console.log("Telegram-бот успешно запущен."))
      .catch((err) => console.error("Ошибка запуска Telegram-бота:", err));

  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

