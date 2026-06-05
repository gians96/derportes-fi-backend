import { HttpException, HttpStatus } from '@nestjs/common';
import { AppRateLimitGuard } from './app-rate-limit.guard';

describe('AppRateLimitGuard', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        APP_RATE_LIMIT_WINDOW_MS: '60000',
        APP_RATE_LIMIT_MAX_REQUESTS: '2',
      };
      return values[key];
    }),
  };

  function createContext(ip = '127.0.0.1') {
    const response = { setHeader: jest.fn() };
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-forwarded-for': ip },
          ip,
          socket: { remoteAddress: ip },
        }),
        getResponse: () => response,
      }),
    };
  }

  it('allows requests within the configured window limit', () => {
    const guard = new AppRateLimitGuard(config as never);

    expect(guard.canActivate(createContext() as never)).toBe(true);
    expect(guard.canActivate(createContext() as never)).toBe(true);
  });

  it('throws 429 when the IP exceeds the application limit', () => {
    const guard = new AppRateLimitGuard(config as never);

    guard.canActivate(createContext() as never);
    guard.canActivate(createContext() as never);

    expect(() => guard.canActivate(createContext() as never)).toThrow(
      HttpException,
    );
    try {
      guard.canActivate(createContext() as never);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  });
});
