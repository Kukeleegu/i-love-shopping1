import { Request, Response } from 'express';
import { prisma } from '../db';
import { generateAccessToken, generateRefreshToken } from './jwtAccessAndRefreshTokens';

/**
 * Refresh endpoint handler.
 * Client sends refresh token → we find it in DB, revoke it, issue new access + refresh, return both.
 */
async function refresh(req: Request, res: Response): Promise<void> {
  const tokenFromBody = req.body.refreshToken;

  if (!tokenFromBody?.trim()) {
    res.status(401).json({ error: 'Refresh token is invalid or missing' });
    return;
  }

  // Find valid token in DB (not revoked, not expired)
  const row = await prisma.refreshToken.findFirst({
    where: {
      token: tokenFromBody,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!row) {
    res.status(401).json({ error: 'Refresh token is invalid or missing' });
    return;
  }

  // First, try to generate and store the NEW tokens.
  // If anything fails here, we do NOT revoke the old token so the client can retry.
  const accessResult = await generateAccessToken(row.userId);
  if ('error' in accessResult) {
    res.status(500).json({ error: 'Failed to generate access token' });
    return;
  }

  const refreshResult = await generateRefreshToken(row.userId);
  if ('error' in refreshResult) {
    res.status(500).json({ error: 'Failed to generate refresh token' });
    return;
  }

  // Only after we successfully created and stored the new refresh token
  // do we revoke the old one (single-use rotation).
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { isRevoked: true },
  });

  // Single response with both tokens
  res.json({
    accessToken: accessResult.accessToken,
    refreshToken: refreshResult.refreshToken,
  });
}

export default refresh;