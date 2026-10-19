import { useState, useEffect, useCallback } from 'react';
import { HealthStatus } from '../types';
import { fetchHealthStatus } from '../api/health';

export function useHealth(pollIntervalMs: number = 30000) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchHealthStatus();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backend unreachable');
      setHealth({
        status: 'error',
        app_name: 'Emergency Network Backend (Offline)',
        version: 'Unknown',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    if (pollIntervalMs > 0) {
      const interval = setInterval(checkHealth, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [checkHealth, pollIntervalMs]);

  return { health, loading, error, refresh: checkHealth };
}
