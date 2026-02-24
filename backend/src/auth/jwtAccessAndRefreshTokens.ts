/**
 * JWT access and refresh tokens.
 * Access: short-lived (30m), stateless. Refresh: long-lived (7d), stored in DB for rotation/revocation.
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db';

async function generateAccessToken(userId: string): Promise<{ accessToken: string } | { error: string }> {
  if (!process.env.ACCESS_TOKEN_SECRET) return { error: 'ACCESS_TOKEN_SECRET is not set' };
  return { accessToken: jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30m' }) };
}

async function generateRefreshToken(userId: string): Promise<{ refreshToken: string } | { error: string }> {
  if (!process.env.REFRESH_TOKEN_SECRET) return { error: 'REFRESH_TOKEN_SECRET is not set' };
  // Include a random jti so tokens are unique even when requested in quick succession.
  const payload = { userId, jti: crypto.randomUUID() };
  const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  if (!(await storeRefreshToken(userId, refreshToken))) return { error: 'Failed to store refresh token' };
  return { refreshToken };
}

async function storeRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
  try {
    await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isRevoked: false,
        createdAt: new Date(),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export { generateAccessToken, generateRefreshToken };