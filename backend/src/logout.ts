import { Request, Response } from 'express';
import { prisma } from './db';

/**
 * Logout — revoke the refresh token so it can't be used again.
 * Client sends refresh token in body; we find it in RefreshToken and set isRevoked = true.
 */
async function logout(req: Request, res: Response): Promise<void> {
  const tokenFromBody = req.body.refreshToken;
  if (!tokenFromBody?.trim()) {
    res.status(400).json({ error: 'Refresh token is required' });
    return;
  }

  const row = await prisma.refreshToken.findFirst({ where: { token: tokenFromBody } });
  if (!row) {
    res.status(401).json({ error: 'Refresh token is invalid or missing' });
    return;
  }

  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { isRevoked: true },
  });
  res.json({ message: 'Logged out successfully' });
}

export default logout;
