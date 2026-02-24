import crypto from 'crypto';
import { prisma } from '../db';
import { hashPassword } from './passwordHashing';
import { validatePassword } from './validation';
import { sendPasswordResetEmail } from './email';

const RESET_EXPIRY_HOURS = 1;
const RESET_LINK_BASE = process.env.RESET_LINK_BASE_URL || 'http://localhost:3000';

function isValidEmailFormat(email: unknown): boolean {
  if (typeof email !== 'string' || !email.trim()) return false;
  return email.includes('@') && email.trim().length >= 5;
}

/**
 * Request password reset: create token, send email.
 * Same response whether email exists or not (don't leak).
 */
export async function requestPasswordReset(
  email: string
): Promise<{ ok: true } | { error: string }> {
  if (!isValidEmailFormat(email)) {
    return { error: 'Invalid email format' };
  }

  const trimmed = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: trimmed } });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    // We reuse test.html as the reset UI and pass the token in the query string
    const resetLink = `${RESET_LINK_BASE}/test.html?token=${token}`;
    try {
      await sendPasswordResetEmail(user.email, resetLink);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Password reset] Failed to send email:', msg);
      // Still return ok so we don't reveal whether the email exists
    }
  }

  return { ok: true };
}

/**
 * Reset password with token from email link.
 * One-time use; token must be valid and not expired.
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  const passValidation = validatePassword(newPassword);
  if (!passValidation.isValid) {
    return { error: passValidation.error || 'Invalid password' };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return { error: 'Invalid or missing token' };
  }

  const row = await prisma.passwordResetToken.findFirst({
    where: {
      token: token.trim(),
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!row) {
    return { error: 'Invalid or expired reset link' };
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { isUsed: true },
    }),
  ]);

  return { ok: true };
}
