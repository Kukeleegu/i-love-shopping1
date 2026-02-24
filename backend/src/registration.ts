/**
 * User registration: validate/sanitize input, verify reCAPTCHA, hash password, create user.
 * Returns user record or { error }.
 */
import { hashPassword } from './auth/passwordHashing';
import { validateEmail } from './auth/validation';
import { validatePassword } from './auth/validation';
import { validateUsername } from './auth/validation';
import { sanitizeEmail } from './auth/sanitation';
import { sanitizePassword } from './auth/sanitation';
import { sanitizeText } from './auth/sanitation';
import { createUser } from './auth/dbHelper';

async function register(
  email: string,
  password: string,
  username: string,
  captchaToken: string | undefined
): Promise<
  | { id: string; email: string; username: string; createdAt: Date; updatedAt: Date }
  | { error: string }
> {
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizePassword(password);
    const sanitizedUsername = sanitizeText(username);

    // Validate email, password strength, and username rules
    const isValidEmail = await validateEmail(sanitizedEmail);
    const isValidPassword = validatePassword(sanitizedPassword);
    const isValidUsername = validateUsername(sanitizedUsername);

    if (!isValidEmail) return { error: 'Invalid email' };
    if (!isValidPassword.isValid) return { error: 'Invalid password: ' + isValidPassword.error };
    if (!isValidUsername.isValid) return { error: 'Invalid username: ' + isValidUsername.error };

    // reCAPTCHA: require token and verify with Google siteverify API (v3 score + action)
    if (!captchaToken || !captchaToken.trim()) {
        return { error: 'Captcha is required' };
    }
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
        return { error: 'Captcha is not configured' };
    }
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', captchaToken.trim());

    let recaptchaRes: Response;
    try {
        recaptchaRes = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        });
    } catch {
        return { error: 'Could not verify captcha' };
    }
    if (!recaptchaRes.ok) {
        return { error: 'Captcha verification failed' };
    }
    const recaptchaJson = (await recaptchaRes.json()) as {
        success?: boolean;
        score?: number;
        action?: string;
    };
    if (!recaptchaJson.success) {
        return { error: 'Captcha verification failed' };
    }
    // reCAPTCHA v3: require minimum score (0.0 = bot, 1.0 = human) and matching action
    const minScore = 0.6;
    if (typeof recaptchaJson.score === 'number' && recaptchaJson.score < minScore) {
        return { error: 'Captcha verification failed' };
    }
    if (recaptchaJson.action && recaptchaJson.action !== 'register') {
        return { error: 'Captcha verification failed' };
    }

        const hashedPassword = await hashPassword(sanitizedPassword);
        const user = await createUser(sanitizedEmail, hashedPassword, sanitizedUsername);
        return user;
}

export { register };