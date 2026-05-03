require('dotenv').config();

const { parseAllowedChatIds, parseAllowedNumbers } = require('./security');

function readInteger(name, fallback, { min = 0 } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`${name} must be an integer greater than or equal to ${min}.`);
  }

  return parsed;
}

function readBoolean(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

const allowedNumbers = parseAllowedNumbers(process.env.ALLOWED_NUMBERS);
const allowedChatIds = parseAllowedChatIds(process.env.ALLOWED_CHAT_IDS);

if (allowedNumbers.size === 0 && allowedChatIds.size === 0) {
  throw new Error('ALLOWED_NUMBERS or ALLOWED_CHAT_IDS must contain at least one allowed user.');
}

const config = {
  port: readInteger('PORT', 3000, { min: 1 }),
  allowedNumbers,
  allowedChatIds,
  maxImagesPerPdf: readInteger('MAX_IMAGES_PER_PDF', 30, { min: 1 }),
  maxImageSizeBytes: readInteger('MAX_IMAGE_SIZE_MB', 10, { min: 1 }) * 1024 * 1024,
  sessionTimeoutSeconds: readInteger('SESSION_TIMEOUT_SECONDS', 900, { min: 10 }),
  pdfAutoGenerate: readBoolean('PDF_AUTO_GENERATE', false),
  pdfAutoTimeoutSeconds: readInteger('PDF_AUTO_TIMEOUT_SECONDS', 10, { min: 1 }),
  botName: process.env.BOT_NAME || 'Private PDF Bot',
  qrViewToken: process.env.QR_VIEW_TOKEN || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  processGroups: readBoolean('PROCESS_GROUPS', false),
  processOwnMessages: readBoolean('PROCESS_OWN_MESSAGES', false),
  rateLimitWindowSeconds: readInteger('RATE_LIMIT_WINDOW_SECONDS', 60, { min: 1 }),
  rateLimitMaxMessages: readInteger('RATE_LIMIT_MAX_MESSAGES', 30, { min: 1 }),
  supportedMimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp'])
};

module.exports = config;
