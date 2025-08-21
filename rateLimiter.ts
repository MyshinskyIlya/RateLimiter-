import { NextRequest } from "next/server";
import { verifyAuth } from "./auth";

interface RateLimitData {
  count: number;
  firstRequestTime: number;
}

const rateLimitStore = new Map<string, RateLimitData>();

// Стандартные значения (если не переданы в функцию)
const DEFAULT_RATE_LIMIT_CONFIG = {
  WINDOW_MS: 10 * 60 * 1000, // 10 минут
  MAX_REQUESTS: 3, // Максимум 3 запроса за период
};

export async function checkRateLimit(
  req: NextRequest,
  customConfig?: {
    WINDOW_MS: number;
    MAX_REQUESTS: number;
  }
): Promise<{ isLimited: boolean; headers?: Headers }> {

  // Объединяем стандартные и кастомные настройки
  const config = customConfig || DEFAULT_RATE_LIMIT_CONFIG;

  // Пропускаем лимит для административных запросов
  const { isAdmin } = await verifyAuth(req)
  if (isAdmin) {
    return { isLimited: false };
  }

  // Получаем IP-адрес
  const ip =
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  const currentTime = Date.now();
  const windowStart = currentTime - config.WINDOW_MS;

  let limitData = rateLimitStore.get(ip);
  if (!limitData) {
    limitData = { count: 0, firstRequestTime: currentTime };
    rateLimitStore.set(ip, limitData);
  }

  // Сброс счётчика, если окно истекло
  if (limitData.firstRequestTime < windowStart) {
    limitData.count = 0;
    limitData.firstRequestTime = currentTime;
  }

  limitData.count += 1;

  // Проверяем, превышен ли лимит
  if (limitData.count > config.MAX_REQUESTS) {
    const resetTime = Math.ceil((limitData.firstRequestTime + config.WINDOW_MS) / 1000);

    const headers = new Headers();
    headers.set('Retry-After', String(Math.ceil((config.WINDOW_MS - (currentTime - limitData.firstRequestTime)) / 1000)));
    headers.set('X-RateLimit-Limit', String(config.MAX_REQUESTS));
    headers.set('X-RateLimit-Remaining', String(Math.max(0, config.MAX_REQUESTS - limitData.count)));
    headers.set('X-RateLimit-Reset', String(resetTime));

    return { isLimited: true, headers };
  }

  return { isLimited: false };
}

// Очистка старых записей (использует DEFAULT_RATE_LIMIT_CONFIG)
function cleanUpRateLimitStore() {
  const currentTime = Date.now();
  const windowStart = currentTime - DEFAULT_RATE_LIMIT_CONFIG.WINDOW_MS * 2;

  for (const [ip, data] of rateLimitStore.entries()) {
    if (data.firstRequestTime < windowStart) {
      rateLimitStore.delete(ip);
    }
  }
}

setInterval(cleanUpRateLimitStore, 30 * 60 * 1000); // Чистим каждые 30 минут