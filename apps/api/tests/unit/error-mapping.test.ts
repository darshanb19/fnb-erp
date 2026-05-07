/**
 * Unit tests: error class hierarchy and toEnvelope() shape
 *
 * Does NOT require a running Express server or database connection.
 * Exercises architecture §6.5 error contracts.
 */

import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ScopeMutationError,
  ParentRelinkAttemptError,
  EnablementViolationError,
} from '../../src/errors/index.js';

describe('ValidationError', () => {
  it('has httpStatus 400', () => {
    const err = new ValidationError({ code: 'validation.field_required', message: 'name is required' });
    expect(err.httpStatus).toBe(400);
  });

  it('toEnvelope() returns expected shape with details', () => {
    const err = new ValidationError({
      code: 'validation.field_required',
      message: 'name is required',
      details: { field: 'name' },
    });
    const envelope = err.toEnvelope();
    expect(envelope.code).toBe('validation.field_required');
    expect(envelope.message).toBe('name is required');
    expect(envelope.details).toEqual({ field: 'name' });
    expect(typeof envelope.timestamp).toBe('string');
    expect(new Date(envelope.timestamp).toISOString()).toBe(envelope.timestamp);
  });

  it('toEnvelope() omits details when not supplied', () => {
    const err = new ValidationError({ code: 'validation.malformed_body', message: 'Bad JSON' });
    const envelope = err.toEnvelope();
    expect('details' in envelope).toBe(false);
  });
});

describe('NotFoundError', () => {
  it('has httpStatus 404', () => {
    const err = new NotFoundError({ code: 'not_found.product', message: 'Product not found' });
    expect(err.httpStatus).toBe(404);
  });

  it('toEnvelope() returns correct code', () => {
    const err = new NotFoundError({ code: 'not_found.org', message: 'Org not found' });
    expect(err.toEnvelope().code).toBe('not_found.org');
  });
});

describe('AuthorizationError', () => {
  it('defaults to httpStatus 403', () => {
    const err = new AuthorizationError({ code: 'auth.brand_id_missing', message: 'No brand' });
    expect(err.httpStatus).toBe(403);
  });

  it('can be set to 401 for token errors', () => {
    const err = new AuthorizationError({
      code: 'auth.token_missing',
      message: 'No token',
      httpStatus: 401,
    });
    expect(err.httpStatus).toBe(401);
  });
});

describe('ScopeMutationError', () => {
  it('has httpStatus 422', () => {
    const err = new ScopeMutationError({
      code: 'vendor.scope_narrow_blocked',
      message: 'Cannot narrow scope',
    });
    expect(err.httpStatus).toBe(422);
  });

  it('toEnvelope() contains the supplied code', () => {
    const err = new ScopeMutationError({ code: 'vendor.scope_narrow_blocked', message: '...' });
    expect(err.toEnvelope().code).toBe('vendor.scope_narrow_blocked');
  });
});

describe('ParentRelinkAttemptError', () => {
  it('has httpStatus 422', () => {
    const err = new ParentRelinkAttemptError('clusterId');
    expect(err.httpStatus).toBe(422);
  });

  it('toEnvelope().code === "org.parent_relink_blocked"', () => {
    const err = new ParentRelinkAttemptError('clusterId');
    expect(err.toEnvelope().code).toBe('org.parent_relink_blocked');
  });

  it('message contains the locked key name', () => {
    const err = new ParentRelinkAttemptError('clusterId');
    expect(err.message).toContain('clusterId');
    expect(err.message).toContain('DL-022');
  });

  it('details contain lockedKey', () => {
    const err = new ParentRelinkAttemptError('regionId');
    expect(err.toEnvelope().details).toEqual({ lockedKey: 'regionId' });
  });
});

describe('EnablementViolationError', () => {
  it('has httpStatus 422', () => {
    const err = new EnablementViolationError({
      code: 'inventory.enablement_violation',
      message: 'Item not enabled at location',
    });
    expect(err.httpStatus).toBe(422);
  });
});

describe('instanceof checks', () => {
  it('ValidationError is an Error', () => {
    const err = new ValidationError({ code: 'validation.x', message: 'x' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('ParentRelinkAttemptError is instanceof ScopeMutationError? no — they are siblings', () => {
    const err = new ParentRelinkAttemptError('clusterId');
    expect(err).not.toBeInstanceOf(ScopeMutationError);
  });
});
