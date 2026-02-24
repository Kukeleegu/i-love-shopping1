/**
 * ACID Transaction Test Script
 *
 * This script demonstrates that the database respects ACID properties,
 * specifically Atomicity: all operations in a transaction either commit
 * together or roll back together.
 *
 * Run with: npx tsx scripts/test-acid.ts
 * (Ensure DATABASE_URL is set and the database is running.)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in .env');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const TEST_EMAIL_COMMIT = 'acid-test-commit@example.com';
const TEST_EMAIL_ROLLBACK = 'acid-test-rollback@example.com';

async function main() {
  console.log('=== ACID Transaction Tests ===\n');

  // -------------------------------------------------------------------------
  // Test 1: Successful transaction (Atomicity - all commit)
  // -------------------------------------------------------------------------
  console.log('Test 1: Successful transaction (commit)');
  console.log('  Creating user + refresh token in one transaction...');

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: TEST_EMAIL_COMMIT,
        username: 'acid-test-commit',
        password: 'hashed-password-placeholder',
      },
    });
    await tx.refreshToken.create({
      data: {
        token: 'test-refresh-token-commit',
        userId: user.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
  });

  // Verify both records exist (Consistency)
  const userAfterCommit = await prisma.user.findUnique({
    where: { email: TEST_EMAIL_COMMIT },
    include: { refreshTokens: true },
  });

  if (userAfterCommit && userAfterCommit.refreshTokens.length > 0) {
    console.log('  ✅ Pass: User and RefreshToken were both created (atomic commit).\n');
  } else {
    console.log('  ❌ Fail: Expected user and token to exist.\n');
  }

  // Cleanup test data
  await prisma.refreshToken.deleteMany({ where: { token: 'test-refresh-token-commit' } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL_COMMIT } });

  // -------------------------------------------------------------------------
  // Test 2: Failed transaction (Atomicity - all roll back)
  // -------------------------------------------------------------------------
  console.log('Test 2: Failed transaction (rollback)');
  console.log('  Creating user, then throwing before commit...');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: TEST_EMAIL_ROLLBACK,
          username: 'acid-test-rollback',
          password: 'hashed-password-placeholder',
        },
      });
      throw new Error('Intentional rollback');
    });
  } catch {
    // Expected: transaction rolled back
  }

  const userAfterRollback = await prisma.user.findUnique({
    where: { email: TEST_EMAIL_ROLLBACK },
  });

  if (userAfterRollback === null) {
    console.log('  ✅ Pass: User was NOT created (atomic rollback).\n');
  } else {
    console.log('  ❌ Fail: User should not exist after rollback.\n');
  }

  console.log('=== ACID tests finished ===');
}

main()
  .catch((e) => {
    console.error('Script error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
