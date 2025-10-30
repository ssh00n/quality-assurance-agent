/**
 * Winston-based logging utility
 */

import winston from 'winston';
import path from 'path';

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Create Winston logger instance
 */
function createLogger() {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logDir = path.join(process.cwd(), 'logs');

  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  // Console format with colors
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      let msg = `${timestamp} [${level}]: ${message}`;

      // Add metadata if exists
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata, null, 2)}`;
      }

      return msg;
    })
  );

  return winston.createLogger({
    level: logLevel,
    format: logFormat,
    transports: [
      // Console output
      new winston.transports.Console({
        format: consoleFormat,
      }),

      // All logs file
      new winston.transports.File({
        filename: path.join(logDir, 'qa-automation.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true,
      }),

      // Error logs file
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true,
      }),

      // Exceptions log file
      new winston.transports.File({
        filename: path.join(logDir, 'exceptions.log'),
        handleExceptions: true,
      }),
    ],
    exitOnError: false,
  });
}

/**
 * Singleton logger instance
 */
const baseLogger = createLogger();

/**
 * Extended logger with custom methods
 */
export const logger = Object.assign(baseLogger, {
  agent: (agentType: string, action: string, metadata?: Record<string, any>) => {
    baseLogger.info(`[${agentType}] ${action}`, metadata);
  },
  session: (sessionId: string, action: string, metadata?: Record<string, any>) => {
    baseLogger.info(`[Session:${sessionId}] ${action}`, metadata);
  },
  project: (projectId: string, action: string, metadata?: Record<string, any>) => {
    baseLogger.info(`[Project:${projectId}] ${action}`, metadata);
  },
});

/**
 * Log helper functions with typed metadata
 */
export const log = {
  error: (message: string, metadata?: Record<string, any>) => {
    logger.error(message, metadata);
  },

  warn: (message: string, metadata?: Record<string, any>) => {
    logger.warn(message, metadata);
  },

  info: (message: string, metadata?: Record<string, any>) => {
    logger.info(message, metadata);
  },

  debug: (message: string, metadata?: Record<string, any>) => {
    logger.debug(message, metadata);
  },

  /**
   * Log agent activity
   */
  agent: (agentType: string, action: string, metadata?: Record<string, any>) => {
    logger.info(`[${agentType}] ${action}`, metadata);
  },

  /**
   * Log session activity
   */
  session: (sessionId: string, action: string, metadata?: Record<string, any>) => {
    logger.info(`[Session:${sessionId}] ${action}`, metadata);
  },

  /**
   * Log project activity (for multi-project)
   */
  project: (projectId: string, action: string, metadata?: Record<string, any>) => {
    logger.info(`[Project:${projectId}] ${action}`, metadata);
  },
};

/**
 * Create child logger with default metadata
 */
export function createChildLogger(defaultMetadata: Record<string, any>) {
  return baseLogger.child(defaultMetadata);
}
