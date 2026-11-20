# HealthOS

**A personalised nutrition planner that adapts a weekly calorie budget to real eating patterns.**

HealthOS is a cross-platform nutrition tracking application built with Expo, React Native and TypeScript. Rather than treating every day as an isolated calorie target, it plans across the week, accounts for logged intake and planned treats, and can learn from food logs and weigh-ins to propose more personalised targets.

- **Live web app:** https://healthos-flax.vercel.app
- **Repository:** https://github.com/rudrakshjhalanii07/healthos

> **Health disclaimer:** HealthOS provides estimates for general informational use. It is not medical advice, diagnosis or treatment, and is not a substitute for a qualified healthcare professional. The app is intended for adults. See the in-app [Privacy & health disclaimer](https://healthos-flax.vercel.app/privacy) before using it.

## Product capabilities

- **Food and macro logging** — record meals and foods, with calorie and macronutrient estimates.
- **Weekly calorie planning** — distribute a weekly budget across days instead of enforcing one identical daily target.
- **Flexible day allocation** — support light, normal and flexible days, with user-adjustable day weights.
- **Adaptive corrections** — account for previous-day overages and redistribute the remaining budget within configured daily bounds.
- **Planned allowances** — reserve room for recurring treats in advance rather than treating them as unplanned exceptions.
- **Profile-aware targets** — estimate energy needs from profile inputs, goals and activity level, with safety bounds in the planning logic.
- **Behaviour calibration** — analyse food logs, weekday patterns, macro balance, recurring foods and weigh-ins to propose adjustments.
- **Account and sync** — email-based authentication, local caching, cross-device data sync and export/delete account flows.
- **Installable web app** — web export with a generated service worker and PWA manifest.

## How the planner works

The planning engine is organised around a weekly budget:

1. A starting energy target is estimated from profile information, or informed by a user-stated or learned maintenance estimate.
2. The weekly target is distributed across the selected days using relative weekday weights.
3. Planned food allowances are reserved on their assigned days.
4. As days are completed, logged intake is compared with the assigned target.
5. The remaining budget is redistributed across future days, with configurable correction behaviour and daily lower/upper bounds.
6. Separately, the learning module analyses historical logs and weigh-ins and can produce a proposal for the user to review.

The allocation code uses a bounded, water-filling-style distribution so that days are kept within configured limits where the total budget permits. Learning is a proposal workflow: users can review and apply a proposed plan rather than having every inferred change silently imposed.

Relevant domain modules:

| Module | Responsibility |
|---|---|
| `src/lib/profile.ts` | Profile types, energy estimates, goal constraints and macro configuration |
| `src/lib/planner.ts` | Weekly budget allocation, day weights, carry-over and correction |
| `src/lib/learn.ts` | Habit analysis, weight trends, calibration and plan proposals |
| `src/lib/foods.ts` | Food catalogue, aliases, serving sizes and food tags |
| `src/lib/macros.ts` | Macro and daily-budget calculations |
| `src/lib/model.ts` | Combines stored data and domain logic into the dashboard model |
| `src/lib/store.tsx` | Local state, persistence, account lifecycle and server sync |

## Architecture

```text
Expo Router application
  ├── Screens: dashboard, login, onboarding, privacy
  ├── UI components: food logger, day log, macro cards, planner cards
  ├── Domain layer
  │     ├── profile and energy estimates
  │     ├── food catalogue and macro calculations
  │     ├── weekly planner
  │     └── habit learning and proposals
  ├── Client store
  │     ├── AsyncStorage cache
  │     └── version-aware sync client
  └── Expo Router API routes
        ├── Neon Auth proxy
        ├── account actions
        └── user data endpoint
              └── Neon PostgreSQL
```

### Data and sync model

- The app keeps a local copy using AsyncStorage so previously loaded data can be available without waiting for a network request.
- Signed-in user data is stored in the `user_data` PostgreSQL table as a JSONB document.
- The API uses a monotonically increasing row version and compare-and-swap style updates to detect stale writes.
- On a version conflict, the client fetches the server copy and merges supported entry and weigh-in records before retrying.
- Account and session management are handled by Neon Auth (Better Auth); the app proxies the auth endpoints through its own domain so the session cookie is first-party.

## Technology

| Area | Technology |
|---|---|
| Language | TypeScript |
| App framework | Expo SDK 57 |
| UI runtime | React 19, React Native 0.86, React Native Web |
| Navigation | Expo Router |
| Local persistence | AsyncStorage |
| Backend API | Expo Router API routes / Expo Server Vercel adapter |
| Authentication | Neon Auth (Better Auth) |
| Database | Neon PostgreSQL, JSONB |
| Hosting | Vercel |
| PWA | Workbox |
| Quality tooling | ESLint, TypeScript |

## Repository layout

```text
.
├── api/                 # Vercel serverless entry for Expo API routes
├── db/                  # PostgreSQL schema
├── scripts/             # Migration, build and backup/restore helpers
├── src/
│   ├── app/             # Expo Router screens and API routes
│   │   └── api/         # Auth, account and data endpoints
│   ├── components/      # Reusable UI components
│   ├── constants/       # Theme and day-type constants
│   ├── lib/             # Domain logic, store, API and data models
│   └── server/          # Database, HTTP and auth helpers
├── public/              # PWA manifest and icons
├── assets/              # App icons, splash and images
├── .github/workflows/   # Scheduled encrypted database backup
├── app.json             # Expo configuration
└── vercel.json          # Vercel build, routing and security headers
```

## Local development

### Prerequisites

- Node.js compatible with the installed Expo SDK and package lock
- npm
- A Neon project with Neon Auth enabled
- A Vercel project for deployment (optional for local UI development)

### Install and run

```bash
npm ci
npm run start
```

For a specific target:

```bash
npm run web
npm run android
npm run ios
```

The app's authenticated data and account features require the backend environment to be configured. The UI can be explored locally, but a working Neon Auth and database setup is needed for the complete account/sync flow.

### Environment configuration

Configure server-side environment variables in your local environment (for example, a git-ignored `.env.local`) and in Vercel:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string used by the API and migration script |
| `NEON_AUTH_BASE_URL` | Neon Auth base URL |
| `DATABASE_NEON_AUTH_BASE_URL` | Alternative variable name supported for the Neon Auth URL |

Do not commit real credentials, database URLs, auth secrets, backup passphrases or production environment files. Use Vercel's environment management to pull local development values when appropriate:

```bash
vercel env pull .env.local
```

### Database setup

The schema is intentionally small: one JSONB data document per authenticated user, with a version column for optimistic concurrency. Neon Auth owns its account/session tables.

After setting `DATABASE_URL`, apply the schema:

```bash
npm run db:migrate
```

The migration script loads `.env.local` when `DATABASE_URL` is not already present in the process environment.

## Build, lint and type-check

```bash
npm run lint
npx tsc --noEmit
npm run build:web
```

The web build exports the Expo web app, copies the static page assets and generates the service worker with Workbox.

## Deployment

The repository is configured for Vercel:

- Install command: `npm ci`
- Build command: `npm run build:web`
- Output directory: `dist/client`
- API serverless entry: `api/index.ts`, backed by the Expo server build in `dist/server`
- Rewrites route non-static requests to the API entry.

Set the required server-side environment variables in the Vercel project before deploying. Review the Content Security Policy and other response headers in `vercel.json` if you add new external services, fonts or image hosts.

## Backups

A GitHub Actions workflow is configured to create a nightly encrypted PostgreSQL backup and retain the artifact for 30 days. It expects the following GitHub Actions secrets:

- `BACKUP_DATABASE_URL` — direct PostgreSQL URL for the backup role
- `BACKUP_PASSPHRASE` — strong passphrase used to encrypt the dump

The restore helper is `scripts/restore-backup.sh`. Keep the passphrase somewhere secure outside GitHub; an encrypted backup is not useful if its key is lost. Review the workflow and restore procedure before relying on it as a disaster-recovery plan.

## Privacy and security notes

HealthOS handles personal profile, food-log and weight data. The in-app privacy page describes the data collected, service providers, user controls and health disclaimer.

Before running your own instance:

- Use separate development and production database credentials.
- Keep secrets out of source control and rotate any credential that may have been exposed.
- Review auth cookie/session behaviour and account deletion in your deployment environment.
- Enable repository secret scanning and dependency/security alerts.
- Treat nutrition estimates as approximate; validate health-related product changes carefully.

## Current scope and limitations

- Food and macro values are estimates from the built-in food catalogue and serving assumptions; they are not laboratory measurements.
- Energy targets depend on profile inputs and formulas, and learned estimates depend on the quality and consistency of user logs.
- The app is designed for adults and is not a medical device or a substitute for individual clinical advice.
- The repository does not currently document a dedicated automated unit/integration test suite. Add tests around planner invariants, learning calculations, account flows and sync conflicts before relying on those paths in production.

## Contributions and feedback

HealthOS is published as a proprietary portfolio project, not as an open-source contribution project. Please do not submit pull requests that copy, modify or redistribute project code. You may use GitHub issues to report a security concern or share concise feedback, but do not include real health data, credentials, database dumps or other private information.

## Copyright and usage

Copyright (c) 2026 Rudraksh Jhalani. All rights reserved, subject to applicable third-party rights and notices.

**This repository is public for portfolio review and demonstration only. No open-source licence is granted for the original HealthOS source code.** Viewing the repository through GitHub does not grant general permission to copy, modify, redistribute, sublicense, or commercially exploit the HealthOS code. Any rights GitHub grants its users under its Terms of Service remain applicable. Third-party dependencies, fonts, icons, images and other assets are governed by their respective licences and terms; this notice does not change those rights.

For details, see [COPYRIGHT.md](./COPYRIGHT.md).
