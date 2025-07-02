import { IntegrationController } from './controllers/integration.controller';
import logger from './utils/logger';

const controller = new IntegrationController();

async function main(): Promise<void> {
  try {
    // Start the integration controller
    await controller.start();
    
    logger.info('Future Platform Integration Controller is running');
    
    // Setup graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Log statistics periodically
    setInterval(() => {
      const stats = controller.getStatistics();
      logger.info('System statistics:', stats);
    }, 60000); // Every minute
    
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');
  
  try {
    await controller.stop();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main();