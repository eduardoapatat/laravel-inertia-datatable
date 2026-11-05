<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use Closure;
use Generator;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\Process;

/**
 * Instala o actualiza la UI genérica del DataTable desde el registro shadcn.
 */
final class UiInstaller
{
    public function __construct(
        private readonly Filesystem $files,
        private readonly Application $app,
    ) {}

    /**
     * El hook solo existe si la UI está instalada. Lo cambian la instalación y la actualización.
     *
     * @phpstan-impure
     */
    public function isInstalled(): bool
    {
        return $this->files->exists($this->app->resourcePath('js/hooks/use-server-data-table.ts'));
    }

    /**
     * Primera instalación: incluye las primitivas de shadcn que falten, sin sobrescribir las existentes.
     *
     * @return list<string>
     */
    public function installCommand(): array
    {
        return [...$this->packageRunner(), 'shadcn@latest', 'add', $this->itemUrl('data-table-react'), '-y'];
    }

    /**
     * Actualización: sobrescribe solo los archivos propios del DataTable, nunca los ui/ de shadcn.
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
        // Responde "no" a cada pregunta de sobrescribir un componente ui/ existente. Las
        // respuestas se entregan de una en una: de golpe, la CLI solo lee la primera.
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
     * Ejecutor de paquetes según el lockfile del proyecto.
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
        /** @var string $base */
        $base = config('inertia-datatable.registry_url');

        return rtrim($base, '/')."/{$item}.json";
    }
}
