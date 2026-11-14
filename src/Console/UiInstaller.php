<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use Closure;
use Generator;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\Process;

/**
 * Installs or updates the generic DataTable UI from the shadcn registry, with the
 * shadcn CLI of the project's framework (React or Vue).
 */
final class UiInstaller
{
    public function __construct(
        private readonly Filesystem $files,
        private readonly Application $app,
    ) {}

    /**
     * The framework of the app's Inertia adapter; React when `package.json` does
     * not tell.
     */
    public function detectFrontend(): Frontend
    {
        return Frontend::detect($this->files, $this->app->basePath()) ?? Frontend::React;
    }

    /**
     * The hook (or composable) only exists when the UI is installed. Installing and
     * updating change it.
     *
     * @phpstan-impure
     */
    public function isInstalled(Frontend $frontend): bool
    {
        return $this->files->exists($this->app->resourcePath('js/'.$frontend->installedMarker()));
    }

    /**
     * First install: includes the missing shadcn primitives without overwriting the existing ones.
     *
     * @return list<string>
     */
    public function installCommand(Frontend $frontend): array
    {
        return [...$this->packageRunner(), $frontend->cliPackage(), 'add', $this->itemUrl($frontend->item()), '-y'];
    }

    /**
     * Update: overwrites only the DataTable's own files, never the shadcn ui/ ones.
     *
     * @return list<string>
     */
    public function updateCommand(Frontend $frontend): array
    {
        return [...$this->packageRunner(), $frontend->cliPackage(), 'add', $this->itemUrl($frontend->filesItem()), '-y', '--overwrite'];
    }

    /**
     * Deletes the files of older versions that the registry no longer has.
     *
     * @return list<string> The deleted files, relative to `resources/js`.
     */
    public function deleteObsoleteFiles(Frontend $frontend): array
    {
        $deleted = [];

        foreach ($frontend->obsoleteFiles() as $file) {
            $path = $this->app->resourcePath('js/'.$file);

            if ($this->files->exists($path) && $this->files->delete($path)) {
                $deleted[] = $file;
            }
        }

        return $deleted;
    }

    /**
     * @param  list<string>  $command
     * @param  Closure(string, string): void  $output
     */
    public function run(array $command, Closure $output, Frontend $frontend): bool
    {
        // Answers "no" to every prompt to overwrite an existing ui/ component. The answers are
        // fed one at a time: all at once, the CLI only reads the first one.
        $result = Process::path($this->app->basePath())
            ->input($this->declineEveryPrompt())
            ->timeout(600)
            ->run($command, $output);

        return $result->successful() && $this->isInstalled($frontend);
    }

    /**
     * @return Generator<int, string>
     */
    private function declineEveryPrompt(): Generator
    {
        while (true) {
            yield "n\n";
        }
    }

    /**
     * Package runner of the project's lockfile.
     *
     * @return list<string>
     */
    private function packageRunner(): array
    {
        return match (true) {
            // A project just created with pnpm may have no lockfile yet.
            $this->files->exists($this->app->basePath('pnpm-lock.yaml')), $this->files->exists($this->app->basePath('pnpm-workspace.yaml')) => ['pnpm', 'dlx'],
            $this->files->exists($this->app->basePath('bun.lock')), $this->files->exists($this->app->basePath('bun.lockb')) => ['bunx'],
            $this->files->exists($this->app->basePath('yarn.lock')) => ['yarn', 'dlx'],
            default => ['npx'],
        };
    }

    private function itemUrl(string $item): string
    {
        /** @var string|null $configured */
        $configured = config('inertia-datatable.registry_url');
        $base = $configured ?? RegistryUrl::forInstalledVersion();

        return rtrim($base, '/')."/{$item}.json";
    }
}
