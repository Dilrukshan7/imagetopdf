const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const logger = require('./logger');

function resolvePuppeteerExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  try {
    const puppeteer = require('puppeteer');
    return puppeteer.executablePath();
  } catch (error) {
    logger.debug({ err: error }, 'Could not resolve Puppeteer executable path automatically.');
    return '';
  }
}

function buildPuppeteerOptions() {
  const executablePath = resolvePuppeteerExecutablePath();
  const options = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  };

  if (executablePath) {
    options.executablePath = executablePath;
  }

  return options;
}

function createWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: '.wwebjs_auth'
    }),
    puppeteer: buildPuppeteerOptions()
  });

  client.on('qr', (qr) => {
    logger.info('QR code received. Scan it with WhatsApp on your phone.');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    logger.info('WhatsApp client is ready.');
  });

  client.on('authenticated', () => {
    logger.info('WhatsApp client authenticated.');
  });

  client.on('auth_failure', () => {
    logger.error('WhatsApp authentication failed. Delete .wwebjs_auth and scan again if needed.');
  });

  client.on('disconnected', (reason) => {
    logger.warn({ reason }, 'WhatsApp client disconnected.');
  });

  return client;
}

module.exports = {
  createWhatsAppClient
};
