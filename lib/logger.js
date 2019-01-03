const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({format: "YYYY-MM-DD HH:mm:ss"}),
        winston.format.splat(),
        winston.format.printf(info => `${info.timestamp} - ${info.level.toUpperCase()}: ${info.message}`)
    ),
    transports: [
        new winston.transports.Console({handleExceptions: true}),
        //new winston.transports.File({ filename: './logs/bitcoin.log' })
        //new winston.transports.DailyRotateFile()
    ]
});

// error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 

module.exports = logger;