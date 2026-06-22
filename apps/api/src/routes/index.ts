/**
 * API router — mounts MDM + USR + INF resource routers under /api/v1/*.
 *
 * MDM: clusters, locations, departments, uoms, products, product-uoms, vendors,
 *      categories, enablements, company.
 * USR: users, permissions, permission-overrides.
 * INF (Phase 4 Epic 3 Arc a): approvals, notifications, audit, issues, broadcasts.
 * INV (Phase 4 Epic 4 Arc a W1): stock (available, expiring, movements).
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
import { usersRouter } from './users.js';
import { permissionsRouter } from './permissions.js';
import { permissionOverridesRouter } from './permission-overrides.js';
import { approvalsRouter } from './approvals.js';
import { notificationsRouter } from './notifications.js';
import { auditRouter } from './audit.js';
import { issuesRouter } from './issues.js';
import { broadcastsRouter } from './broadcasts.js';
import { stockRouter } from './stock.js';
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
apiRouter.use('/users', usersRouter);
apiRouter.use('/permissions', permissionsRouter);
apiRouter.use('/permission-overrides', permissionOverridesRouter);
apiRouter.use('/approvals', approvalsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/issues', issuesRouter);
apiRouter.use('/broadcasts', broadcastsRouter);
apiRouter.use('/stock', stockRouter);

// Ping — verifies auth + tenant binding
apiRouter.get('/ping', (req: Request, res: Response) => {
  res.json({ ok: true, brandId: req.user?.brandId });
});
