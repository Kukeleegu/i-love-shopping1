/**
 * Database client: Prisma with the pg driver adapter.
 * Loads DATABASE_URL from environment (via dotenv). Used by all routes and auth logic.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment');
}

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
