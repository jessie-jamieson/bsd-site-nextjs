# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start development server with Turbopack
pnpm build            # Production build
pnpm lint             # Run Biome linter
pnpm check-types      # TypeScript type checking

# Database
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit migrate    # Run pending migrations
npx @better-auth/cli generate  # Regenerate better-auth schema (rarely needed)
```

## Architecture

This is a Next.js 16 App Router application for a volleyball league management site (Bump Set Drink), built on the IndieSaas boilerplate. Players register, sign up for seasons, get drafted onto teams by captains, and track matches/playoffs.

### Domain Model

Key entities in `src/database/schema.ts`: users (with volleyball-specific fields like experience, height, skill positions), seasons, divisions (skill levels), signups (season registration with captain preference and pairing requests), teams, drafts (player-to-team assignments), matches (stored as `matchs` table), champions, waitlist, discounts, evaluations, commissioners, site_config (dynamic key-value settings), and audit_log.

### Authentication
- **better-auth** for backend auth configuration (`src/lib/auth.ts`) — email/password + Google OAuth
- **@daveyplate/better-auth-ui** for pre-built auth components (AuthCard, SignedIn, RedirectToSignUp)
- Auth client configuration in `src/lib/auth-client.ts`
- Auth provider wraps app in `src/app/providers.tsx` - controls post-login redirects and additional signup fields

### Database
- **Drizzle ORM** with PostgreSQL
- Schema defined in `src/database/schema.ts`
- Database connection in `src/database/db.ts`
- Migrations output to `./migrations/`
- Config in `drizzle.config.ts`

### Route Groups
- `(marketing)/` - Public pages with marketing layout
- `dashboard/` - Protected user area with sidebar layout (includes admin-only routes)
- `onboarding/` - Multi-step post-signup flow (gated by `@onboardingCheck` parallel route)
- `auth/` - Authentication pages (handled by better-auth-ui)

### Server Actions Pattern
Server actions are co-located with pages in `actions.ts` files:
```
src/app/dashboard/volleyball-profile/
  ├── page.tsx           # Server component
  ├── actions.ts         # "use server" mutations
  └── volleyball-profile-form.tsx  # Client form component
```

Actions return `{ status: boolean; message: string; data?: T }`. After successful mutations, client components call `router.refresh()` to update server component data.

### Admin Authorization
Authorization is checked per-action using centralized helpers from `src/lib/auth-checks.ts`:
- **`checkAdminAccess()`** — Returns boolean if user has admin/director role
- **`requireAdminAccess()`** — Throws error if unauthorized, logs failed attempts to audit_log
- **`requireAuth()`** — Throws error if not authenticated
- **`getCurrentSession()`** — Returns current session or null

Admin pages check access at page level and redirect to `/dashboard` if denied. Admin actions check access before mutations. Admin sections are conditionally rendered in the sidebar using `getIsAdminOrDirector()` helper.

### Audit Logging
Comprehensive audit logging system in `src/lib/audit-log.ts`:
- **`logAuditEntry()`** — General purpose audit logging for admin actions
- **`logAuthorizationFailure()`** — Logs failed admin access attempts
- **`logAuthenticationFailure()`** — Logs failed login attempts
- **`logPaymentFailure()`** — Logs failed payment transactions
- **`logSecurityEvent()`** — Logs security events (rate limiting, suspicious activity)

All admin mutations (create, update, delete) should call `logAuditEntry()` with userId, action, entityType, entityId, and summary. Failed authorization attempts are automatically logged by `requireAdminAccess()`.

### Site Config System
Dynamic configuration stored in the `site_config` database table (key-value pairs). Managed at `/dashboard/site-config`. Controls: season pricing, late pricing dates, max players, registration open/closed, tryout/season/playoff dates. Access via helpers in `src/lib/site-config.ts` (`getSeasonConfig()`, `getCurrentSeasonAmount()`, `checkSignupEligibility()`).

### Integrations
- **Square** — Payment processing for season fees. Server-side via `square` SDK in `src/app/dashboard/pay-season/actions.ts`. Client-side tokenization via `react-square-web-payments-sdk`. Discount system in `src/lib/discount.ts` validates percentages (0-100%) and amounts.
- **Resend** — Transactional emails (password reset, signup confirmation). Configured in `src/lib/auth.ts` and pay-season actions. Site email config in `src/config/site.ts`.

### Security
- **Rate Limiting** — Proxy handler in `src/proxy.ts` implements in-memory rate limiting: 5 req/min for auth endpoints, 5 req/hour for payment endpoints, 100 req/min for general API. For production with multiple instances, migrate to Upstash Ratelimit.
- **Security Headers** — Configured in `next.config.ts`: X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, X-XSS-Protection, Permissions-Policy
- **Password Requirements** — Minimum 12 characters (configured in `src/lib/auth.ts`)
- **Environment Validation** — Database connection validates DATABASE_URL exists at startup (`src/database/db.ts`)
- **Authentication** — All server actions that access user data must check `session?.user`. Use centralized helpers from `src/lib/auth-checks.ts`.
- **SQL Injection Protection** — Drizzle ORM uses parameterized queries exclusively
- **CSRF Protection** — Handled by better-auth and Next.js server actions

### Key Patterns
- **Authentication** — Use `getCurrentSession()` from `@/lib/auth-checks` instead of calling `auth.api.getSession()` directly
- **Authorization** — Import `checkAdminAccess()` or `requireAdminAccess()` from `@/lib/auth-checks` for admin-only actions
- **Audit Logging** — Call appropriate logging functions from `@/lib/audit-log` for all admin mutations and security events
- **Import Paths** — `@/*` maps to `./src/*`
- **UI Components** — shadcn/ui components in `src/components/ui/`
- **Layout Components** — Shared layouts in `src/components/layout/`
- **Forms** — Primarily use controlled components with `useState`, not react-hook-form

### Formatting
- Biome linter with 4-space indentation
- No semicolons (except where required)
- No trailing commas
- `components/ui/`, `migrations/`, and CSS files excluded from linting
- Biome auto-fixes: unused imports, `==` to `===`, self-closing elements, Tailwind class sorting (via `cn()` function)
