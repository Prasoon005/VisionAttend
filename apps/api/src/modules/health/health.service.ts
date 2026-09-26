import type { DependencyCheck, LivenessResponse, ReadinessResponse } from '@visionattend/shared';
import type { Logger } from '../../lib/logger.js';

/** Resolves if the dependency is usable, rejects otherwise. */
export type DependencyProbe = () => Promise<void>;

export interface HealthProbes {
  database: DependencyProbe;
  redis: DependencyProbe;
  cvService: DependencyProbe;
}

export interface HealthServiceOptions {
  probes: HealthProbes;
  version: string;
  logger: Logger;
  timeoutMs?: number;
}

export class HealthService {
  private readonly startedAt = Date.now();
  private readonly timeoutMs: number;

  constructor(private readonly options: HealthServiceOptions) {
    this.timeoutMs = options.timeoutMs ?? 2000;
  }

  /** Liveness: the process is up. Never touches dependencies. */
  liveness(): LivenessResponse {
    return {
      status: 'ok',
      service: 'api',
      version: this.options.version,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: every dependency the API needs responds, checked in parallel. */
  async readiness(): Promise<ReadinessResponse> {
    const { probes } = this.options;
    const [database, redis, cvService] = await Promise.all([
      this.check('database', probes.database),
      this.check('redis', probes.redis),
      this.check('cvService', probes.cvService),
    ]);
    const allUp = [database, redis, cvService].every((check) => check.status === 'up');

    return {
      status: allUp ? 'ready' : 'degraded',
      checks: { database, redis, cvService },
      timestamp: new Date().toISOString(),
    };
  }

  private async check(name: string, probe: DependencyProbe): Promise<DependencyCheck> {
    const started = performance.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        probe(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), this.timeoutMs);
        }),
      ]);
      return { status: 'up', latencyMs: elapsed(started) };
    } catch (error) {
      // Full details go to the log; the response only says "unavailable" so
      // internal hostnames or driver messages are never exposed to clients.
      this.options.logger.warn({ dependency: name, err: error }, 'health check failed');
      const timedOut = error instanceof Error && error.message === 'timeout';
      return {
        status: 'down',
        latencyMs: elapsed(started),
        error: timedOut ? 'timeout' : 'unavailable',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

const elapsed = (started: number) => Math.round(performance.now() - started);
