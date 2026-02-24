# Backend scripts and tests

## Tests

Run all tests from the backend root:

```bash
npm test
```

Watch mode (re-run on file changes):

```bash
npm run test:watch
```

### Test files

| File | Description |
|------|-------------|
| `unit-jwt.test.ts` | JWT: token generation, payload, expiry, invalid signature |
| `unit-products.test.ts` | Product helpers: `normalizeCategoryName`, `parseProductListQuery`, `buildProductWhere` |
| `api-health.test.ts` | Health check; product list/suggest/facets (200 when DB up, 500 when down) |
| `api-auth.test.ts` | Login validation; `/api/users/me` requires auth / rejects invalid token |
| `security-validation.test.ts` | Invalid JSON body; POST/PATCH/DELETE products require auth (401) |

### Database

Unit tests and auth/security tests do not require a running database. Product API tests (`GET /api/products`, suggest, facets) return **200** when the database is available and **500** when it is not, so tests pass in both cases.

For full integration (e.g. real login, product list with data), start PostgreSQL and set `DATABASE_URL` in `.env`, then run `npm test`.

## Other scripts

- `test-acid.ts` – ACID transaction demo (run with DB): `npx tsx scripts/test-acid.ts`
- `delete-lamborghini.ts` – One-off: delete products by brand "lamborghini": `npx tsx scripts/delete-lamborghini.ts`
