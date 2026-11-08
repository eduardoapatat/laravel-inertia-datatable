# laravel-inertia-datatable

Laravel package (`type: library`) for server-driven data tables, with a shadcn registry for the React UI and a Claude Code skill for consumers. PHP ^8.3, Laravel 12 and 13. See `README.md` for usage and `docs/contract.md` for the frontend–backend HTTP contract.

## Layout

- `src/`, `config/`: the Composer package (backend). Entry point: `src/InertiaDataTableServiceProvider.php`.
- `registry/` (sources), `registry.json` and `r/` (built output): the shadcn registry for the React UI.
- `skill/laravel-inertia-datatable/`: the skill shipped to package users. It is not a skill for working on this repo.
- `stubs/`: templates used by the `make:datatable` command.
- `tests/`: Pest with Orchestra Testbench (`Feature/`, `Unit/`, `Fixtures/`, `ArchTest.php`).

## Commands

```bash
composer test           # Pest
composer format         # Pint
composer analyse        # Larastan
composer check          # Pint --test, Larastan and Pest
pnpm run test           # Vitest for the shared code
pnpm run check          # format and lint (vite-plus)
pnpm run types:check
pnpm run registry:build # compiles registry.json into r/
```

Run `composer check` and `pnpm run check` before considering a change done.

## Rules

- There is no `artisan` in this repo: it is a package. Use Testbench for anything that needs the framework.
- Follow `docs/contract.md`: the server is the source of truth, state lives in the URL, only server-declared columns can be sorted, filtered or searched, and request values are never interpolated into SQL. Invalid input is normalized, not rejected.
- Tests run on in-memory SQLite locally, but CI also runs MySQL 8.4 and Postgres 17. Keep queries and tests portable across the three.
- Never edit `r/` by hand. Change `registry/` or `registry.json` and run `pnpm run registry:build`.
- Changes for users go under `## [Unreleased]` in `CHANGELOG.md`. Releases follow the "Releasing a version" section of the README.
