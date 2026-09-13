import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const uniqueEmail = `e2e-${Date.now()}@test.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register should create a new user and return tokens', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail,
        password: 'password123',
        firstName: 'E2E',
        lastName: 'Test',
        organizationName: 'E2E Org',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.user.email).toBe(uniqueEmail);
      });
  });

  it('POST /auth/register should reject duplicate email', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail,
        password: 'password123',
        firstName: 'E2E',
        lastName: 'Test',
        organizationName: 'E2E Org',
      })
      .expect(409);
  });

  it('POST /auth/login should reject invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail, password: 'wrong-password' })
      .expect(401);
  });

  it('POST /auth/login should return tokens for valid credentials', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail, password: 'password123' })
      .expect(201)
      .expect((res) => {
        expect(res.body.accessToken).toBeDefined();
        expect(res.body.refreshToken).toBeDefined();
      });
  });

  it('GET /organizations/me should reject request without token', () => {
    return request(app.getHttpServer()).get('/api/v1/organizations/me').expect(401);
  });

  it('GET /organizations/me should return org details with valid token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail, password: 'password123' });

    const token = loginRes.body.accessToken;

    return request(app.getHttpServer())
      .get('/api/v1/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('E2E Org');
      });
  });

  it('POST /auth/register should reject invalid payload (missing fields)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'invalid-email' })
      .expect(400);
  });
});
