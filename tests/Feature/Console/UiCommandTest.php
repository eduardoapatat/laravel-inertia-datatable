<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use InertiaDataTable\Console\RegistryUrl;
use InertiaDataTable\Console\UiInstaller;

use function Pest\Laravel\artisan;

afterEach(function () {
    File::delete(resource_path('js/hooks/use-server-data-table.ts'));
    File::delete(resource_path('js/lib/data-table-filters.ts'));
});

function putObsoleteFile(): string
{
    File::ensureDirectoryExists(resource_path('js/lib'));
    File::put($path = resource_path('js/lib/data-table-filters.ts'), '// old');

    return $path;
}

function installUiFiles(): void
{
    File::ensureDirectoryExists(resource_path('js/hooks'));
    File::put(resource_path('js/hooks/use-server-data-table.ts'), '');
}

it('installs the data table UI when the project does not have it', function () {
    Process::fake(function () {
        installUiFiles();

        return Process::result();
    });

    artisan('inertia-datatable:ui')->assertSuccessful();

    Process::assertRan(fn ($process) => $process->command === [
        'npx', 'shadcn@latest', 'add',
        RegistryUrl::forInstalledVersion().'/data-table-react.json', '-y',
    ]);
});

it('does not install the data table UI again', function () {
    installUiFiles();
    Process::fake();

    artisan('inertia-datatable:ui')
        ->expectsOutputToContain('already installed')
        ->assertSuccessful();

    Process::assertNothingRan();
});

it('updates only the data table files after confirming', function () {
    installUiFiles();
    Process::fake();

    artisan('inertia-datatable:ui', ['--update' => true])
        ->expectsConfirmation('Update the data table UI?', 'yes')
        ->assertSuccessful();

    Process::assertRan(fn ($process) => $process->command === [
        'npx', 'shadcn@latest', 'add',
        RegistryUrl::forInstalledVersion().'/data-table-react-files.json', '-y', '--overwrite',
    ]);
});

it('does not update the data table files when the confirmation is declined', function () {
    installUiFiles();
    Process::fake();

    artisan('inertia-datatable:ui', ['--update' => true])
        ->expectsConfirmation('Update the data table UI?', 'no')
        ->assertFailed();

    Process::assertNothingRan();
});

it('updates without asking with the force option', function () {
    installUiFiles();
    Process::fake();

    artisan('inertia-datatable:ui', ['--update' => true, '--force' => true])->assertSuccessful();

    Process::assertRanTimes(fn ($process) => in_array('--overwrite', $process->command, true), 1);
});

it('deletes the files the new version no longer has after updating', function () {
    installUiFiles();
    $obsolete = putObsoleteFile();
    Process::fake();

    artisan('inertia-datatable:ui', ['--update' => true, '--force' => true])
        ->expectsOutputToContain('Deleted resources/js/lib/data-table-filters.ts')
        ->assertSuccessful();

    expect(File::exists($obsolete))->toBeFalse();
});

it('updates without obsolete files to delete', function () {
    installUiFiles();
    Process::fake();

    artisan('inertia-datatable:ui', ['--update' => true, '--force' => true])
        ->doesntExpectOutputToContain('Deleted')
        ->assertSuccessful();
});

it('keeps the obsolete files when the update fails', function () {
    installUiFiles();
    $obsolete = putObsoleteFile();
    Process::fake(fn () => Process::result(exitCode: 1));

    artisan('inertia-datatable:ui', ['--update' => true, '--force' => true])->assertFailed();

    expect(File::exists($obsolete))->toBeTrue();
});

it('reads the registry url from the environment', function () {
    putenv('INERTIA_DATATABLE_REGISTRY_URL=/ci/checkout/r');

    try {
        $config = require __DIR__.'/../../../config/inertia-datatable.php';
    } finally {
        putenv('INERTIA_DATATABLE_REGISTRY_URL');
    }

    expect($config['registry_url'])->toBe('/ci/checkout/r');
});

it('prefers the configured registry over the installed version', function () {
    config(['inertia-datatable.registry_url' => '/ci/checkout/r/']);

    expect(app(UiInstaller::class)->installCommand())->toContain('/ci/checkout/r/data-table-react.json');
});
