# Team board
Lead: claude | Agents: claude, agy, copilot

| # | Task | Owner | Model | Worktree/branch | Status | Verified by |
|---|------|-------|-------|-----------------|--------|-------------|
| 1 | Supabase schema + RLS (migrations 1-7) | claude | - | main | merged | applied; advisors clean except leaked-password setting |
| 2 | Seed data (supabase/seed) | claude | - | main | merged | counts checked; RLS tested with student/admin/anon tokens |
| 3 | Reporting views (migration 8) | claude | - | main | merged | queried live |
| 4 | Web app v1 | copilot | medium | team/copilot-web | merged | build passes; prettier by lead |
| 5 | Web app v2 (views, formatting, roles) | copilot | high | team/copilot-web | merged | lead: lint + build + live smoke test as admin |
| 6 | ML service v1 | agy (gemini fallback) | high | team/agy-ml | merged | copilot review: 3 high findings, fixed in #7 |
| 7 | ML review fixes (auth, session ownership) | agy | medium | team/agy-ml | merged | lead: 37 tests pass, auth code read |
| 8 | README | claude | - | main | merged | |
| 9 | Attendance roll-up (perf) | claude | - | main | merged | KPIs 5.7s -> 0.3s via API |
| 10 | White theme + clickable records | copilot | high | team/copilot-web3 | merged | lead: crawl 232 pages x 3 roles, 0 issues |
| 11 | Bug fixes found by crawl + auth latency | claude | - | team/copilot-web3 | merged | crawl clean; warm pages 0.15-0.3s |

## Notes / decisions
- Supabase project `edubase` (ap-south-1), ref tzqmlmtzgypguzktzvjk.
- Schema is the contract; helpers must not edit supabase/.
- agy's Claude quota exhausted -> Gemini 3.8 Flash used.
