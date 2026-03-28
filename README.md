# Village-Survey-Team

## Marda Village R&R Survey App

This workspace contains a starter monorepo and developer handoff for a Resettlement and Rehabilitation (R&R) survey system for Marda village under the CBA Act, 1957.

## Files

- `docs/product-spec.md` - functional requirements, modules, user roles, reports
- `docs/system-design.md` - architecture, offline sync, security, deployment approach
- `docs/data-model.md` - database schema, entity relationships, constraints, sample SQL
- `database/schema.sql` - starter SQL schema
- `apps/api` - backend API starter
- `apps/web` - supervisor/admin web starter
- `apps/mobile` - Android-first mobile starter
- `packages/shared` - shared domain types, calculations, and family rules

## Scope

The system is designed to:

- survey about 600 households
- support Android-first offline data collection
- classify family eligibility using a fixed cut-off date of 29 August 2020
- allow manual family-group overrides to prevent field disputes
- calculate land, structure, and compensation summaries
- support surveyor, supervisor, and admin roles

## Recommended Stack

- Mobile app: React Native
- Web admin: React
- Backend API: Node.js with NestJS or Express
- Database: PostgreSQL / Supabase Postgres
- Local mobile storage: SQLite
- File storage: S3-compatible object storage

## Monorepo Layout

```text
apps/
  api/
  mobile/
  web/
database/
  schema.sql
docs/
packages/
  shared/
```

## What Is Implemented

- shared cut-off rule and family classification logic
- dependent-members-in-`F1` enforcement
- total area and total compensation calculations
- sample household bundle for UI and API seeding
- Express-style API routes for household retrieval and creation
- React web dashboard and household review starter
- Expo-style mobile shell with local storage and sync queue interfaces

## Local Setup

To run the project on a development machine:

1. install Node.js 20 or newer
2. create a PostgreSQL database, for example `marda_rr`, or use Supabase Postgres
3. copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL`
4. run `npm install`
5. run `npm --workspace @marda/api run migrate`
6. run `npm run dev:api`
7. run `npm run dev:web`
8. run `npm run dev:mobile`

## Recommended Next Steps

1. replace mobile in-memory storage with SQLite and file upload queueing
2. add authentication and role-based route guards
3. build form screens for household, members, valuation, and document capture
4. add update and delete APIs with audit logs
5. add export jobs for Excel and PDF
