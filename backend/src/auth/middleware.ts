import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

// Extend Express Request so handlers can use req.user
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string };
    }
  }
}

/**
 * Auth middleware: verifies the access token and sets req.user.
 * Rejects if token is expired, invalid, or revoked (user.tokenVersion mismatch).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as { userId: string; tokenVersion?: number };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { tokenVersion: true },
    });
    if (!user || user.tokenVersion !== (decoded.tokenVersion ?? 0)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = { userId: decoded.userId };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/** Optional auth: sets req.user if Bearer token is valid and not revoked; does not 401 if missing or invalid. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    next();
    return;
  }
  try {
    const decoded = jwt.verify(token, secret) as { userId: string; tokenVersion?: number };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { tokenVersion: true },
    });
    if (user && user.tokenVersion === (decoded.tokenVersion ?? 0)) {
      req.user = { userId: decoded.userId };
    }
  } catch {
    // leave req.user undefined
  }
  next();
}
