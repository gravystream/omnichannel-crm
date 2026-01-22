/**
 * Logger Utility
 * Structured logging with Winston
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format
const customFormat = printf(({ level, message, timestamp, context, ...metadata }) => {
  let msg = `${timestamp} [${level}]`;

  if (context) {
    msg += ` [${context}]`;
  }

  msg += `: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

// Create Winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    customFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
      ),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    })
  );
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

export class Logger {
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  private log(level: string, message: string, metadata?: Record<string, any>): void {
    winstonLogger.log({
      level,
      message,
      context: this.context,
      ...metadata,
    });
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  verbose(message: string, metadata?: Record<string, any>): void {
    this.log('verbose', message, metadata);
  }

  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }
}

export default Logger;
