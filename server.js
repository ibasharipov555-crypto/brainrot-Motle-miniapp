import Fastify from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { createClient } from "@supabase/supabase-js";

// Инициализация сервера
const app = Fastify({ logger: true });

// Подключаем плагины
await app.register(cors);
await app.register(formbody);

// Инициализация Supabase из переменных окружения Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Ваш Secret / service_role key

if (!supabaseUrl || !supabaseKey) {
  console.error("Ошибка: Ключи SUPABASE_URL или SUPABASE_KEY не найдены в переменных окружения!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Тестовый роут, чтобы проверить, что сервер работает
app.get("/", async (request, reply) => {
  return { status: "Бот и сервер Supabase успешно запущены!" };
});

// Пример: Получить профиль игрока из Supabase по Telegram ID
app.get("/api/user/:id", async (request, reply) => {
  const { id } = request.params;
  
  const { data, error } = await supabase
    .from("users") // Ваша таблица в Supabase
    .select("*")
    .eq("telegram_id", id)
    .single();

  if (error) {
    return reply.status(404).send({ error: "Пользователь не найден" });
  }
  return data;
});

// Запуск сервера на порту, который выдает Render
const start = async () => {
  try {
    await app.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    console.log("Сервер успешно запущен!");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

