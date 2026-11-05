<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

use function Pest\Laravel\artisan;

afterEach(function () {
    File::delete(resource_path('js/hooks/use-server-data-table.ts'));
});

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
        'https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/main/r/data-table-react.json', '-y',
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
        'https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/main/r/data-table-react-files.json', '-y', '--overwrite',
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
