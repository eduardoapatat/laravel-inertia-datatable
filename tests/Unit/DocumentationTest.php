<?php

declare(strict_types=1);

use InertiaDataTable\Column;
use InertiaDataTable\Enums\FilterOperator;
use InertiaDataTable\Enums\FilterVariant;

/*
 * The documentation quotes the code (components, files, column methods, texts,
 * operators, URL parameters, the version): these tests fail when a quote stops
 * being true, so a rename or a release does not leave the docs behind.
 */

function docsRoot(): string
{
    return dirname(__DIR__, 2);
}

/**
 * @return array<string, string> path relative to the root => contents
 */
function docs(): array
{
    $root = docsRoot();
    $paths = [
        'README.md',
        'docs/contract.md',
        'skill/laravel-inertia-datatable/SKILL.md',
        ...array_map(
            fn (string $path): string => substr($path, strlen($root) + 1),
            glob($root.'/skill/laravel-inertia-datatable/references/*.md') ?: [],
        ),
    ];

    return array_combine($paths, array_map(fn (string $path): string => (string) file_get_contents("{$root}/{$path}"), $paths));
}

/**
 * Every match of a pattern in the docs, with the file it comes from.
 *
 * @return list<array{0: string, 1: list<string>}> [file, groups]
 */
function quotes(string $pattern): array
{
    $found = [];

    foreach (docs() as $file => $contents) {
        preg_match_all($pattern, $contents, $matches, PREG_SET_ORDER);

        foreach ($matches as $match) {
            $found[] = [$file, $match];
        }
    }

    return $found;
}

/**
 * Paths the registry installs, relative to `resources/js`.
 *
 * @return list<string>
 */
function registryTargets(): array
{
    /** @var array{items: list<array{files?: list<array{target?: string}>}>} $registry */
    $registry = json_decode((string) file_get_contents(docsRoot().'/registry.json'), true);
    $targets = [];

    foreach ($registry['items'] as $item) {
        foreach ($item['files'] ?? [] as $file) {
            if (isset($file['target']) && str_starts_with($file['target'], '~/resources/js/')) {
                $targets[] = substr($file['target'], strlen('~/resources/js/'));
            }
        }
    }

    return array_values(array_unique($targets));
}

/**
 * `lib/data-table-{a,b}.ts` → `lib/data-table-a.ts`, `lib/data-table-b.ts`.
 *
 * @return list<string>
 */
function expandBraces(string $path): array
{
    if (! preg_match('/^(.*)\{([^}]*)\}(.*)$/', $path, $match)) {
        return [$path];
    }

    return array_map(fn (string $part): string => $match[1].$part.$match[3], explode(',', $match[2]));
}

it('quotes components that the registry exports', function () {
    $exported = [];

    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(docsRoot().'/registry')) as $file) {
        if (preg_match('/\.tsx?$/', $file->getFilename())) {
            preg_match_all('/export\s+(?:async\s+)?(?:function|const|type|interface|class)\s+(\w+)/', (string) file_get_contents($file->getPathname()), $matches);
            array_push($exported, ...$matches[1]);
        }
    }

    $missing = [];

    foreach (quotes('/\b(DataTable[A-Z]\w*)\b/') as [$file, $match]) {
        if (! in_array($match[1], $exported, true) && ! class_exists('InertiaDataTable\\'.$match[1])) {
            $missing[] = "{$file}: {$match[1]}";
        }
    }

    expect(array_unique($missing))->toBe([]);
});

it('quotes files that the registry installs', function () {
    $targets = registryTargets();
    $missing = [];

    foreach (quotes('#\b((?:lib|hooks|components/data-table|components/ui)/[\w./{},-]+\.tsx?)\b#') as [$file, $match]) {
        foreach (expandBraces($match[1]) as $path) {
            // Other components/ui files come from shadcn, not from the registry.
            if (str_starts_with($path, 'components/ui/') && $path !== 'components/ui/faceted.tsx') {
                continue;
            }

            if (! in_array($path, $targets, true)) {
                $missing[] = "{$file}: {$path}";
            }
        }
    }

    expect(array_unique($missing))->toBe([]);
});

it('lists every lib file of the registry in the React reference', function () {
    $contents = docs()['skill/laravel-inertia-datatable/references/react.md'];
    $section = substr($contents, (int) strpos($contents, '## Files installed by the registry'));
    preg_match_all('#\blib/[\w.{},-]+\.ts\b#', $section, $matches);
    $listed = array_merge(...array_map(expandBraces(...), $matches[0]));
    $libs = array_filter(registryTargets(), fn (string $path): bool => str_starts_with($path, 'lib/'));

    expect(array_values(array_diff($libs, $listed)))->toBe([]);
});

it('quotes column methods that exist on that type of column', function () {
    $chains = quotes('/Column::(\w+)\(\'[^\']*\'[^()]*\)((?:\s*->\w+\((?:[^()]|\([^()]*\))*\))*)/');
    $missing = [];

    expect(count($chains))->toBeGreaterThan(10);

    foreach ($chains as [$file, $match]) {
        $column = Column::{$match[1]}('id');
        preg_match_all('/->(\w+)\(/', $match[2], $methods);

        foreach ($methods[1] as $method) {
            if (! method_exists($column, $method)) {
                $missing[] = "{$file}: Column::{$match[1]}()->{$method}()";
            }
        }
    }

    expect(array_unique($missing))->toBe([]);
});

it('quotes UI texts that exist', function () {
    /** @var array<string, string> $messages */
    $messages = require docsRoot().'/lang/en/ui.php';
    $missing = [];

    foreach (quotes("/getMessage\(\w+, '(\w+)'|\bmessages\.(\w+)/") as [$file, $match]) {
        $key = $match[1] !== '' ? $match[1] : $match[2];

        if (! array_key_exists($key, $messages)) {
            $missing[] = "{$file}: {$key}";
        }
    }

    expect(array_unique($missing))->toBe([]);
});

it('documents the operators of each filter variant as the server applies them', function () {
    $contents = docs()['docs/contract.md'];
    preg_match_all('/^\| `([a-z-]+)` \| `([a-z.]+)` \| (.+?) \|/m', $contents, $rows, PREG_SET_ORDER);
    $documented = [];

    foreach ($rows as [, $variant, $implicit, $operators]) {
        $documented[$variant] = ['implicit' => $implicit, 'operators' => $operators];
    }

    $urlNames = fn (string $list): array => preg_match_all('/`([a-z.]+)`/', $list, $names) ? $names[1] : [];

    foreach (FilterVariant::cases() as $variant) {
        expect($documented)->toHaveKey($variant->value);

        $row = $documented[$variant->value];
        $operators = preg_match('/^same as `([a-z-]+)`$/', $row['operators'], $same)
            ? $documented[$same[1]]['operators']
            : $row['operators'];
        $expected = array_map(fn (FilterOperator $operator): string => $operator->urlName(), $variant->operators());

        expect($row['implicit'])->toBe($variant->implicitOperator()->urlName(), "implicit operator of {$variant->value}")
            ->and(collect($urlNames($operators))->sort()->values()->all())
            ->toBe(collect($expected)->sort()->values()->all(), "operators of {$variant->value}");
    }
});

it('documents the URL parameters of the config', function () {
    /** @var array{query: array<string, string>} $config */
    $config = require docsRoot().'/config/inertia-datatable.php';
    $contents = docs()['docs/contract.md'];
    $table = substr($contents, (int) strpos($contents, '| Parameter |'));
    $table = substr($table, 0, (int) strpos($table, "\n\n"));
    preg_match_all('/^\| `(\w+)/m', $table, $parameters);

    expect($parameters[1])->not->toBeEmpty()
        ->and(array_values(array_diff($parameters[1], $config['query'])))->toBe([])
        ->and(array_values(array_diff($config['query'], $parameters[1])))->toBe([]);
});

it('links the registry of the latest released version', function () {
    preg_match('/^## \[(\d+\.\d+\.\d+)\]/m', (string) file_get_contents(docsRoot().'/CHANGELOG.md'), $latest);
    $links = quotes('#/v(\d+\.\d+\.\d+)/r/#');

    expect($latest)->not->toBeEmpty()
        ->and($links)->not->toBeEmpty();

    foreach ($links as [$file, $match]) {
        expect($match[1])->toBe($latest[1], "{$file} links v{$match[1]}");
    }
});
