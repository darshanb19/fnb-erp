/**
 * stores router — read-only list for the brand's Brand/Cluster stores.
 * Epic 4 Arc (c) Wave 2 — DL-050 (founder-authorized scoped read endpoint to
 * back SI-INV-007 paired cross-cluster transfer store pickers). No writes.
 */
import { Router, type Router as ExpressRouter } from 'express';
import { orgService } from '../services/org.service.js';

export const storesRouter: ExpressRouter = Router();

storesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    res.json(await orgService.listStores(req.db));
  } catch (e) {
    next(e);
  }
});
