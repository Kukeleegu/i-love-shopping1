/**
 * Main Express app: middleware, static files, uploads, and all API routes.
 * Exports app and PORT for start.ts and tests.
 */
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { register } from './registration';
import { login } from './login';
import refresh from './auth/refresh';
import logout from './logout';
import { requireAuth, optionalAuth } from './auth/middleware';
import { requestPasswordReset, resetPasswordWithToken } from './auth/passwordReset';
import { prisma } from './db';
import { generateAccessToken, generateRefreshToken } from './auth/jwtAccessAndRefreshTokens';
import { hashPassword } from './auth/passwordHashing';
import { listProducts, suggestProducts, productFacets, normalizeCategoryName, recalcProductRating } from './products';
import { setup2FA, verifySetup2FA, verifyLogin2FA, disable2FA, generate2FAPendingToken } from './auth/twoFactor';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());

// Static files: frontend (HTML, CSS, JS) and uploaded product images
app.use(express.static(path.join(__dirname, '../../frontend')));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer: store product images on disk with a random UUID filename; allow only image types, max 6MB
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const safe = /^\.(jpe?g|png|gif|webp)$/.test(ext) ? ext : '.jpg';
      cb(null, `${crypto.randomUUID()}${safe}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, allowed);
  },
});

// Health check endpoint to verify the server is running
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running!' });
});

// CORS: allow any origin and common methods/headers (for dev and cross-origin frontends)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Multer/upload error handler (file size, type, field name)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'code' in err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 6MB)' });
  }
  if (err && typeof err === 'object' && 'code' in err && err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Too many files (max 10)' });
  }
  if (err && typeof err === 'object' && 'code' in err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Use field name "images" for file uploads' });
  }
  console.error('Upload or server error:', err);
  return res.status(500).json({ error: 'Upload failed' });
});

// --- Auth: registration, login, refresh, logout ---
app.post('/api/auth/register', async (req, res) => {

  const { email, password, username, captchaToken } = req.body;

  const result = await register(email, password, username ?? '', captchaToken);
  
  // If there was an error during registration, send a 400 error response
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }
  // If successful, send back the new user data with a 201 status
  return res.status(201).json({ user: result });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await login(email, password);

  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }
  if ('requires2FA' in result) {
    return res.status(200).json({ requires2FA: true, tempToken: result.tempToken });
  }
  return res.status(200).json({ user: result });
});

app.post('/api/auth/refresh', async (req, res) => {
  await refresh(req, res);
});

app.post('/api/auth/logout', async (req, res) => {
  await logout(req, res);
});

// --- 2FA: setup, verify setup, verify at login, disable ---
app.post('/api/auth/2fa/setup', requireAuth, setup2FA);
app.post('/api/auth/2fa/verify-setup', requireAuth, verifySetup2FA);
app.post('/api/auth/2fa/verify-login', verifyLogin2FA);
app.post('/api/auth/2fa/disable', requireAuth, disable2FA);

// --- Current user & upload ---
app.get('/api/users/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, tfaEnabled: true },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ userId: user.id, tfaEnabled: user.tfaEnabled ?? false });
});

app.post('/api/upload', requireAuth, upload.array('images', 10), (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No image files sent. Use field name "images".' });
  }
  const baseUrl = ''; // relative URLs work from same origin
  const urls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);
  return res.json({ urls });
});

// --- Password reset (forgot-password email, reset with token) ---
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const result = await requestPasswordReset(email);
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }
  return res.status(200).json({ message: 'Email successfully sent to ' + email });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await resetPasswordWithToken(token, newPassword);
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }
  return res.status(200).json({ message: 'Password has been reset. You can now log in.' });
});

// --- Google OAuth: URL for redirect, callback exchanges code for tokens and issues our JWTs ---
app.get('/api/auth/oauth/google/url', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  console.log('[Google OAuth] redirect_uri we send:', redirectUri);

  const scope = encodeURIComponent('openid email profile');
  const state = 'state123'; // TODO: random + validate in real app

  const url =
    'https://accounts.google.com/o/oauth2/v2/auth' +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    '&response_type=code' +
    `&scope=${scope}` +
    '&access_type=offline' +
    '&prompt=consent' +
    `&state=${state}`;

  return res.json({ url });
});

app.get('/api/auth/oauth/google/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!code) return res.status(400).json({ error: 'Missing code' });
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  try {
    // 1) Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenRes.ok) {
      return res.status(400).json({ error: 'Failed to get tokens from Google', details: tokenJson });
    }

    const googleAccessToken = tokenJson.access_token;
    if (!googleAccessToken) {
      return res.status(400).json({ error: 'Google did not return an access token', details: tokenJson });
    }

    // 2) Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${googleAccessToken}` },
    });
    interface GoogleUserInfo {
      email?: string;
      name?: string;
    }
    const userInfo = (await userInfoRes.json()) as GoogleUserInfo;
    if (!userInfoRes.ok) {
      return res.status(400).json({ error: 'Failed to fetch Google user info', details: userInfo });
    }

    const email = userInfo.email;
    const name = userInfo.name || '';
    if (!email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }

    // 3) Find or create local user
    let user = await prisma.user.findUnique({ where: { email }, select: { id: true, tfaEnabled: true } });
    if (!user) {
      const randomPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));
      const username = name || email.split('@')[0] || 'google-user';
      user = await prisma.user.create({
        data: { email, username, password: randomPassword },
        select: { id: true, tfaEnabled: true },
      });
    }

    const successRedirect = process.env.OAUTH_SUCCESS_REDIRECT_URL || 'http://localhost:3000/test.html';

    if (user.tfaEnabled) {
      const tempToken = generate2FAPendingToken(user.id);
      const redirectUrl = successRedirect + `#requires2FA=1&tempToken=${encodeURIComponent(tempToken)}`;
      return res.redirect(302, redirectUrl);
    }

    // 4) Issue our JWT access + refresh tokens
    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    if ('error' in accessToken || 'error' in refreshToken) {
      return res.status(500).json({ error: 'Failed to generate tokens' });
    }

    const redirectUrl =
      successRedirect +
      `#google=1&accessToken=${encodeURIComponent(accessToken.accessToken)}&refreshToken=${encodeURIComponent(
        refreshToken.refreshToken
      )}`;

    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.status(500).json({ error: 'Google OAuth failed' });
  }
});

// --- Products: list (search/filters/sort), suggest, facets, CRUD ---
app.get('/api/products/suggest', suggestProducts);
app.get('/api/products/facets', productFacets);
app.get('/api/products', optionalAuth, listProducts);

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!userExists) {
      return res.status(401).json({
        error: 'User not found. The account may have been removed or you are using a different database. Please log in again.',
      });
    }

    const {
      name,
      description,
      price,
      stockQuantity,
      brand,
      images,
      categoryName,
      weightKg,
      weightLbs,
      lengthCm,
      widthCm,
      heightCm,
      lengthIn,
      widthIn,
      heightIn,
    } = req.body as {
      name: string;
      description?: string;
      price: string;
      stockQuantity?: number;
      brand: string;
      images?: string[];
      categoryName: string;
      weightKg?: string;
      weightLbs?: string;
      lengthCm?: string;
      widthCm?: string;
      heightCm?: string;
      lengthIn?: string;
      widthIn?: string;
      heightIn?: string;
    };

    if (!name || !price || !brand || !categoryName) {
      return res.status(400).json({ error: 'name, price, brand, and categoryName are required' });
    }

    const stock = typeof stockQuantity === 'number' && !Number.isNaN(stockQuantity) ? stockQuantity : 0;

    // Strip commas (and spaces) so "3,300,000" and "1,390" parse correctly
    const toDecimalStr = (s: string | number) => String(s ?? '').replace(/,/g, '').trim();
    const decimalOrNull = (val?: string | number) =>
      val !== undefined && val !== null && toDecimalStr(val) ? new Prisma.Decimal(toDecimalStr(val)) : null;

    const categoryNameNorm = normalizeCategoryName(categoryName);
    let category = await prisma.category.findFirst({
      where: { name: { equals: categoryNameNorm, mode: 'insensitive' } },
    });
    if (!category) {
      category = await prisma.category.create({ data: { name: categoryNameNorm } });
    }

    const priceStr = toDecimalStr(price);
    if (!priceStr || Number.isNaN(Number(priceStr)) || Number(priceStr) < 0) {
      return res.status(400).json({ error: 'Invalid price' });
    }

    const created = await prisma.product.create({
      data: {
        name,
        description: description || null,
        price: new Prisma.Decimal(priceStr),
        stockQuantity: stock,
        brand,
        images: images && Array.isArray(images) ? images : [],
        averageRating: null,
        ratingCount: 0,
        weightKg: decimalOrNull(weightKg),
        weightLbs: decimalOrNull(weightLbs),
        lengthCm: decimalOrNull(lengthCm),
        widthCm: decimalOrNull(widthCm),
        heightCm: decimalOrNull(heightCm),
        lengthIn: decimalOrNull(lengthIn),
        widthIn: decimalOrNull(widthIn),
        heightIn: decimalOrNull(heightIn),
        createdByUserId: userId,
        categories: {
          create: [{ categoryId: category.id }],
        },
      },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    return res.status(201).json({ product: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error creating product:', err);
    return res.status(500).json({ error: 'Failed to create product', details: message });
  }
});

app.patch('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const productId = typeof req.params.id === 'string' ? req.params.id : (req.params.id as string[])?.[0] ?? '';
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { categories: { include: { category: true } } },
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (product.createdByUserId !== req.user!.userId) {
      return res.status(403).json({ error: 'Only the user who created this product can edit it' });
    }

    const {
      name,
      description,
      price,
      stockQuantity,
      brand,
      images,
      categoryName,
      weightKg,
      weightLbs,
      lengthCm,
      widthCm,
      heightCm,
      lengthIn,
      widthIn,
      heightIn,
    } = req.body as {
      name?: string;
      description?: string;
      price?: string;
      stockQuantity?: number;
      brand?: string;
      images?: string[];
      categoryName?: string;
      weightKg?: string;
      weightLbs?: string;
      lengthCm?: string;
      widthCm?: string;
      heightCm?: string;
      lengthIn?: string;
      widthIn?: string;
      heightIn?: string;
    };

    const toDecimalStr = (s: string) => s.replace(/,/g, '').trim();
    const decimalOrNull = (val?: string) =>
      val && toDecimalStr(val) ? new Prisma.Decimal(toDecimalStr(val)) : null;

    const data: Parameters<typeof prisma.product.update>[0]['data'] = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;
    if (price !== undefined) data.price = new Prisma.Decimal(toDecimalStr(String(price)));
    if (stockQuantity !== undefined) data.stockQuantity = typeof stockQuantity === 'number' && !Number.isNaN(stockQuantity) ? stockQuantity : product.stockQuantity;
    if (brand !== undefined) data.brand = brand;
    if (images !== undefined) data.images = Array.isArray(images) ? images : product.images;
    if (weightKg !== undefined) data.weightKg = decimalOrNull(weightKg);
    if (weightLbs !== undefined) data.weightLbs = decimalOrNull(weightLbs);
    if (lengthCm !== undefined) data.lengthCm = decimalOrNull(lengthCm);
    if (widthCm !== undefined) data.widthCm = decimalOrNull(widthCm);
    if (heightCm !== undefined) data.heightCm = decimalOrNull(heightCm);
    if (lengthIn !== undefined) data.lengthIn = decimalOrNull(lengthIn);
    if (widthIn !== undefined) data.widthIn = decimalOrNull(widthIn);
    if (heightIn !== undefined) data.heightIn = decimalOrNull(heightIn);

    if (categoryName !== undefined && categoryName !== null && categoryName !== '') {
      const categoryNameNorm = normalizeCategoryName(categoryName);
      let category = await prisma.category.findFirst({
        where: { name: { equals: categoryNameNorm, mode: 'insensitive' } },
      });
      if (!category) {
        category = await prisma.category.create({ data: { name: categoryNameNorm } });
      }
      await prisma.productCategory.deleteMany({ where: { productId } });
      data.categories = { create: [{ categoryId: category.id }] };
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data,
      include: {
        categories: { include: { category: true } },
      },
    });
    return res.json({ product: updated });
  } catch (err) {
    console.error('Error updating product:', err);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const productId = typeof req.params.id === 'string' ? req.params.id : (req.params.id as string[])?.[0] ?? '';
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (product.createdByUserId !== req.user!.userId) {
      return res.status(403).json({ error: 'Only the user who created this product can delete it' });
    }
    await prisma.productCategory.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    return res.status(204).send();
  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Rate product (1–5). One rating per user per product; upsert (change) or remove.
app.post('/api/products/:id/rate', requireAuth, async (req, res) => {
  try {
    const productId = typeof req.params.id === 'string' ? req.params.id : (req.params.id as string[])?.[0] ?? '';
    const score = typeof req.body?.score === 'number' ? req.body.score : parseInt(String(req.body?.score ?? ''), 10);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return res.status(400).json({ error: 'score must be an integer from 1 to 5' });
    }
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const userId = req.user!.userId;
    await prisma.productRating.upsert({
      where: {
        userId_productId: { userId, productId },
      },
      create: { userId, productId, score },
      update: { score },
    });
    await recalcProductRating(productId);
    const updated = await prisma.product.findUnique({ where: { id: productId }, select: { averageRating: true, ratingCount: true } });
    const avg = updated?.averageRating != null ? Number(updated.averageRating) : null;
    const count = updated?.ratingCount ?? 0;
    return res.json({ averageRating: avg, ratingCount: count });
  } catch (err) {
    console.error('Error rating product:', err);
    return res.status(500).json({ error: 'Failed to rate product' });
  }
});

app.delete('/api/products/:id/rate', requireAuth, async (req, res) => {
  try {
    const productId = typeof req.params.id === 'string' ? req.params.id : (req.params.id as string[])?.[0] ?? '';
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const userId = req.user!.userId;
    await prisma.productRating.deleteMany({ where: { userId, productId } });
    await recalcProductRating(productId);
    const updated = await prisma.product.findUnique({ where: { id: productId }, select: { averageRating: true, ratingCount: true } });
    const avg = updated?.averageRating != null ? Number(updated.averageRating) : null;
    const count = updated?.ratingCount ?? 0;
    return res.json({ averageRating: avg, ratingCount: count });
  } catch (err) {
    console.error('Error removing rating:', err);
    return res.status(500).json({ error: 'Failed to remove rating' });
  }
});

// Ensure API errors always return JSON (e.g. uncaught errors in async route handlers)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

export { app, PORT };