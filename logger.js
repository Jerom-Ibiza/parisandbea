// logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.File({ filename: path.join(__dirname, 'error.log'), level: 'error' }),
    new transports.File({ filename: path.join(__dirname, 'combined.log') })
  ]
});

module.exports = logger;

