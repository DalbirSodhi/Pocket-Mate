# Pocket-Mate Commit Plan

The project should be built in small commits that look like natural software development progress.

## Planned Commit Order

1. `docs: define Pocket-Mate finance app foundation`
2. `docs: add initial database schema plan`
3. `chore: scaffold Expo React Native app`
4. `chore: add application folder structure`
5. `chore: configure environment variables`
6. `feat: add Supabase client setup`
7. `feat: add auth screens`
8. `feat: add profile setup flow`
9. `feat: add income entry flow`
10. `feat: add expense category management`
11. `feat: add expense entry flow`
12. `feat: add budget caps`
13. `feat: add savings goals`
14. `feat: add dashboard summary`
15. `feat: calculate safe-to-spend amount`
16. `test: add finance calculation coverage`

## Commit Rules

- Keep each commit focused.
- Do not mix unrelated changes.
- Prefer one feature slice per commit.
- Commit documentation changes separately from code changes when practical.
- Keep secrets out of Git.
- Commit `.env.example`, never `.env`.
