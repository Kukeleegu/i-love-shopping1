/**
 * Unit tests: JWT access token generation and validation.
 * Run: npm test (or npx vitest run --config vitest.config.ts)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret-for-unit-tests';

describe('JWT', () => {
  beforeAll(() => {
    if (!process.env.ACCESS_TOKEN_SECRET) {
      process.env.ACCESS_TOKEN_SECRET = ACCESS_SECRET;
    }
  });

  it('generates a token with userId in payload', () => {
    const token = jwt.sign(
      { userId: 'user-123' },
      ACCESS_SECRET,
      { expiresIn: '30m' }
    );
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    const decoded = jwt.verify(token, ACCESS_SECRET) as { userId: string };
    expect(decoded.userId).toBe('user-123');
  });

  it('token expires after expiresIn', () => {
    const token = jwt.sign(
      { userId: 'user-123' },
      ACCESS_SECRET,
      { expiresIn: '-1s' } // already expired
    );
    expect(() => jwt.verify(token, ACCESS_SECRET)).toThrow(jwt.TokenExpiredError);
  });

  it('invalid signature throws', () => {
    const token = jwt.sign({ userId: 'user-123' }, ACCESS_SECRET, { expiresIn: '30m' });
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow(jwt.JsonWebTokenError);
  });
});
