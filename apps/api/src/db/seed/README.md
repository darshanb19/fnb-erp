# Brand seed (DL-024)

Idempotent bootstrap script. Required first run after migrations on any fresh deployment;
re-running is a no-op. Multi-brand creation UX is post-MVP per Master Spec §1.2.

## Usage

```
DATABASE_URL=postgresql://user@host:5432/db pnpm --filter @fnberp/api db:seed
```

## Environment overrides (all optional)

- `BRAND_LEGAL_NAME` (default `"Demo F&B Pvt Ltd"`)
- `BRAND_TRADING_NAME`
- `BRAND_COUNTRY` (default `"IN"`)

Other FR9 fields (address, banking, GSTIN, PAN) are populated via SI-MDM-007 in Arc (c).
DL-024: `companyService` has NO `createCompany` method — this seed is the only path that creates the brand row.
