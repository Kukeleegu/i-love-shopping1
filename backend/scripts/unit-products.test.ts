/**
 * Unit tests: product helpers (normalizeCategoryName, buildProductWhere shape).
 */
import { describe, it, expect } from 'vitest';
import { normalizeCategoryName, buildProductWhere, parseProductListQuery } from '../src/products';

describe('normalizeCategoryName', () => {
  it('normalizes "Super Car" to "Supercar"', () => {
    expect(normalizeCategoryName('Super Car')).toBe('Supercar');
  });

  it('normalizes "supercar" to "Supercar"', () => {
    expect(normalizeCategoryName('supercar')).toBe('Supercar');
  });

  it('normalizes "super car" to "Supercar"', () => {
    expect(normalizeCategoryName('super car')).toBe('Supercar');
  });

  it('trims and collapses spaces', () => {
    expect(normalizeCategoryName('  hyper   car  ')).toBe('Hypercar');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeCategoryName('')).toBe('');
    expect(normalizeCategoryName('   ')).toBe('');
  });
});

describe('parseProductListQuery', () => {
  it('parses q, sort, minPrice, maxPrice from query', () => {
    const req = {
      query: {
        q: '  bike  ',
        sort: 'price_asc',
        minPrice: '10',
        maxPrice: '100',
      },
    } as any;
    const out = parseProductListQuery(req);
    expect(out.q).toBe('bike');
    expect(out.sort).toBe('price_asc');
    expect(out.minPrice).toBe('10');
    expect(out.maxPrice).toBe('100');
  });

  it('returns empty undefined for missing params', () => {
    const req = { query: {} } as any;
    const out = parseProductListQuery(req);
    expect(out.q).toBeUndefined();
    expect(out.sort).toBeUndefined();
  });
});

describe('buildProductWhere', () => {
  it('returns AND with text search when q is set', () => {
    const where = buildProductWhere({ q: 'test' });
    expect(where).toHaveProperty('AND');
    const and = (where as { AND: unknown[] }).AND;
    expect(and.length).toBeGreaterThanOrEqual(1);
    expect(and.some((c: any) => c.OR)).toBe(true);
  });

  it('returns empty object when no params', () => {
    const where = buildProductWhere({});
    expect(where).toEqual({});
  });
});
