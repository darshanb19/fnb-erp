import { pgTable, uuid, text, smallint, timestamp } from 'drizzle-orm/pg-core';

/**
 * brands — system table (NOT brandScopedTable; it IS the brand reference anchor).
 * FR9 fields + DL-024 single-brand bootstrap status.
 */
export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identity
  legalName: text('legal_name').notNull(),
  tradingName: text('trading_name'),

  // Address
  registeredAddress: text('registered_address'),
  city: text('city'),
  postalCode: text('postal_code'),
  state: text('state'),
  country: text('country').default('IN'),

  // Tax IDs — placeholder per Master Spec §6.5
  gstin: text('gstin'),                           // [PLACEHOLDER]
  pan: text('pan'),                               // [PLACEHOLDER]

  // Contact
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),

  // Banking
  bankAccountNumber: text('bank_account_number'),
  bankIfsc: text('bank_ifsc'),
  bankAccountHolder: text('bank_account_holder'),

  // Fiscal
  fiscalYearStartMonth: smallint('fiscal_year_start_month').notNull().default(4), // April
  fiscalYearStartDay: smallint('fiscal_year_start_day').notNull().default(1),
  accountingCurrency: text('accounting_currency').notNull().default('INR'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),

  // Logo
  logoUrl: text('logo_url'),

  // Status — DL-024 one-way transition
  status: text('status').notNull().default('setup_pending'),  // 'setup_pending' | 'setup_complete'

  // Standard audit columns
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),  // nullable FK to users.id — seed rows allowed
  updatedBy: uuid('updated_by'),
});

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
