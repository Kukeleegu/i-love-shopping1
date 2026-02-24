/**
 * Password hashing with bcrypt (cost 12). Used at registration and password reset.
 */
import bcrypt from 'bcrypt';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export { hashPassword, comparePassword };