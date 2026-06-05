import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class AppRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private lastCleanupAt = 0;

  constructor(private readonly config: ConfigService) {
    this.windowMs = this.readPositiveNumber('APP_RATE_LIMIT_WINDOW_MS', 60_000);
    this.maxRequests = this.readPositiveNumber('APP_RATE_LIMIT_MAX_REQUESTS', 120);
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const now = Date.now();
    const key = this.clientIp(request) ?? 'unknown';

    this.cleanupExpired(now);

    const current = this.buckets.get(key);
    const bucket =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + this.windowMs };

    bucket.count += 1;
    this.buckets.set(key, bucket);

    const remaining = Math.max(this.maxRequests - bucket.count, 0);
    response.setHeader('X-RateLimit-Limit', String(this.maxRequests));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > this.maxRequests) {
      throw new HttpException(
        'Demasiadas solicitudes. Intenta nuevamente en unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private clientIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim();
    }
    if (Array.isArray(forwarded)) {
      return forwarded[0]?.split(',')[0]?.trim();
    }
    return request.ip || request.socket.remoteAddress;
  }

  private cleanupExpired(now: number): void {
    if (now - this.lastCleanupAt < this.windowMs) return;
    this.lastCleanupAt = now;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private readPositiveNumber(key: string, fallback: number): number {
    const parsed = Number(this.config.get<string>(key));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
