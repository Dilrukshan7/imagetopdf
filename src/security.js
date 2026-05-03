function normalizeWhatsAppNumber(value) {
  if (!value || typeof value !== 'string') return '';

  const withoutDomain = value.split('@')[0];
  return withoutDomain.replace(/[^\d]/g, '');
}

function maskNumber(value) {
  const normalized = normalizeWhatsAppNumber(value);
  if (!normalized) return 'unknown';
  if (normalized.length <= 4) return '****';

  return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

function parseAllowedNumbers(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((item) => normalizeWhatsAppNumber(item.trim()))
      .filter(Boolean)
  );
}

function parseAllowedChatIds(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function isAllowedSender(senderId, allowedNumbers) {
  const normalized = normalizeWhatsAppNumber(senderId);
  return normalized && allowedNumbers.has(normalized);
}

function isAllowedChatId(chatId, allowedChatIds) {
  return typeof chatId === 'string' && allowedChatIds.has(chatId);
}

function describeIdForSetup(value) {
  if (!value || typeof value !== 'string') return 'unknown';
  if (value.endsWith('@c.us')) return maskNumber(value);
  if (value.endsWith('@lid')) return value;
  return maskNumber(value);
}

function isPrivateChat(chatId) {
  if (typeof chatId !== 'string') return false;
  if (chatId.endsWith('@c.us') || chatId.endsWith('@lid')) return true;

  return chatId.includes('@') && !isGroupChat(chatId) && !chatId.endsWith('@broadcast') && chatId !== 'status@broadcast';
}

function isGroupChat(chatId) {
  return typeof chatId === 'string' && chatId.endsWith('@g.us');
}

class RateLimiter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.buckets = new Map();
  }

  allow(key) {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (bucket.count >= this.max) return false;

    bucket.count += 1;
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetAt) this.buckets.delete(key);
    }
  }
}

module.exports = {
  normalizeWhatsAppNumber,
  maskNumber,
  parseAllowedNumbers,
  parseAllowedChatIds,
  isAllowedSender,
  isAllowedChatId,
  describeIdForSetup,
  isPrivateChat,
  isGroupChat,
  RateLimiter
};
