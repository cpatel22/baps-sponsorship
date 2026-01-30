'use client';

import { useEffect, useState } from 'react';

interface DBStatus {
  isHealthy: boolean;
  isIdle: boolean;
  message: string;
  isChecking: boolean;
}

export default function DBStatusChecker() {
  const [dbStatus, setDbStatus] = useState<DBStatus>({
    isHealthy: true,
    isIdle: false,
    message: '',
    isChecking: false,
  });

  const wakeUpDB = async () => {
    setDbStatus(prev => ({ 
      ...prev, 
      isChecking: true,
      message: 'Waking up database. This may take 10-30 seconds...'
    }));

    try {
      const response = await fetch('/api/db-health/wake-up', {
        method: 'POST',
      });
      const data = await response.json();

      setDbStatus({
        isHealthy: data.isHealthy,
        isIdle: data.isIdle,
        message: data.message,
        isChecking: false,
      });

      // If successful, reload the page to refresh data
      if (data.isHealthy) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch {
      setDbStatus({
        isHealthy: false,
        isIdle: true,
        message: 'Failed to wake up database',
        isChecking: false,
      });
    }
  };

  const checkDBStatus = async () => {
    setDbStatus(prev => ({ ...prev, isChecking: true }));

    try {
      const response = await fetch('/api/db-health');
      const data = await response.json();

      setDbStatus({
        isHealthy: data.isHealthy,
        isIdle: data.isIdle,
        message: data.message,
        isChecking: false,
      });

      // If database is idle, automatically try to wake it up
      if (data.isIdle) {
        await wakeUpDB();
      }
    } catch {
      setDbStatus({
        isHealthy: false,
        isIdle: true,
        message: 'Unable to reach database',
        isChecking: false,
      });
    }
  };

  useEffect(() => {
    // Check database status when component mounts
    void checkDBStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't show anything if database is healthy
  if (dbStatus.isHealthy && !dbStatus.isChecking) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          {dbStatus.isChecking ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Connecting to Database
              </h2>
              <p className="text-gray-600">
                {dbStatus.message || 'Please wait while we establish connection...'}
              </p>
            </>
          ) : (
            <>
              <div className="bg-yellow-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Database Connection Issue
              </h2>
              <p className="text-gray-600 mb-6">
                {dbStatus.message}
              </p>
              <button
                onClick={wakeUpDB}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                Retry Connection
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
