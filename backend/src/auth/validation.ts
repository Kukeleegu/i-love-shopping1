/**
 * Validation for registration: email (format + uniqueness), password (length, number, special, upper/lower), username.
 */
import { emailExists } from './dbHelper';

async function validateEmail(email: string): Promise<boolean> {
  if (!email || typeof email !== 'string') return false;
  if (await emailExists(email)) return false;
  if (!email.includes('@')) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [localPart, domainPart] = parts;
  if (!localPart || localPart.length === 0) return false;
  if (!domainPart || domainPart.length === 0) return false;
  if (!domainPart.includes('.')) return false;
  const domainParts = domainPart.split('.');
  if (domainParts.length < 2 || domainParts[0].length === 0) return false;
  const lastPart = domainParts[domainParts.length - 1];
  if (!lastPart || lastPart.length < 2) return false;
  return true;
}

function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password must be a non-empty string' };
  }
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { isValid: false, error: 'Password must be no more than 128 characters long' };
  }
  const numbers = '0123456789';
  let hasNumber = false;
  for (let i = 0; i < password.length; i++) {
    if (numbers.includes(password[i])) { hasNumber = true; break; }
  }
  if (!hasNumber) return { isValid: false, error: 'Password must contain at least one number' };

  const specialChars = '!@#$%^&*()';
  let hasSpecialChar = false;
  for (let i = 0; i < password.length; i++) {
    if (specialChars.includes(password[i])) { hasSpecialChar = true; break; }
  }
  if (!hasSpecialChar) return { isValid: false, error: 'Password must contain at least one special character !@#$%^&*)(' };

  let hasUpperCase = false;
  for (let i = 0; i < password.length; i++) {
    if (password[i] >= 'A' && password[i] <= 'Z') { hasUpperCase = true; break; }
  }
  if (!hasUpperCase) return { isValid: false, error: 'Password must contain at least one uppercase letter' };

  let hasLowerCase = false;
  for (let i = 0; i < password.length; i++) {
    if (password[i] >= 'a' && password[i] <= 'z') { hasLowerCase = true; break; }
  }
  if (!hasLowerCase) return { isValid: false, error: 'Password must contain at least one lowercase letter' };

  return { isValid: true };
}

function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username must be a non-empty string' };
  }
  return { isValid: true };
}

export { validateEmail, validatePassword, validateUsername };