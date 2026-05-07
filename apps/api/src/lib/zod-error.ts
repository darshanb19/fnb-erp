/**
 * zod-error — converts a ZodError into a typed ValidationError.
 *
 * Used in route handlers to produce consistent { code, message, details, timestamp }
 * envelopes for Zod parse failures (architecture §17.5).
 */

import { ZodError } from 'zod';
import { ValidationError } from '../errors/index.js';

export function toValidationError(err: ZodError): ValidationError {
  if (err.errors.length === 1) {
    const e = err.errors[0];
    if (!e) {
      return new ValidationError({
        code: 'validation.unknown',
        message: 'Validation failed',
      });
    }
    return new ValidationError({
      code: `validation.${e.code}`,
      message: e.message,
      details: { field: e.path.join('.'), zod: e },
    });
  }
  return new ValidationError({
    code: 'validation.multiple_field_errors',
    message: 'Multiple field validation errors',
    details: { fieldErrors: err.flatten().fieldErrors },
  });
}
