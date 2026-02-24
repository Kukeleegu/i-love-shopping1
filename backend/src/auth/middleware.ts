import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
 * Use on routes that require login (e.g. GET /api/users/me).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
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
    const decoded = jwt.verify(token, secret) as { userId: string };
    req.user = { userId: decoded.userId };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/** Optional auth: sets req.user if Bearer token is valid; does not 401 if missing or invalid. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
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
    const decoded = jwt.verify(token, secret) as { userId: string };
    req.user = { userId: decoded.userId };
  } catch {
    // leave req.user undefined
  }
  next();
}
