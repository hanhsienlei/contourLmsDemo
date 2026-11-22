@AGENTS.md

## UI work
- UI and UX changes follow `docs/superpowers/specs/2026-11-22-ui-ux-refresh.md`. It wins over §10 of the mini-LMS design spec.
- Use shadcn/ui components from `components/ui/` and Tailwind theme tokens. No custom CSS files, no raw hex colours.
- No business rules in components. Display logic goes in `lib/consultations/display.ts` with unit tests.
- Never change API contracts, service rules or migrations as part of a UI task.
