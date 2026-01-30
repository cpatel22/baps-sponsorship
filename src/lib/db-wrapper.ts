/**
 * Database Operation Wrapper
 * 
 * This module wraps database operations to automatically detect and handle
 * idle database states, providing a better user experience with automatic retries.
 */

import { checkDatabaseHealth, wakeUpDatabase } from './db-health';

export interface DBOperationOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<DBOperationOptions> = {
  maxRetries: 3,
  retryDelay: 2000,
  timeoutMs: 30000,
};

/**
 * Executes a database operation with automatic idle detection and wake-up
 */
export async function withDBConnection<T>(
  operation: () => Promise<T>,
  options: DBOperationOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database operation timeout')), opts.timeoutMs)
      );

      // Race between the operation and timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise,
      ]);

      // Success!
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message.toLowerCase();

      // Check if error indicates idle database
      const isIdleError = 
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('idle') ||
        errorMessage.includes('sleeping');

      if (isIdleError && attempt < opts.maxRetries) {
        console.log(`Database appears idle. Attempt ${attempt}/${opts.maxRetries} - waking up database...`);
        
        // Try to wake up the database
        const health = await wakeUpDatabase(2, opts.retryDelay);
        
        if (!health.isHealthy) {
          console.log(`Wake-up attempt ${attempt} failed, waiting before retry...`);
          await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
        } else {
          console.log(`Database is awake, retrying operation...`);
        }
      } else if (!isIdleError) {
        // If it's not an idle error, don't retry
        throw lastError;
      } else if (attempt === opts.maxRetries) {
        // Last attempt failed
        throw new Error(`Database operation failed after ${opts.maxRetries} attempts: ${lastError.message}`);
      }
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Database operation failed');
}

/**
 * Start a background keep-alive process
 * This will ping the database every interval to keep it awake
 */
export function startKeepAlive(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  console.log(`Starting database keep-alive with ${intervalMs}ms interval`);
  
  const keepAlive = async () => {
    try {
      const health = await checkDatabaseHealth();
      if (!health.isHealthy && health.isIdle) {
        console.log('Keep-alive detected idle database, attempting wake-up...');
        await wakeUpDatabase();
      }
    } catch (error) {
      console.error('Keep-alive error:', error);
    }
  };

  // Run immediately
  keepAlive();

  // Then run on interval
  return setInterval(keepAlive, intervalMs);
}

/**
 * Stop the keep-alive process
 */
export function stopKeepAlive(timer: NodeJS.Timeout): void {
  clearInterval(timer);
  console.log('Database keep-alive stopped');
}
