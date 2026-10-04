# Grynd

Free, offline-first strength training app for iOS and Android. Users create plans (a plan = one workout = a fixed sequence of exercises) and log sets faster than with FitNotes. No ads, no subscription, no account required.

**Full plan and all product decisions: `docs/plan.md` — read it before starting any feature.**
Design source: Figma file `grynd` (https://www.figma.com/design/iCoAOIvfyeCFYFU4Og7rVf/grynd), pages Foundations, Components, Screens.

## Stack

Angular (latest, standalone, signals, new control flow, no SSR) · Capacitor · Spartan UI (brain + helm) · Tailwind CSS v4 (CSS-first `@theme`) · Lucide via ng-icons · motion + canvas-confetti (animations) · `@capacitor-community/sqlite` (+ `jeep-sqlite` in the browser) · Transloco (de, en) · pnpm · Vitest · Playwright · angular-eslint + Prettier.

App id: `com.michaelisler.grynd`. The developer has no Mac: iOS builds run in CI, iOS testing via TestFlight. Day-to-day development happens in the browser and on Android.

## Hard rules

- UI only from Spartan helm components in `src/app/shared/ui` and our own components in `src/app/shared/components`. Check `docs/design/component-map.md` before building UI from Figma.
- Never hardcode colors, spacing or radii. Use Tailwind classes backed by the design tokens (`--primary`, `--muted-foreground`, …).
- Progress is always `primary`. `success` is only for status messages (badges, toasts, trends).
- Never hardcode user-facing text; everything goes through Transloco (de and en).
- State with signals in services. No new dependencies without asking first.
- Max one primary button per screen, fixed at the bottom, full width (exception: Plans screen has none).
- Every table: UUIDv7 `id` generated in the app, `createdAt`, `updatedAt`, `deletedAt` (soft delete).
- Weights are stored in kg only; lb is display-only.
- A workout session is a copy of the plan: changes during a workout never modify the plan.
- Store timestamps in UTC; derive durations from timestamps, never from counters (timers store their end time).
- Animations: build on the presets and helpers in `src/app/shared/motion` (particles via `CelebrationService`), keep them non-blocking and always respect `prefers-reduced-motion` (decision 0015).

## Structure

```
src/app/
  core/            db, repositories, services (theme, timer, i18n)
  features/
    plans/         list, detail/edit/new, add-exercises
    workout/       active session
    history/
    settings/
  shared/ui/       Spartan helm components
  shared/components/  own components (set-row, progress-ring, timer-bar, …)
  shared/motion/   motion presets and helpers, CelebrationService (confetti + haptics)
docs/
  plan.md          full product and implementation plan
  design/          exported tokens, component-map.md, screenshots
  decisions/       short decision notes
```

## Conventions

- Code, comments and commits in English; Conventional Commits, see «Commits and PRs».
- Component names mirror Figma (e.g. Figma `Grynd/Set Row` with `State=open|completed|record|menu-open` → `SetRow` (`app-set-row`) with `state: 'open' | 'completed' | 'record' | 'menu-open'`).
- Write unit tests for business logic (session copy, prefill, PR detection, intervals, unsaved-changes detection).

## Commits and PRs

Releases are automatic (release-please, `docs/release.md`): the commits on `main` decide the next version and become the changelog in the GitHub release. PRs are squash-merged with the **PR title** as the commit subject, so the PR title matters most and is checked in CI.

- Format: `type(scope): subject`, e.g. `feat(workout): show the previous set while logging`.
- Types: `feat` (new user-facing behavior → minor), `fix` (user-facing bug fix → patch), `perf` (→ patch), `revert`; no release and not in the changelog: `refactor`, `docs`, `style`, `test`, `build`, `ci`, `chore`. Pick the type by what the user notices: a fix to code that was never released is not a `fix`.
- Scope (optional, one): `plans`, `workout`, `history`, `settings`, `timer`, `db`, `ui`, `native`, `i18n`, `catalog`, `ci`, `deps`.
- Subject: imperative, lowercase start, no final period, at most 72 characters for the whole header. For `feat`, `fix` and `perf` write it for users, it is a line in the release notes.
- Body (wrapped at 72): why the change was made and anything non-obvious; not a file list.
- Breaking change (e.g. backup format or DB migration without upgrade path): `feat!:` plus a `BREAKING CHANGE: …` footer.
- One logical change per commit; on a branch every commit follows these rules too. The PR title summarizes the whole PR in the same format.
- Never edit the version (`package.json`, `app-info.ts`, `.release-please-manifest.json`) or `CHANGELOG.md` by hand. To force a version, add a `Release-As: x.y.z` footer.

## Workflow

1. Work in small steps: one screen or one function at a time, following the tasks in `docs/roadmap.md` (milestones from `docs/plan.md` §10).
2. Start in plan mode, wait for approval, then implement.
3. One branch per feature; commit after each working step.
4. Lint and tests must pass before a task is done.
5. When something is learned or decided, update `docs/plan.md`, `docs/decisions/` or this file.

## Commands

Node 24 (`.nvmrc`), pnpm via `corepack enable` (version pinned in `package.json`).

- Dev server: `pnpm start` (http://localhost:4200)
- Tests: `pnpm test` (Vitest via `@angular/build:unit-test`, runs once; `pnpm test:watch` to watch)
- E2E: `pnpm e2e` (Playwright, Chromium at 393×852, starts its own `ng serve` on :4300; first run: `pnpm exec playwright install chromium`)
- Lint: `pnpm lint` · Format: `pnpm format` / `pnpm format:check`
- Build: `pnpm build` (output `dist/grynd/browser`)
- Sync native projects: `pnpm build && pnpm exec cap sync`
- Regenerate app icons and splash screens from `assets/` (exported from Figma page «App Icon – Fitness», frames «Export · …»): `pnpm assets:generate`, then `pnpm exec cap sync`
- Rebuild the exercise catalog (free-exercise-db → `public/data/exercises.json`, thumbnails, `catalog-version.ts`): `pnpm catalog:import`
- Add a Spartan helm component: `pnpm ng g @spartan-ng/cli:ui <name>` (goes to `src/app/shared/ui`, then align it with the Figma component)
- Component showcase (dev only): http://localhost:4200/dev/components – every shared component in all states; add new ones there
- CI (`.github/workflows/ci.yml`) runs format check, lint, test and build, plus the E2E job, on every push and PR.
- Release (`.github/workflows/release.yml`): release-please keeps a release PR open on `main`; merging it tags `vX.Y.Z`, publishes the GitHub release with the changelog and attaches the debug APK. PR titles are checked by `.github/workflows/pr-title.yml`.
- Web deploy (`.github/workflows/deploy.yml`): production only for releases (after CI on the release commit); every merge to `main` goes to staging (`/main/` on the preview host); every PR gets its own preview.
- Native builds (`.github/workflows/build-native.yml`): Android debug APK artifact and an unsigned iOS simulator build; manual, on `v*` tags and on PRs touching native files. Release and signing notes: `docs/release.md`.
- Web deploy (`.github/workflows/deploy.yml`): FTPS via `lftp` (`scripts/deploy-ftp.sh`, Apache config in `deploy/`). Production `https://fit.michael-isler.com` after green CI on `main`; every PR gets a preview at `https://fit-preview.michael-isler.com/pr-<n>/`, removed on close. GitHub environments `Production`/`Preview` each hold `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` + var `SITE_URL`.

## Tools

- Use the Spartan MCP server (`@spartan-ng/mcp`) for current Spartan docs and the Angular CLI MCP server (`ng mcp`) for Angular best practices. Verify setup commands against current docs; versions change.
- Use the Figma MCP server to read variables and frames. Node IDs per screen and component are in `docs/design/component-map.md`; `get_metadata` only lists the first page, use `use_figma` to browse the others. To refresh tokens follow `scripts/figma-tokens.md` (regenerates `src/styles/tokens.css`).
