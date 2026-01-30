// Database health check utilities

export interface DBHealthStatus {
  isHealthy: boolean;
  isIdle: boolean;
  message: string;
  lastChecked: Date;
  responseTime?: number;
}

let lastHealthCheck: DBHealthStatus | null = null;
let healthCheckInProgress = false;

/**
 * Check database health and connection status
 */
export async function checkDatabaseHealth(): Promise<DBHealthStatus> {
  // If a health check is already in progress, wait for it
  if (healthCheckInProgress && lastHealthCheck) {
    return lastHealthCheck;
  }

  healthCheckInProgress = true;
  const startTime = Date.now();

  try {
    // Try to get the connection pool
    const { getPool } = await import('./db-azure');
    const pool = await getPool();

    // Execute a simple query to verify database is responsive
    await pool.request().query('SELECT 1 AS health_check');

    const responseTime = Date.now() - startTime;
    
    lastHealthCheck = {
      isHealthy: true,
      isIdle: false,
      message: 'Database is connected and responsive',
      lastChecked: new Date(),
      responseTime,
    };

    healthCheckInProgress = false;
    return lastHealthCheck;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if error indicates idle/sleeping database
    const isIdleError = 
      errorMessage.includes('timeout') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('Cannot open server') ||
      errorMessage.includes('server was not found');

    lastHealthCheck = {
      isHealthy: false,
      isIdle: isIdleError,
      message: isIdleError 
        ? 'Database is idle or sleeping. Attempting to wake it up...' 
        : `Database error: ${errorMessage}`,
      lastChecked: new Date(),
      responseTime,
    };

    healthCheckInProgress = false;
    return lastHealthCheck;
  }
}

/**
 * Attempt to wake up an idle database
 */
export async function wakeUpDatabase(maxRetries = 3, retryDelay = 2000): Promise<DBHealthStatus> {
  console.log('Attempting to wake up database...');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Wake-up attempt ${attempt} of ${maxRetries}...`);

    const health = await checkDatabaseHealth();

    if (health.isHealthy) {
      console.log('Database is now awake and responsive!');
      return health;
    }

    if (attempt < maxRetries) {
      console.log(`Waiting ${retryDelay}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  // If all retries failed, return the last health check
  return lastHealthCheck || {
    isHealthy: false,
    isIdle: true,
    message: 'Failed to wake up database after multiple attempts',
    lastChecked: new Date(),
  };
}

/**
 * Get the last health check result without performing a new check
 */
export function getLastHealthCheck(): DBHealthStatus | null {
  return lastHealthCheck;
}

/**
 * Keep database alive by periodically executing lightweight queries
 */
export async function keepDatabaseAlive(): Promise<void> {
  try {
    const health = await checkDatabaseHealth();
    
    if (!health.isHealthy && health.isIdle) {
      await wakeUpDatabase();
    }
  } catch (error) {
    console.error('Error in keepDatabaseAlive:', error);
  }
}
