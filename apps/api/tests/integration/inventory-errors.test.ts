/**
 * Unit tests for inventory-domain business-rule error classes.
 *
 * Covers:
 *  - InsufficientStockError  — HTTP 422, code 'business.insufficient_stock'
 *  - FlowDirectionError      — HTTP 422, code 'business.flow_direction_violation'
 *  - ClusterBoundaryError    — HTTP 422, code 'business.cluster_boundary_violation'
 *
 * No DB connection required — these are pure class tests.
 */

import { describe, it, expect } from 'vitest';
import {
  InsufficientStockError,
  FlowDirectionError,
  ClusterBoundaryError,
} from '../../src/errors/business-rule-error.js';

describe('InsufficientStockError', () => {
  it('has httpStatus 422', () => {
    const err = new InsufficientStockError({
      itemId: 'abc',
      departmentId: 'dept-1',
      requested: 10,
      available: 3,
    });
    expect(err.httpStatus).toBe(422);
  });

  it("has code starting with 'business.'", () => {
    const err = new InsufficientStockError({
      itemId: 'abc',
      departmentId: 'dept-1',
      requested: 10,
      available: 3,
    });
    expect(err.code).toMatch(/^business\./);
  });

  it('message contains itemId', () => {
    const err = new InsufficientStockError({
      itemId: 'abc',
      departmentId: 'dept-1',
      requested: 10,
      available: 3,
    });
    expect(err.message).toContain('abc');
  });
});

describe('FlowDirectionError', () => {
  it('has httpStatus 422', () => {
    const err = new FlowDirectionError({ from: 'A', to: 'B', reason: 'cross-cluster' });
    expect(err.httpStatus).toBe(422);
  });

  it("has code starting with 'business.'", () => {
    const err = new FlowDirectionError({ from: 'A', to: 'B', reason: 'cross-cluster' });
    expect(err.code).toMatch(/^business\./);
  });
});

describe('ClusterBoundaryError', () => {
  it('has httpStatus 422', () => {
    const err = new ClusterBoundaryError({ clusterId: 'c1' });
    expect(err.httpStatus).toBe(422);
  });

  it("has code starting with 'business.'", () => {
    const err = new ClusterBoundaryError({ clusterId: 'c1' });
    expect(err.code).toMatch(/^business\./);
  });
});
