# Token-enforcement hook test cases

These cases are exercised by `run-tests.sh`. Each fixture is fed to
`check-rules.sh --stdin <fake-path>`; allow-cases must exit 0, ban-cases must
exit non-zero. The fake path determines whether the file is treated as
`tokens.ts` (rule-1 exempt) or as a regular in-scope file.

## Allow (commit succeeds)

- allow:  `className="border-l-4 border-tertiary"`        — 4-px left pip per §6.1
- allow:  `className="border-l-2 border-error"`           — narrow pip
- allow:  `className="focus:border focus:border-primary"` — focus ring per §9.3
- allow:  `className="aria-invalid:border aria-invalid:border-error"` — error ring per §9.3
- allow:  `className="focus-visible:border-2 focus-visible:border-primary"` — paired focus-visible
- allow:  `className="status_pending_approval"`           — canonical status
- allow:  hex literals only inside `mockups/src/tokens.ts`

## Ban (commit fails)

- ban:    `className="border border-outline_variant"`     — sectioning border
- ban:    `className="border-t border-outline_variant"`   — top divider
- ban:    `className="divide-y divide-outline_variant"`   — sibling divider
- ban:    `className="border-2 border-outline"`           — heavy outline, not a focus ring

### Hex literal

- ban:    `style={{ color: '#3f484a' }}` outside tokens.ts — use text-on-surface-variant
- allow:  same hex literal inside `mockups/src/tokens.ts`

### Material symbols

- ban:    `import { Check } from '@material-symbols/svg'`
- ban:    `<span className="material-symbols-outlined">check</span>`

### Separator

- ban:    `import { Separator } from '@/components/ui/separator'`
- allow:  `<SectionShift />` from `src/shell/`

### Invented status

- ban:    `className="status_pending_revision"`           — not in canonical 20
- allow:  `className="status_pending_approval"`

### Invented tokens

- ban:    `className="font-body"` / `font-display` / `border-default` / `space-md` / `space-lg`

### Inline font-family

- ban:    `style={{ fontFamily: 'Helvetica' }}` (note: detected via the literal `font-family:` in CSS strings)
- allow:  `style="font-family: Inter, sans-serif"`

## Documented choice — rule 7 (tenant_brand_accent in status proximity)

The plan calls for banning `tenant_brand_accent` used in any state/status
context (DESIGN.md §3 — accent is decorative-only, never status). Because
proximity detection across multiple lines can't be done reliably without an
AST parser, the hook implements a non-blocking **WARNING** when the literal
`tenant_brand_accent` (or `tenant-brand-accent`) appears on the same line as
the literal `status` or `state`. This catches the common abuse pattern (e.g.
`<StatusPill className="bg-tenant-brand-accent">`) while avoiding false
positives on legitimate decorative usage and on the token export itself in
`tokens.ts`. If a stricter check is needed later, replace the warning with a
hard error in `check-rules.sh` rule 7.

## Out of scope (hook does NOT fire)

The hook explicitly skips:

- `mockups/src/components/ui/` — shadcn primitives (neutralized via globals.css aliases per plan §13 Q6.b)
- `mockups/.git-hooks/`
- `mockups/dist/`, `mockups/node_modules/`
- non-`.ts`/`.tsx` files

Files outside `mockups/src/{screens,shell,dev,lib,pages}/` are unaffected.
