/**
 * API router — mounts all 10 MDM resource routers under /api/v1/*.
 *
 * Mounted in apps/api/src/index.ts after auth + branded-db + audit-context middleware.
 * Each sub-router operates on req.db (BrandedDb) and req.user.
 */

import { Router, type Router as ExpressRouter } from 'express';
import { clustersRouter } from './clusters.js';
import { locationsRouter } from './locations.js';
import { departmentsRouter } from './departments.js';
import { uomsRouter } from './uoms.js';
import { productsRouter } from './products.js';
import { productUomsRouter } from './product-uoms.js';
import { vendorsRouter } from './vendors.js';
import { categoriesRouter } from './categories.js';
import { enablementsRouter } from './enablements.js';
import { companyRouter } from './company.js';
import type { Request, Response } from 'express';

export const apiRouter: ExpressRouter = Router();

apiRouter.use('/clusters', clustersRouter);
apiRouter.use('/locations', locationsRouter);
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/uoms', uomsRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/product-uoms', productUomsRouter);
apiRouter.use('/vendors', vendorsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/enablements', enablementsRouter);
apiRouter.use('/company', companyRouter);

// Ping — verifies auth + tenant binding
apiRouter.get('/ping', (req: Request, res: Response) => {
  res.json({ ok: true, brandId: req.user?.brandId });
});
