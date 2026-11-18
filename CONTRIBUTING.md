# Contributing

## Development

```bash
composer install
composer test           # Pest
composer format         # Pint
composer analyse        # Larastan
composer check          # all of the above (Pint in --test mode)
pnpm install
pnpm run test           # tests of the shared code and the hook / composable (Vitest)
pnpm run check          # format and lint (vite-plus)
pnpm run types:check
pnpm run registry:build # compiles registry.json into r/
composer verify         # all the CI locally (needs Docker): repo, MySQL/Postgres, new starter kits and e2e
```

Tests use in-memory SQLite; for another engine pass Testbench's variables, for example `DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 DB_DATABASE=testing DB_USERNAME=postgres DB_PASSWORD=password vendor/bin/pest`.

The CI (`.github/workflows/`) runs:

- **tests**: Pest with PHP 8.3 to 8.5 and Laravel 12 and 13, MySQL 8.4 and Postgres 17, and the registry (format, tests, types and that `r/` is rebuilt).
- **starter kit**: creates clean React and Vue starter kits, installs the package and the UI of the commit with `make:datatable --react --page --install-ui` (`--vue` in Vue; with npm and with pnpm), runs the starter kit's `composer ci:check` and, with pnpm, the e2e tests of `tests/e2e`. It also runs every week, because the installer uses `shadcn@latest` and `shadcn-vue@latest`. It can be run locally with `.github/scripts/starter-kit.sh vue npm /tmp/app`.

## Releasing a version

1. Move the `## [Unreleased]` entries of `CHANGELOG.md` to the new version.
2. Change the version in the registry URLs of the README and the skill (`…/vX.Y.Z/r/…`) and rebuild `r/`.
3. Commit, annotated tag `vX.Y.Z` and push the tag. Packagist publishes it by itself; `inertia-datatable:ui` installs the UI of that tag.
4. Create the GitHub release with the version's section of the changelog as its notes: `awk '/^## \[X.Y.Z\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md | gh release create vX.Y.Z --title vX.Y.Z --notes-file -`.
