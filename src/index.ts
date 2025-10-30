/**
 * Main Entry Point
 * QA Automation Agent
 */

import 'dotenv/config';
import { OrchestratorAgent } from './orchestrator/main.js';
import { logger } from './utils/logger.js';
import { validateEnv } from './utils/validation.js';

/**
 * Main function
 */
async function main() {
  logger.info('🚀 QA Automation Agent Starting...');

  try {
    // Step 1: Validate environment variables
    logger.info('Validating environment variables...');
    const env = validateEnv();

    logger.info('✅ Environment validated', {
      database: env.NOTION_DATABASE_ID.substring(0, 8) + '...',
      repo: `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`,
      slackEnabled: !!env.SLACK_BOT_TOKEN,
    });

    // Step 2: Create orchestrator
    const orchestrator = new OrchestratorAgent({
      databaseId: env.NOTION_DATABASE_ID,
      slackChannel: env.SLACK_CHANNEL_QA,
    });

    // Step 3: Initialize orchestrator
    await orchestrator.initialize();

    // Step 4: Start orchestrator
    await orchestrator.start();

    logger.info('✅ QA Automation Agent is running');

    // Step 5: Setup periodic stats logging
    setInterval(() => {
      const stats = orchestrator.getStats();
      logger.info('📊 Orchestrator Stats', stats);
    }, 60000); // Every minute

    // Step 6: Handle graceful shutdown
    setupGracefulShutdown(orchestrator);
  } catch (error) {
    logger.error('💥 Failed to start QA Automation Agent', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(orchestrator: OrchestratorAgent) {
  const shutdown = async (signal: string) => {
    logger.info(`📴 Received ${signal}, shutting down gracefully...`);

    try {
      await orchestrator.stop();
      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  };

  // Handle SIGTERM (Docker, Kubernetes)
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });

    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Promise Rejection', {
      reason,
      promise,
    });
  });
}

// Start the application
main().catch((error) => {
  logger.error('💥 Fatal error', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});
