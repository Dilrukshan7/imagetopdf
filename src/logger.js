const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: ['*.data', '*.media', '*.pdf', '*.buffer', '*.message', '*.content', '*.body'],
    remove: true
  },
  formatters: {
    level(label) {
      return { level: label };
    }
  }
});

module.exports = logger;
