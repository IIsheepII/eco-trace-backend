import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const auth = {
    login: jest.fn().mockResolvedValue({
      user: { id: 'user-id', email: 'admin@test.dev', organisationId: 'org-id', role: 'admin', permissions: [] },
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
    }),
    setAuthCookies: jest.fn((res) => {
      res.cookie('access_token', 'access', { httpOnly: true });
      res.cookie('refresh_token', 'refresh', { httpOnly: true });
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/login sets cookies', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.dev', password: 'password123' })
      .expect(200);

    expect(String(response.headers['set-cookie'])).toContain('access_token');
    expect(response.body.user.email).toBe('admin@test.dev');
  });
});
