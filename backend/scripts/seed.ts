/**
 * Seed DB from seed-data/export.json (products, categories, users, ratings) and copy images.
 * Run after migrations: npx prisma db seed
 * Or in Docker: docker compose exec backend npx prisma db seed
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// When run as "npx prisma db seed" from backend, cwd is backend
const BACKEND_DIR = process.cwd();
const SEED_DATA_DIR = path.join(BACKEND_DIR, 'seed-data');
const SEED_UPLOADS_DIR = path.join(SEED_DATA_DIR, 'uploads');
const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');

const DEMO_PASSWORD = 'Demo123!';

function toDecimal(v: unknown): Prisma.Decimal | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && !Number.isNaN(v)) return new Prisma.Decimal(v);
  if (typeof v === 'string') return new Prisma.Decimal(v);
  return null;
}

async function main() {
  const exportPath = path.join(SEED_DATA_DIR, 'export.json');
  if (!fs.existsSync(exportPath)) {
    console.log('No seed-data/export.json found. Run scripts/export-seed-data.ts first to generate it.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(exportPath, 'utf-8')) as {
    users: { id: string; email: string; username: string }[];
    categories: { id: string; name: string }[];
    products: Record<string, unknown>[];
    productCategories: { productId: string; categoryId: string }[];
    productRatings: { id: string; userId: string; productId: string; score: number }[];
  };

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const u of data.users) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        username: u.username,
        password: hashedPassword,
      },
      update: { username: u.username },
    });
  }
  console.log(`Seeded ${data.users.length} user(s). Password for all: ${DEMO_PASSWORD}`);

  for (const c of data.categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      create: { id: c.id, name: c.name },
      update: { name: c.name },
    });
  }
  console.log(`Seeded ${data.categories.length} category(ies).`);

  for (const p of data.products) {
    const product = p as {
      id: string;
      name: string;
      description: string | null;
      price: number;
      stockQuantity: number;
      brand: string;
      images: string[];
      createdByUserId: string | null;
      weightKg?: number | null;
      weightLbs?: number | null;
      lengthCm?: number | null;
      widthCm?: number | null;
      heightCm?: number | null;
      lengthIn?: number | null;
      widthIn?: number | null;
      heightIn?: number | null;
      averageRating?: number | null;
      ratingCount?: number;
    };
    await prisma.product.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: toDecimal(product.price)!,
        stockQuantity: product.stockQuantity ?? 0,
        brand: product.brand,
        images: product.images ?? [],
        createdByUserId: product.createdByUserId,
        weightKg: toDecimal(product.weightKg),
        weightLbs: toDecimal(product.weightLbs),
        lengthCm: toDecimal(product.lengthCm),
        widthCm: toDecimal(product.widthCm),
        heightCm: toDecimal(product.heightCm),
        lengthIn: toDecimal(product.lengthIn),
        widthIn: toDecimal(product.widthIn),
        heightIn: toDecimal(product.heightIn),
        averageRating: toDecimal(product.averageRating),
        ratingCount: product.ratingCount ?? 0,
      },
      update: {
        name: product.name,
        description: product.description,
        price: toDecimal(product.price)!,
        stockQuantity: product.stockQuantity ?? 0,
        brand: product.brand,
        images: product.images ?? [],
        weightKg: toDecimal(product.weightKg),
        weightLbs: toDecimal(product.weightLbs),
        lengthCm: toDecimal(product.lengthCm),
        widthCm: toDecimal(product.widthCm),
        heightCm: toDecimal(product.heightCm),
        lengthIn: toDecimal(product.lengthIn),
        widthIn: toDecimal(product.widthIn),
        heightIn: toDecimal(product.heightIn),
        averageRating: toDecimal(product.averageRating),
        ratingCount: product.ratingCount ?? 0,
      },
    });
  }
  console.log(`Seeded ${data.products.length} product(s).`);

  for (const pc of data.productCategories) {
    await prisma.productCategory.upsert({
      where: {
        productId_categoryId: { productId: pc.productId, categoryId: pc.categoryId },
      },
      create: { productId: pc.productId, categoryId: pc.categoryId },
      update: {},
    });
  }

  for (const r of data.productRatings) {
    await prisma.productRating.upsert({
      where: { id: r.id },
      create: { id: r.id, userId: r.userId, productId: r.productId, score: r.score },
      update: { score: r.score },
    });
  }
  console.log(`Seeded ${data.productRatings.length} rating(s).`);

  if (fs.existsSync(SEED_UPLOADS_DIR)) {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const files = fs.readdirSync(SEED_UPLOADS_DIR);
    for (const f of files) {
      const src = path.join(SEED_UPLOADS_DIR, f);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(UPLOADS_DIR, f));
      }
    }
    console.log(`Copied ${files.length} image(s) to uploads/`);
  }

  console.log('Seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
