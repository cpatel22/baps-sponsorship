/**
 * Enhanced Server Actions with Database Error Handling
 * 
 * This module wraps server actions with automatic database idle detection and recovery.
 * Import and use these wrappers in your actions.ts file for automatic error handling.
 */

import { withDBConnection } from './db-wrapper';

/**
 * Wrapper for server actions that interact with the database
 * Automatically handles idle database states and retries operations
 */
export async function withDBAction<T>(
  action: () => Promise<T>,
  errorMessage: string = 'Database operation failed'
): Promise<T> {
  try {
    return await withDBConnection(action, {
      maxRetries: 3,
      retryDelay: 3000, // 3 seconds between retries
      timeoutMs: 30000, // 30 second timeout
    });
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    
    // Provide user-friendly error messages
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('idle')) {
      throw new Error('Database is currently idle. Please refresh the page and try again.');
    } else if (message.includes('connection')) {
      throw new Error('Unable to connect to database. Please try again in a moment.');
    } else {
      throw new Error(`${errorMessage}: ${err.message}`);
    }
  }
}

/**
 * Safe database query wrapper for server components
 */
export async function safeDBQuery<T>(
  queryFn: () => Promise<T>,
  defaultValue: T,
  errorMessage?: string
): Promise<T> {
  try {
    return await withDBConnection(queryFn);
  } catch (error) {
    console.error(errorMessage || 'Database query failed:', error);
    return defaultValue;
  }
}
