/**
 * Security / validation tests: malformed or invalid inputs.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';

describe('Input validation', () => {
  it('POST /api/auth/login with non-JSON body is handled', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('not json');
    expect([400, 500]).toContain(res.status);
  });

  it('POST /api/products without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Content-Type', 'application/json')
      .send({
        name: 'Test',
        price: '99',
        brand: 'Test',
        categoryName: 'Test',
      });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/products/:id without auth returns 401', async () => {
    const res = await request(app)
      .delete('/api/products/some-fake-id');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/products/:id without auth returns 401', async () => {
    const res = await request(app)
      .patch('/api/products/some-fake-id')
      .set('Content-Type', 'application/json')
      .send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });
});
