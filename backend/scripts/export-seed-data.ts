/**
 * Export current DB data to seed-data/ for reviewers.
 * Run once from backend with your .env pointing at the DB that has the products:
 *   npx tsx scripts/export-seed-data.ts
 * Creates seed-data/export.json and copies referenced upload images to seed-data/uploads/.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../src/db';

const BACKEND_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');
const SEED_DATA_DIR = path.join(BACKEND_DIR, 'seed-data');
const SEED_UPLOADS_DIR = path.join(SEED_DATA_DIR, 'uploads');

function toJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toJson(v);
    return out;
  }
  return value;
}

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(SEED_UPLOADS_DIR)) fs.mkdirSync(SEED_UPLOADS_DIR, { recursive: true });

  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true },
  });
  const categories = await prisma.category.findMany();
  const products = await prisma.product.findMany({
    include: { categories: { select: { categoryId: true } } },
  });
  const productCategories = await prisma.productCategory.findMany();
  const productRatings = await prisma.productRating.findMany();

  const exportData = {
    users: users.map((u) => ({ id: u.id, email: u.email, username: u.username })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: toJson(p.price),
      stockQuantity: p.stockQuantity,
      brand: p.brand,
      images: p.images,
      createdByUserId: p.createdByUserId,
      weightKg: toJson(p.weightKg),
      weightLbs: toJson(p.weightLbs),
      lengthCm: toJson(p.lengthCm),
      widthCm: toJson(p.widthCm),
      heightCm: toJson(p.heightCm),
      lengthIn: toJson(p.lengthIn),
      widthIn: toJson(p.widthIn),
      heightIn: toJson(p.heightIn),
      averageRating: toJson(p.averageRating),
      ratingCount: p.ratingCount,
    })),
    productCategories: productCategories.map((pc) => ({
      productId: pc.productId,
      categoryId: pc.categoryId,
    })),
    productRatings: productRatings.map((r) => ({
      id: r.id,
      userId: r.userId,
      productId: r.productId,
      score: r.score,
    })),
  };

  fs.writeFileSync(
    path.join(SEED_DATA_DIR, 'export.json'),
    JSON.stringify(exportData, null, 2),
    'utf-8'
  );
  console.log('Wrote seed-data/export.json');

  const copied = new Set<string>();
  for (const p of products) {
    for (const img of p.images || []) {
      const filename = img.split('/').pop() || img;
      if (!filename || copied.has(filename)) continue;
      const src = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(SEED_UPLOADS_DIR, filename));
        copied.add(filename);
      }
    }
  }
  console.log(`Copied ${copied.size} image(s) to seed-data/uploads/`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
