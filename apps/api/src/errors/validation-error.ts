/**
 * ValidationError — HTTP 400
 *
 * Raised when a request fails structural or field-level validation.
 * Default code prefix: `validation.`
 *
 * Architecture §6.5
 */

import { AppError, type AppErrorOptions } from './base-error.js';

export class ValidationError extends AppError {
  override readonly httpStatus = 400 as const;

  constructor(options: AppErrorOptions) {
    super(options);
  }
}
