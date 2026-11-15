<?php

declare(strict_types=1);

use Illuminate\Filesystem\Filesystem;
use InertiaDataTable\Console\Frontend;

beforeEach(function () {
    $this->dir = sys_get_temp_dir().'/inertia-datatable-frontend-'.uniqid();
    mkdir($this->dir);
});

afterEach(function () {
    (new Filesystem)->deleteDirectory($this->dir);
});

function detectFrontend(string $dir, ?string $packageJson): ?Frontend
{
    if ($packageJson !== null) {
        file_put_contents($dir.'/package.json', $packageJson);
    }

    return Frontend::detect(new Filesystem, $dir);
}

it('detects the framework of the Inertia adapter', function (string $packageJson, ?Frontend $expected) {
    expect(detectFrontend($this->dir, $packageJson))->toBe($expected);
})->with([
    'react' => ['{"dependencies": {"@inertiajs/react": "^3.0"}}', Frontend::React],
    'vue' => ['{"dependencies": {"@inertiajs/vue3": "^3.0"}}', Frontend::Vue],
    'vue as a dev dependency' => ['{"devDependencies": {"@inertiajs/vue3": "^3.0"}}', Frontend::Vue],
    'both' => ['{"dependencies": {"@inertiajs/react": "^3.0", "@inertiajs/vue3": "^3.0"}}', null],
    'neither' => ['{"dependencies": {"vue": "^3.5"}}', null],
    'invalid json' => ['{', null],
]);

it('detects nothing without a package.json', function () {
    expect(detectFrontend($this->dir, null))->toBeNull();
});

it('names the registry items, the CLI and the installed file of each framework', function () {
    expect(Frontend::React->item())->toBe('data-table-react')
        ->and(Frontend::React->filesItem())->toBe('data-table-react-files')
        ->and(Frontend::React->cliPackage())->toBe('shadcn@latest')
        ->and(Frontend::React->installedMarker())->toBe('hooks/use-server-data-table.ts')
        ->and(Frontend::Vue->item())->toBe('data-table-vue')
        ->and(Frontend::Vue->filesItem())->toBe('data-table-vue-files')
        ->and(Frontend::Vue->cliPackage())->toBe('shadcn-vue@latest')
        ->and(Frontend::Vue->installedMarker())->toBe('composables/useServerDataTable.ts');
});

it('has a registry item for each framework', function (Frontend $frontend) {
    /** @var array{items: list<array{name: string}>} $registry */
    $registry = json_decode((string) file_get_contents(__DIR__.'/../../registry.json'), true);
    $items = array_column($registry['items'], 'name');

    expect($items)->toContain($frontend->item(), $frontend->filesItem());
})->with(Frontend::cases());
