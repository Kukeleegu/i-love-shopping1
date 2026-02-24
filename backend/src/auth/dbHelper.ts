/**
 * Auth DB helpers: check email existence, create user, find user by email (with password and 2FA/refresh for login).
 */
import { prisma } from '../db';

async function emailExists(email: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { email } });
  return user !== null;
}

async function createUser(email: string, password: string, username: string): Promise<{ 
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  const user = await prisma.user.create({
    data: { email, password, username },
    select: { id: true, email: true, username: true, createdAt: true, updatedAt: true },
  });
  return user;
}

async function findUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      createdAt: true,
      updatedAt: true,
      password: true,
      refreshTokens: true,
      tfaEnabled: true,
    },
  });
  return user ?? null;
}

export { emailExists, createUser, findUserByEmail };