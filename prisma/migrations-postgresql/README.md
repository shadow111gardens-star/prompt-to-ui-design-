# PostgreSQL migration history

Phase 1 configured this separate history without touching SQLite.
Phase 2 added `20261022000000_initial_postgresql`: four tables, their primary
keys, three foreign keys, and the unique ProjectSettings project constraint.
Its additive DDL is wrapped in a transaction. It was applied with Prisma 7.8.0
`migrate deploy` to the approved, previously empty Neon target.

The existing SQLite migration history remains unchanged in `prisma/migrations`.
Do not copy or replay those SQLite SQL files against PostgreSQL. Do not mark them
as applied on Neon.

The SQLite data import is separate from schema migration. See
`reports/NEON-PHASE2.md` for the approved import, verification, and operational
tool modes. Do not reapply the initial migration manually or mark SQLite
migrations as applied. Never use `db push` or reset commands for this workflow.
Preserve the verified SQLite backup and original migration history.
