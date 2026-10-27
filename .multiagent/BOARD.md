# Team board
Lead: claude | Agents: claude, agy, copilot

| # | Task | Owner | Model | Worktree/branch | Status | Verified by |
|---|------|-------|-------|-----------------|--------|-------------|
| 1 | Supabase schema + RLS (6 migrations) | claude | - | main | merged | applied to project tzqmlmtzgypguzktzvjk |
| 2 | Seed data (generate_series SQL) | claude | - | main | running | |
| 3 | Next.js web app (web/) | copilot | medium | team/copilot-web | todo | |
| 4 | Python ML service (ml/) | agy | high | team/agy-ml | todo | |
| 5 | README / docs | claude | - | main | todo | |

## Notes / decisions
- Supabase project `edubase` (ap-south-1), ref tzqmlmtzgypguzktzvjk.
- Schema is the contract; helpers must not edit supabase/migrations.
