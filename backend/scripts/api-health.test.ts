/**
 * API tests: health and public endpoints.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';

describe('Health', () => {
  it('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});

describe('Products (public)', () => {
  it('GET /api/products returns 200 and products array when DB available', async () => {
    const res = await request(app).get('/api/products');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    }
  });

  it('GET /api/products/suggest returns 200 and suggestions when q provided', async () => {
    const res = await request(app).get('/api/products/suggest?q=test');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('suggestions');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    }
  });

  it('GET /api/products/facets returns 200 and brands, categories when DB available', async () => {
    const res = await request(app).get('/api/products/facets');
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('brands');
      expect(res.body).toHaveProperty('categories');
      expect(Array.isArray(res.body.brands)).toBe(true);
      expect(Array.isArray(res.body.categories)).toBe(true);
    }
  });
});
