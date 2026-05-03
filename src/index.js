const express = require('express');
const helmet = require('helmet');
const { MessageMedia } = require('whatsapp-web.js');

const config = require('./config');
const logger = require('./logger');
const SessionManager = require('./sessionManager');
const { createImagesPdf, createPdfFileName } = require('./pdfService');
const { createWhatsAppClient } = require('./whatsappClient');
const {
  normalizeWhatsAppNumber,
  maskNumber,
  isAllowedSender,
  isAllowedChatId,
  describeIdForSetup,
  isPrivateChat,
  isGroupChat,
  RateLimiter
} = require('./security');

const client = createWhatsAppClient();
const rateLimiter = new RateLimiter({
  windowMs: config.rateLimitWindowSeconds * 1000,
  max: config.rateLimitMaxMessages
});

let shuttingDown = false;
const recentlyHandledMessageIds = new Map();

const sessionManager = new SessionManager({
  sessionTimeoutMs: config.sessionTimeoutSeconds * 1000,
  autoGenerateEnabled: config.pdfAutoGenerate,
  autoGenerateTimeoutMs: config.pdfAutoTimeoutSeconds * 1000,
  onSessionTimeout: (userId, count) => {
    logger.info({ sender: maskNumber(userId), count }, 'Cleared inactive image batch session.');
  },
  onAutoGenerate: async (userId) => {
    await generateAndSendPdf(userId, { automatic: true });
  }
});

function startHealthServer() {
  const app = express();
  app.use(helmet());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      bot: 'running'
    });
  });

  return app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Health server started.');
  });
}

function getSenderId(message) {
  if (message.fromMe && client.info && client.info.wid) {
    return client.info.wid._serialized;
  }

  if (isGroupChat(message.from)) {
    return message.author || '';
  }

  return message.from || '';
}

async function getResolvedSenderId(message) {
  const ids = await getResolvedSenderIds(message);
  return ids[0] || '';
}

function addCandidateId(ids, value) {
  if (value && typeof value === 'string' && !ids.includes(value)) {
    ids.push(value);
  }
}

async function getResolvedSenderIds(message) {
  const fallbackSenderId = getSenderId(message);
  const ids = [];
  addCandidateId(ids, fallbackSenderId);
  addCandidateId(ids, getChatId(message));

  if (message.fromMe && client.info && client.info.wid) {
    addCandidateId(ids, client.info.wid._serialized);
    return ids;
  }

  if (!message) {
    return ids;
  }

  if (typeof message.getContact === 'function') {
    try {
      const contact = await message.getContact();
      if (contact && contact.number) addCandidateId(ids, contact.number);
      if (contact && contact.id && contact.id.user) addCandidateId(ids, contact.id.user);
      if (contact && contact.id && contact.id._serialized) addCandidateId(ids, contact.id._serialized);
    } catch (error) {
      logger.debug({ err: error, sender: maskNumber(fallbackSenderId) }, 'Could not resolve sender contact.');
    }
  }

  if (typeof client.getContactLidAndPhone === 'function') {
    for (const candidate of [...ids]) {
      if (!candidate.includes('@')) continue;

      try {
        const mappings = await client.getContactLidAndPhone([candidate]);
        for (const mapping of mappings || []) {
          addCandidateId(ids, mapping.lid);
          addCandidateId(ids, mapping.pn);
        }
      } catch (error) {
        logger.debug({ err: error, sender: maskNumber(candidate) }, 'Could not map WhatsApp LID and phone.');
      }
    }
  }

  return ids;
}

function getChatId(message) {
  if (message.fromMe && message.to) {
    return message.to;
  }

  return message.from;
}

function getMessageId(message) {
  return message && message.id && message.id._serialized ? message.id._serialized : '';
}

function rememberMessage(message) {
  const id = getMessageId(message);
  if (!id) return false;

  if (recentlyHandledMessageIds.has(id)) return true;
  recentlyHandledMessageIds.set(id, Date.now());
  return false;
}

function cleanupHandledMessageIds() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, seenAt] of recentlyHandledMessageIds.entries()) {
    if (seenAt < cutoff) recentlyHandledMessageIds.delete(id);
  }
}

async function getIgnoreReason(message) {
  if (!message) return 'empty_message';
  if (message.fromMe && !config.processOwnMessages) return 'own_messages_disabled';

  const chatId = getChatId(message);
  if (isGroupChat(chatId) && !config.processGroups) return 'group_disabled';
  if (!isPrivateChat(chatId) && !config.processGroups) return 'not_private_chat';

  const senderIds = await getResolvedSenderIds(message);
  const allowed = senderIds.some((senderId) => (
    isAllowedSender(senderId, config.allowedNumbers) ||
    isAllowedChatId(senderId, config.allowedChatIds)
  ));

  if (!allowed) return 'sender_not_allowed';

  return '';
}

function getCommand(message) {
  if (!message.body || typeof message.body !== 'string') return '';
  const normalized = message.body.trim().toLowerCase();
  const command = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const allowedCommands = new Set(['start', 'done', 'cancel', 'clear', 'status', 'help']);

  return allowedCommands.has(command) ? command : '';
}

async function replyToAllowed(chatId, text) {
  await client.sendMessage(chatId, text);
}

async function generateAndSendPdf(userId, { automatic = false } = {}) {
  if (sessionManager.isGenerating(userId)) return;

  const images = sessionManager.getImages(userId);
  if (!sessionManager.isActive(userId)) {
    if (!automatic) await replyToAllowed(userId, 'No active PDF batch. Send /start first.');
    return;
  }

  if (images.length === 0) {
    sessionManager.clear(userId);
    if (!automatic) await replyToAllowed(userId, 'PDF batch ended. No images were collected, so no PDF was created.');
    return;
  }

  sessionManager.setGenerating(userId, true);

  try {
    const pdfBuffer = await createImagesPdf(images);
    const fileName = createPdfFileName();
    const media = new MessageMedia('application/pdf', pdfBuffer.toString('base64'), fileName);

    await client.sendMessage(userId, media, {
      sendMediaAsDocument: true,
      caption: `PDF created with ${images.length} image${images.length === 1 ? '' : 's'}.`
    });

    sessionManager.clear(userId);
    logger.info({ sender: maskNumber(userId), count: images.length }, 'PDF sent and session cleared.');
  } catch (error) {
    logger.error({ err: error, sender: maskNumber(userId) }, 'Failed to create or send PDF.');
    sessionManager.setGenerating(userId, false);
    if (!automatic) {
      await replyToAllowed(userId, 'Sorry, I could not create the PDF from those images. Try /cancel and start again.');
    }
  }
}

async function handleCommand(message, command) {
  const senderId = await getResolvedSenderId(message);
  const chatId = getChatId(message);

  if (command === 'start') {
    sessionManager.start(chatId);
    logger.info({ sender: maskNumber(senderId) }, 'Started image-to-PDF batch session.');
    await replyToAllowed(chatId, 'PDF batch started. Send images, then send /done to create the PDF.');
    return true;
  }

  if (command === 'done') {
    await generateAndSendPdf(chatId);
    return true;
  }

  if (command === 'cancel' || command === 'clear') {
    const count = sessionManager.clear(chatId);
    await replyToAllowed(chatId, count > 0 ? 'Image batch cleared.' : 'No active image batch to clear.');
    return true;
  }

  if (command === 'status') {
    if (!sessionManager.isActive(chatId)) {
      await replyToAllowed(chatId, 'No active PDF batch. Send /start to begin.');
      return true;
    }

    const count = sessionManager.count(chatId);
    await replyToAllowed(chatId, `Current batch: ${count} image${count === 1 ? '' : 's'} collected.`);
    return true;
  }

  if (command === 'help') {
    await replyToAllowed(
      chatId,
      [
        `${config.botName}`,
        'Send /start to begin a PDF batch.',
        'Then send one or more images.',
        'Send /done to create a PDF.',
        'Send /status to check the current batch.',
        'Send /cancel or /clear to clear the current batch.'
      ].join('\n')
    );
    return true;
  }

  logger.debug({ sender: maskNumber(senderId) }, 'Ignored unknown allowed-user command.');
  return false;
}

async function handleImageMessage(message) {
  const chatId = getChatId(message);
  const senderId = await getResolvedSenderId(message);

  if (!sessionManager.isActive(chatId)) {
    logger.debug({ sender: maskNumber(senderId) }, 'Ignored image because no PDF batch is active.');
    return;
  }

  if (sessionManager.count(chatId) >= config.maxImagesPerPdf) {
    await replyToAllowed(chatId, `Maximum image limit reached (${config.maxImagesPerPdf}). Send /done to create the PDF or /cancel to clear.`);
    return;
  }

  let media;
  try {
    media = await message.downloadMedia();
  } catch (error) {
    logger.warn({ err: error, sender: maskNumber(senderId) }, 'Failed to download image media.');
    await replyToAllowed(chatId, 'I could not download that image. Please try sending it again.');
    return;
  }

  if (!media || !media.mimetype || !media.data) {
    await replyToAllowed(chatId, 'I could not read that image. Please try sending it again.');
    return;
  }

  if (!config.supportedMimeTypes.has(media.mimetype)) {
    await replyToAllowed(chatId, 'Unsupported image type. Please send JPEG, PNG, or WebP images.');
    return;
  }

  const buffer = Buffer.from(media.data, 'base64');
  if (buffer.length > config.maxImageSizeBytes) {
    await replyToAllowed(chatId, `Image is too large. Max size is ${Math.round(config.maxImageSizeBytes / 1024 / 1024)} MB.`);
    return;
  }

  const count = sessionManager.addImage(chatId, {
    buffer,
    mimeType: media.mimetype,
    receivedAt: Date.now()
  });

  logger.info({ sender: maskNumber(senderId), count }, 'Image added to in-memory PDF session.');
  await replyToAllowed(chatId, `Image added (${count}/${config.maxImagesPerPdf}). Send more images or send /done to create PDF.`);
}

async function handleMessage(message) {
  if (shuttingDown) return;
  if (rememberMessage(message)) return;

  const resolvedSenderIds = await getResolvedSenderIds(message);
  const resolvedSenderId = resolvedSenderIds[0] || '';
  const ignoreReason = await getIgnoreReason(message);
  if (ignoreReason) {
    logger.debug(
      {
        reason: ignoreReason,
        fromMe: Boolean(message && message.fromMe),
        sender: maskNumber(resolvedSenderId),
        chat: maskNumber(getChatId(message || {})),
        type: message && message.type,
        hasMedia: Boolean(message && message.hasMedia)
      },
      'Ignored WhatsApp message.'
    );
    if (ignoreReason === 'sender_not_allowed') {
      const setupIds = resolvedSenderIds
        .filter((id) => typeof id === 'string' && id.endsWith('@lid'))
        .map(describeIdForSetup);

      if (setupIds.length > 0) {
        logger.warn(
          { allowedChatIds: setupIds },
          'WhatsApp did not expose a phone number. Add one of these IDs to ALLOWED_CHAT_IDS if this is your authorized user.'
        );
      }
    }
    return;
  }

  const senderId = resolvedSenderId;
  const rateKey = normalizeWhatsAppNumber(senderId);

  if (!rateLimiter.allow(rateKey)) {
    logger.warn({ sender: maskNumber(senderId) }, 'Rate limit exceeded for allowed user.');
    await replyToAllowed(getChatId(message), 'Please slow down and try again in a minute.');
    return;
  }

  const command = getCommand(message);
  if (command) {
    logger.info({ sender: maskNumber(senderId), command }, 'Received allowed command.');
    await handleCommand(message, command);
    return;
  }

  if (message.hasMedia) {
    await handleImageMessage(message);
    return;
  }

  logger.debug(
    {
      sender: maskNumber(senderId),
      chat: maskNumber(getChatId(message)),
      type: message.type,
      hasMedia: Boolean(message.hasMedia)
    },
    'Allowed message was not a command or media.'
  );
}

function setupProcessHandlers(server) {
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down.');

    sessionManager.clearAll();
    server.close(() => {
      logger.info('Health server stopped.');
    });

    try {
      await client.destroy();
    } catch (error) {
      logger.warn({ err: error }, 'Error while destroying WhatsApp client.');
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection.');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception.');
    shutdown('uncaughtException');
  });
}

async function main() {
  logger.info(
    {
      allowedUsers: config.allowedNumbers.size,
      allowedChatIds: config.allowedChatIds.size,
      processGroups: config.processGroups,
      processOwnMessages: config.processOwnMessages,
      autoGenerate: config.pdfAutoGenerate
    },
    'Starting private WhatsApp image-to-PDF bot.'
  );

  const server = startHealthServer();
  setupProcessHandlers(server);

  client.on('message', (message) => {
    handleMessage(message).catch((error) => {
      logger.error({ err: error }, 'Message handler failed.');
    });
  });

  client.on('message_create', (message) => {
    handleMessage(message).catch((error) => {
      logger.error({ err: error }, 'Created-message handler failed.');
    });
  });

  setInterval(() => rateLimiter.cleanup(), 60 * 1000).unref();
  setInterval(() => cleanupHandledMessageIds(), 60 * 1000).unref();

  await client.initialize();
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Bot failed to start.');
  process.exit(1);
});
