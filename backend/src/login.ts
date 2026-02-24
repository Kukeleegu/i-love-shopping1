/**
 * Login: find user by email, verify password, optionally require 2FA.
 * Returns user + tokens, or { requires2FA, tempToken }, or { error }.
 */
import { findUserByEmail } from './auth/dbHelper';
import { comparePassword } from './auth/passwordHashing';
import { sanitizeEmail } from './auth/sanitation';
import { sanitizePassword } from './auth/sanitation';
import { generateAccessToken, generateRefreshToken } from './auth/jwtAccessAndRefreshTokens';
import { generate2FAPendingToken } from './auth/twoFactor';

async function login(email: string, password: string): Promise<
    | { id: string; email: string; updatedAt: Date; accessToken: string; refreshToken: string }
    | { requires2FA: true; tempToken: string }
    | { error: string }
> {
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizePassword(password);

    const user = await findUserByEmail(sanitizedEmail);
    if (!user) return { error: 'Invalid email or password' };

    const validPassword = await comparePassword(sanitizedPassword, user.password);
    if (!validPassword) return { error: 'Invalid email or password' };

    const u = user as { id: string; password: string; email: string; updatedAt: Date; tfaEnabled?: boolean; refreshTokens?: { isRevoked: boolean; expiresAt: Date; token: string }[] };
    // If 2FA is enabled, return temp token; client must call verify-login with code
    if (u.tfaEnabled) {
        const tempToken = generate2FAPendingToken(u.id);
        return { requires2FA: true, tempToken };
    }

    const accessToken = await generateAccessToken(u.id);
    // Reuse existing valid refresh token or create a new one
    const refreshTokenRecord = u.refreshTokens?.find((t) => !t.isRevoked && new Date(t.expiresAt) > new Date());
    const refreshToken = refreshTokenRecord
        ? { refreshToken: refreshTokenRecord.token }
        : await generateRefreshToken(user.id);

    if ('error' in accessToken || 'error' in refreshToken) {
        return { error: 'Failed to generate tokens' };
    }

    return {
        id: u.id,
        email: u.email,
        updatedAt: u.updatedAt,
        accessToken: accessToken.accessToken,
        refreshToken: refreshToken.refreshToken,
    };
}
export { login };