import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/types';
import { LoginDto } from './dto/login.dto';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });
    if (!user?.isActive || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = this.toPayload(user);
    const tokens = await this.issueTokens(payload, randomUUID());
    await this.storeRefreshToken(user.id, tokens.refreshToken, undefined);
    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'LOGIN',
        resource: 'auth',
        ipAddress,
        userAgent,
      },
    });
    return { user: payload, tokens };
  }

  async refresh(refreshToken?: string, ipAddress?: string, userAgent?: string) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    let payload: AuthenticatedUser & { familyId: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revokedAt || !(await argon2.verify(stored.tokenHash, refreshToken))) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });
    if (!user?.isActive) throw new UnauthorizedException('Inactive account');

    const nextPayload = this.toPayload(user);
    const tokens = await this.issueTokens(nextPayload, payload.familyId);
    const next = await this.storeRefreshToken(user.id, tokens.refreshToken, payload.familyId);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: next.id },
    });
    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'REFRESH',
        resource: 'auth',
        ipAddress,
        userAgent,
      },
    });

    return { user: nextPayload, tokens };
  }

  async logout(userId: string, refreshToken?: string) {
    if (!refreshToken) return;
    try {
      const payload = await this.jwt.verifyAsync<{ jti: string }>(refreshToken, {
        secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, userId },
        data: { revokedAt: new Date() },
      });
    } catch {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  setAuthCookies(res: Response, tokens: TokenPair) {
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: secure ? 'none' : 'lax',
      secure,
      domain,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: secure ? 'none' : 'lax',
      secure,
      domain,
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  private async issueTokens(payload: AuthenticatedUser, familyId: string): Promise<TokenPair> {
    const refreshTokenId = randomUUID();
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('ACCESS_TOKEN_SECRET'),
      expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL', '15m'),
    });
    const refreshToken = await this.jwt.signAsync({ ...payload, familyId }, {
      jwtid: refreshTokenId,
      secret: this.config.get<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: this.config.get<string>('REFRESH_TOKEN_TTL', '7d'),
    });
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string, familyId?: string) {
    const decoded = this.jwt.decode(refreshToken) as { jti: string; exp: number; familyId: string };
    return this.prisma.refreshToken.create({
      data: {
        id: decoded.jti,
        userId,
        familyId: familyId ?? decoded.familyId,
        tokenHash: await argon2.hash(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
  }

  private toPayload(user: { id: string; email: string; organisationId: string; role: { name: string; permissions: string[] } }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      organisationId: user.organisationId,
      role: user.role.name,
      permissions: user.role.permissions,
    };
  }
}
