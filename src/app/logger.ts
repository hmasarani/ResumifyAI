import pino, { Logger } from 'pino';

const logger: Logger = pino({
  level: 'debug', // Adjust the log level as needed (e.g., 'debug', 'error')
  prettyPrint: true, // Enable pretty printing for console logs (optional)
});

export default logger;