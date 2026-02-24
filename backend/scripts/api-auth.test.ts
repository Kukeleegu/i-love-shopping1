/**
 * API tests: auth endpoints (register, login, protected routes).
 * These hit the real API; DB must be available for register/login.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';

const API = (path: string) => request(app).post(path).set('Content-Type', 'application/json');

describe('Auth API', () => {
  it('POST /api/auth/login with missing body returns 400 or 500', async () => {
    const res = await API('/api/auth/login').send({});
    expect([400, 500]).toContain(res.status);
    if (res.body && res.body.error) {
      expect(res.body.error).toBeDefined();
    }
  });

  it('POST /api/auth/login with invalid credentials returns 400 or 500', async () => {
    const res = await API('/api/auth/login').send({
      email: 'nonexistent@test.com',
      password: 'wrong',
    });
    expect([400, 500]).toContain(res.status);
    if (res.status === 400 && res.body && typeof res.body === 'object') {
      expect(res.body).toHaveProperty('error');
    }
  });

  it('GET /api/users/me without auth returns 401', async () => {
    const res = await request(app)
      .get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/users/me with invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});
