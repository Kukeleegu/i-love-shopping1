/**
 * Product API: list (with search, filters, sort) and suggest/autocomplete.
 * All logic lives here; server.ts only wires routes.
 */

import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from './db';

export interface ProductListQuery {
  q?: string;
  minPrice?: string;
  maxPrice?: string;
  brand?: string;
  category?: string;
  categoryIds?: string[];
  sort?: string;
}

/** Normalize category name so "Super Car", "supercar", "super car" all become "Supercar". */
export function normalizeCategoryName(s: string): string {
  const trimmed = (s || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const words = trimmed.toLowerCase().split(' ').filter(Boolean);
  const joined = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return joined.charAt(0).toUpperCase() + joined.slice(1).toLowerCase();
}

export function parseProductListQuery(req: Request): ProductListQuery {
  const q = (req.query.q as string)?.trim() || undefined;
  const minPrice = (req.query.minPrice as string)?.trim() || undefined;
  const maxPrice = (req.query.maxPrice as string)?.trim() || undefined;
  const brand = (req.query.brand as string)?.trim() || undefined;
  const category = (req.query.category as string)?.trim() || undefined;
  const sort = (req.query.sort as string)?.trim() || undefined;
  return { q, minPrice, maxPrice, brand, category, sort };
}

export function buildProductWhere(params: ProductListQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (params.q) {
    and.push({
      OR: [
        { name: { contains: params.q, mode: 'insensitive' } },
        { description: { contains: params.q, mode: 'insensitive' } },
        { brand: { contains: params.q, mode: 'insensitive' } },
      ],
    });
  }
  if (params.brand) {
    and.push({ brand: { equals: params.brand, mode: 'insensitive' } });
  }
  if (params.category) {
    and.push({
      categories: {
        some: {
          categoryId: { in: params.categoryIds ?? [] },
        },
      },
    });
  }
  const minP = params.minPrice != null && params.minPrice !== '' ? parseFloat(params.minPrice) : NaN;
  const maxP = params.maxPrice != null && params.maxPrice !== '' ? parseFloat(params.maxPrice) : NaN;
  if (!Number.isNaN(minP) || !Number.isNaN(maxP)) {
    and.push({
      price: {
        ...(!Number.isNaN(minP) && { gte: new Prisma.Decimal(minP) }),
        ...(!Number.isNaN(maxP) && { lte: new Prisma.Decimal(maxP) }),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildProductOrderBy(params: ProductListQuery): Prisma.ProductOrderByWithRelationInput[] {
  const sort = (params.sort || '').toLowerCase();
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }];
    case 'name_asc':
      return [{ name: 'asc' }];
    case 'name_desc':
      return [{ name: 'desc' }];
    case 'rating_desc':
      return [{ averageRating: 'desc' }, { ratingCount: 'desc' }];
    case 'rating_asc':
      return [{ averageRating: 'asc' }, { ratingCount: 'asc' }];
    case 'relevance':
      return params.q ? [{ name: 'asc' }] : [{ createdAt: 'desc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
}

export function shapeProduct(p: {
  id: string;
  name: string;
  description: string | null;
  price: Prisma.Decimal;
  stockQuantity: number;
  brand: string;
  images: string[];
  createdByUserId: string | null;
  averageRating?: Prisma.Decimal | null;
  ratingCount?: number;
  weightKg: Prisma.Decimal | null;
  weightLbs: Prisma.Decimal | null;
  lengthCm: Prisma.Decimal | null;
  widthCm: Prisma.Decimal | null;
  heightCm: Prisma.Decimal | null;
  lengthIn: Prisma.Decimal | null;
  widthIn: Prisma.Decimal | null;
  heightIn: Prisma.Decimal | null;
  categories: { category: { id: string; name: string } }[];
}) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    stockQuantity: p.stockQuantity,
    brand: p.brand,
    images: p.images,
    categories: p.categories.map((pc) => ({ id: pc.category.id, name: pc.category.name })),
    averageRating: p.averageRating ?? null,
    ratingCount: p.ratingCount ?? 0,
    weightKg: p.weightKg,
    weightLbs: p.weightLbs,
    lengthCm: p.lengthCm,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
    lengthIn: p.lengthIn,
    widthIn: p.widthIn,
    heightIn: p.heightIn,
    createdByUserId: p.createdByUserId ?? undefined,
  };
}

/** Recalculate and update product.averageRating and product.ratingCount from ProductRating rows. */
export async function recalcProductRating(productId: string): Promise<void> {
  const agg = await prisma.productRating.aggregate({
    where: { productId },
    _count: true,
    _avg: { score: true },
  });
  const ratingCount = agg._count;
  const averageRating =
    ratingCount > 0 && agg._avg?.score != null
      ? new Prisma.Decimal(Number(agg._avg.score.toFixed(2)))
      : null;
  await prisma.product.update({
    where: { id: productId },
    data: { ratingCount, averageRating },
  });
}

/** GET /api/products — list with optional search (q), filters (minPrice, maxPrice, brand, category), sort. */
export async function listProducts(req: Request, res: Response): Promise<void> {
  try {
    let params = parseProductListQuery(req);
    if (params.category) {
      const norm = normalizeCategoryName(params.category);
      const categories = await prisma.category.findMany({
        where: { products: { some: {} } },
        select: { id: true, name: true },
      });
      const ids = categories.filter((c) => normalizeCategoryName(c.name) === norm).map((c) => c.id);
      params = { ...params, categoryIds: ids };
    }
    const where = buildProductWhere(params);
    const orderBy = buildProductOrderBy(params);

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    let shaped = products.map((p) => shapeProduct(p)) as ReturnType<typeof shapeProduct>[] & { myRating?: number }[];
    const userId = (req as { user?: { userId: string } }).user?.userId;
    if (userId && shaped.length > 0) {
      const productIds = shaped.map((s) => s.id);
      const myRatings = await prisma.productRating.findMany({
        where: { userId, productId: { in: productIds } },
        select: { productId: true, score: true },
      });
      const byProduct = new Map(myRatings.map((r) => [r.productId, r.score]));
      shaped = shaped.map((s) => ({ ...s, myRating: byProduct.get(s.id) ?? undefined }));
    }
    res.json({ products: shaped });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

/** GET /api/products/facets — distinct brands and category names for filter UIs. */
export async function productFacets(req: Request, res: Response): Promise<void> {
  try {
    const [brandRows, categoryRows] = await Promise.all([
      prisma.product.findMany({ select: { brand: true }, distinct: ['brand'], orderBy: { brand: 'asc' } }),
      prisma.category.findMany({
        where: { products: { some: {} } },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const categoryNames = categoryRows.map((r) => r.name);
    const normalizedUnique = [...new Set(categoryNames.map((name) => normalizeCategoryName(name)))].filter(Boolean).sort();
    res.json({
      brands: brandRows.map((r) => r.brand),
      categories: normalizedUnique,
    });
  } catch (err) {
    console.error('Error fetching facets:', err);
    res.status(500).json({ error: 'Failed to fetch facets' });
  }
}

/** GET /api/products/suggest — autocomplete suggestions by name/description/brand, max 10. */
export async function suggestProducts(req: Request, res: Response): Promise<void> {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length === 0) {
      res.json({ suggestions: [] });
      return;
    }

    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
      take: 10,
      orderBy: { name: 'asc' },
    });

    res.json({
      suggestions: products.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    console.error('Error fetching suggestions:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
}
