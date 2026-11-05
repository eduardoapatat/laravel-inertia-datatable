<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use Closure;
use Generator;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\Process;

/**
 * Installs or updates the generic DataTable UI from the shadcn registry.
 */
final class UiInstaller
{
    public function __construct(
        private readonly Filesystem $files,
        private readonly Application $app,
    ) {}

    /**
     * The hook only exists when the UI is installed. Installing and updating change it.
     *
     * @phpstan-impure
     */
    public function isInstalled(): bool
    {
        return $this->files->exists($this->app->resourcePath('js/hooks/use-server-data-table.ts'));
    }

    /**
     * First install: includes the missing shadcn primitives without overwriting the existing ones.
     *
     * @return list<string>
     */
    public function installCommand(): array
    {
        return [...$this->packageRunner(), 'shadcn@latest', 'add', $this->itemUrl('data-table-react'), '-y'];
    }

    /**
     * Update: overwrites only the DataTable's own files, never the shadcn ui/ ones.
     *
     * @return list<string>
     */
    public function updateCommand(): array
    {
        return [...$this->packageRunner(), 'shadcn@latest', 'add', $this->itemUrl('data-table-react-files'), '-y', '--overwrite'];
    }

    /**
     * @param  list<string>  $command
     * @param  Closure(string, string): void  $output
     */
    public function run(array $command, Closure $output): bool
    {
        // Answers "no" to every prompt to overwrite an existing ui/ component. The answers are
        // fed one at a time: all at once, the CLI only reads the first one.
        $result = Process::path($this->app->basePath())
            ->input($this->declineEveryPrompt())
            ->timeout(600)
            ->run($command, $output);

        return $result->successful() && $this->isInstalled();
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
            $this->files->exists($this->app->basePath('pnpm-lock.yaml')) => ['pnpm', 'dlx'],
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
