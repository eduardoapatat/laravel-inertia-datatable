# laravel-inertia-datatable

Laravel package (`type: library`) for server-driven data tables, with a shadcn registry for the React and Vue UI and a Claude Code skill for consumers. PHP ^8.3, Laravel 12 and 13. See `README.md` for an overview, the skill for usage, `docs/contract.md` for the frontend–backend HTTP contract and `CONTRIBUTING.md` for development, CI and releases.

## Layout

- `src/`, `config/`: the Composer package (backend). Entry point: `src/InertiaDataTableServiceProvider.php`.
- `registry/` (sources), `registry.json` and `r/` (built output): the shadcn registry. `registry/react/` and `registry/vue/` (shadcn-vue) hold the components of each framework, `registry/shared/lib/` the code both install; each framework has its own `lib/data-table-tanstack.ts`, the only `lib/` file that imports TanStack Table or the framework. The hook of React and the composable of Vue are tested with the same cases (`registry/shared/test/use-server-data-table.cases.ts`), each in a Vitest project with Inertia mocked; the test files are not in `registry.json`, so they never reach an app.
- `skill/laravel-inertia-datatable/`: the skill shipped to package users. It is not a skill for working on this repo.
- `stubs/`: templates used by the `make:datatable` command.
- `tests/`: Pest with Orchestra Testbench (`Feature/`, `Unit/`, `Fixtures/`, `ArchTest.php`), and `e2e/`: Playwright tests of the UI in a React and a Vue starter kit (the same specs), served with Inertia SSR, with the products scenario of `e2e/fixture/`: `shared/` (PHP, fixed data in `E2eSeeder`) and the pages of each framework in `react/` and `vue/`.

## Commands

```bash
composer test           # Pest
composer format         # Pint
composer analyse        # Larastan
composer check          # Pint --test, Larastan and Pest
pnpm run test           # Vitest: the shared code and useServerDataTable of React and Vue
pnpm run check          # format and lint (vite-plus)
pnpm run types:check
pnpm run registry:build # compiles registry.json into r/
composer verify         # all the CI locally: repo, MySQL/Postgres (Docker), new React and Vue starter kits and the e2e tests
composer verify -- e2e  # only some stages: repo, databases, starter-kit, e2e
FRAMEWORKS=vue composer verify -- starter-kit e2e   # only one framework
```

Run `composer check` and `pnpm run check` before considering a change done. Run `composer verify` before releasing a version, and for changes to `registry/react/**`, `registry/vue/**`, `registry/shared/**` or to the SQL of the queries (it needs Docker; without `pdo_mysql` or `pdo_pgsql` in the local PHP, Pest runs in a PHP container).

`pnpm run check` and `pnpm run types:check` do not cover `registry/react/**` and `registry/vue/**`: those components import the `ui/` components of shadcn (or shadcn-vue) that each app installs, so they are only linted and type checked in a real app: the `starter-kit` stage of `composer verify` and the starter kit job of the CI (`.github/scripts/starter-kit.sh`). The `e2e` stage tests them in the browser; when a change of the UI changes what a test expects, update the test in `tests/e2e/`.

## Rules

- There is no `artisan` in this repo: it is a package. Use Testbench for anything that needs the framework.
- Follow `docs/contract.md`: the server is the source of truth, state lives in the URL, only server-declared columns can be sorted, filtered or searched, and request values are never interpolated into SQL. Invalid input is normalized, not rejected.
- Tests run on in-memory SQLite locally, but CI also runs MySQL 8.4 and Postgres 17. Keep queries and tests portable across the three.
- Never edit `r/` by hand. Change `registry/` or `registry.json` and run `pnpm run registry:build`.
- Changes for users go under `## [Unreleased]` in `CHANGELOG.md`. Releases follow the "Releasing a version" section of `CONTRIBUTING.md`.

## Where things are documented

Each thing lives in one place; the others link to it instead of copying it.

- `README.md`: what the package is, installation and a quick start; it links to the rest.
- `CONTRIBUTING.md`: development, CI and releasing a version.
- `skill/laravel-inertia-datatable/`: how to use it, for people and AI (`SKILL.md` is the workflow, `references/` the details of the backend, React, Vue and tests).
- `docs/contract.md`: the HTTP contract between client and server (URL, response, normalization).
- `CHANGELOG.md`: the changes of each version, with the migration of the breaking ones.

`tests/Unit/DocumentationTest.php` checks that what the docs quote still exists: components, registry files, column methods, UI texts, the operators of each variant, the URL parameters and the version of the registry links. When it fails after a change, update the doc, not the test.
