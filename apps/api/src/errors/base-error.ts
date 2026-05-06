/**
 * Abstract base for all application errors.
 *
 * Architecture §6.5 — Error subclasses:
 * Every error carries code, message, optional details, httpStatus, and toEnvelope().
 * Subclasses set httpStatus; callers set code + message at throw site.
 *
 * toEnvelope() returns the wire shape per Master Spec §7.5:
 *   { code, message, details?, timestamp }
 */

export interface ErrorEnvelope {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface AppErrorOptions {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export abstract class AppError extends Error {
  abstract readonly httpStatus: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor({ code, message, details }: AppErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toEnvelope(): ErrorEnvelope {
    const envelope: ErrorEnvelope = {
      code: this.code,
      message: this.message,
      timestamp: new Date().toISOString(),
    };
    if (this.details !== undefined) {
      envelope.details = this.details;
    }
    return envelope;
  }
}
