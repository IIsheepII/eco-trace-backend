import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('rejects invalid credentials', async () => {
    const service = new AuthService(
      { user: { findUnique: jest.fn().mockResolvedValue(null) } } as never,
      {} as JwtService,
      {} as ConfigService,
    );

    await expect(service.login({ email: 'x@test.dev', password: 'password123' })).rejects.toThrow(UnauthorizedException);
  });

  it('logs in active users and stores hashed refresh tokens', async () => {
    const passwordHash = await argon2.hash('password123');
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user(passwordHash)) },
      refreshToken: { create: jest.fn().mockResolvedValue({ id: 'refresh-id' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const jwt = {
      signAsync: jest.fn()
        .mockResolvedValueOnce('access.jwt')
        .mockResolvedValueOnce('refresh.jwt'),
      decode: jest.fn().mockReturnValue({ jti: 'refresh-id', exp: Math.floor(Date.now() / 1000) + 3600, familyId: 'family' }),
    };
    const config = { get: jest.fn().mockImplementation((key: string, fallback?: string) => key.includes('TTL') ? fallback : `${key}-secret`) };
    const service = new AuthService(prisma as never, jwt as never, config as never);

    const result = await service.login({ email: 'admin@test.dev', password: 'password123' });

    expect(result.tokens.accessToken).toBe('access.jwt');
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 'refresh-id' }) }));
  });
});

function user(passwordHash: string) {
  return {
    id: 'user-id',
    email: 'admin@test.dev',
    organisationId: 'org-id',
    isActive: true,
    passwordHash,
    role: { name: 'admin', permissions: ['documents:manage'] },
  };
}
