/**
 * Two-factor authentication (TOTP): setup, verify-setup, verify-login, disable.
 * Uses otplib for TOTP; 2FA-pending login uses a short-lived JWT.
 */

import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verify } from 'otplib';
import { prisma } from '../db';
import { generateAccessToken, generateRefreshToken } from './jwtAccessAndRefreshTokens';

const ISSUER = process.env.TFA_ISSUER || 'DotComRetail';
const TFA_PENDING_EXPIRY = '5m';

function get2FAPendingSecret(): string {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.TFA_PENDING_SECRET;
  if (!secret) throw new Error('ACCESS_TOKEN_SECRET or TFA_PENDING_SECRET must be set for 2FA');
  return secret;
}

export function generate2FAPendingToken(userId: string): string {
  return jwt.sign(
    { userId, purpose: '2fa_pending' },
    get2FAPendingSecret(),
    { expiresIn: TFA_PENDING_EXPIRY }
  );
}

export function verify2FAPendingToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, get2FAPendingSecret()) as { userId?: string; purpose?: string };
    if (payload.purpose !== '2fa_pending' || !payload.userId) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  if (!secret || !code || code.length !== 6) return false;
  try {
    const result = await verify({ secret, token: code.trim() });
    return result.valid === true;
  } catch {
    return false;
  }
}

/** POST /api/auth/2fa/setup — start 2FA setup: generate secret, store in tempTfaSecret, return secret + otpauth URL */
export async function setup2FA(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tfaEnabled: true, tempTfaSecret: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (user.tfaEnabled) {
      res.status(400).json({ error: '2FA is already enabled' });
      return;
    }

    const secret = generateSecret();
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const label = userRecord?.email || userId;
    const otpauthUrl = generateURI({ secret, issuer: ISSUER, label });

    await prisma.user.update({
      where: { id: userId },
      data: { tempTfaSecret: secret },
    });

    res.status(200).json({
      secret,
      otpauthUrl,
      message: 'Scan the QR code with Google Authenticator or Authy, then verify with a code.',
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ error: '2FA setup failed' });
  }
}

/** POST /api/auth/2fa/verify-setup — body: { code }. Verify code against tempTfaSecret, then enable 2FA */
export async function verifySetup2FA(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const code = (req.body?.code as string)?.trim();
    if (!code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tempTfaSecret: true, tfaEnabled: true },
    });
    if (!user?.tempTfaSecret) {
      res.status(400).json({ error: 'No 2FA setup in progress. Start setup first.' });
      return;
    }

    const valid = await verifyTOTP(user.tempTfaSecret, code);
    if (!valid) {
      res.status(400).json({ error: 'Invalid code' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { tfaSecret: user.tempTfaSecret, tempTfaSecret: null, tfaEnabled: true },
    });

    res.status(200).json({ message: '2FA enabled successfully' });
  } catch (err) {
    console.error('2FA verify-setup error:', err);
    res.status(500).json({ error: '2FA verification failed' });
  }
}

/** POST /api/auth/2fa/verify-login — body: { tempToken, code }. Verify 2FA and return access + refresh tokens */
export async function verifyLogin2FA(req: Request, res: Response): Promise<void> {
  try {
    const { tempToken, code } = req.body as { tempToken?: string; code?: string };
    if (!tempToken || !code) {
      res.status(400).json({ error: 'tempToken and code are required' });
      return;
    }

    const payload = verify2FAPendingToken(tempToken.trim());
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired login. Please log in again.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, tfaEnabled: true, tfaSecret: true },
    });
    if (!user || !user.tfaEnabled || !user.tfaSecret) {
      res.status(400).json({ error: '2FA not enabled for this account' });
      return;
    }

    const valid = await verifyTOTP(user.tfaSecret, String(code).trim());
    if (!valid) {
      res.status(401).json({ error: 'Invalid code' });
      return;
    }

    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    if ('error' in accessToken || 'error' in refreshToken) {
      res.status(500).json({ error: 'Failed to generate tokens' });
      return;
    }

    res.status(200).json({
      user: {
        userId: user.id,
        accessToken: accessToken.accessToken,
        refreshToken: refreshToken.refreshToken,
      },
    });
  } catch (err) {
    console.error('2FA verify-login error:', err);
    res.status(500).json({ error: '2FA login verification failed' });
  }
}

/** POST /api/auth/2fa/disable — body: { code }. Verify code and disable 2FA */
export async function disable2FA(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const code = (req.body?.code as string)?.trim();
    if (!code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tfaEnabled: true, tfaSecret: true },
    });
    if (!user?.tfaEnabled || !user.tfaSecret) {
      res.status(400).json({ error: '2FA is not enabled' });
      return;
    }

    const valid = await verifyTOTP(user.tfaSecret, code);
    if (!valid) {
      res.status(401).json({ error: 'Invalid code' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { tfaSecret: null, tempTfaSecret: null, tfaEnabled: false },
    });

    res.status(200).json({ message: '2FA disabled successfully' });
  } catch (err) {
    console.error('2FA disable error:', err);
    res.status(500).json({ error: '2FA disable failed' });
  }
}
