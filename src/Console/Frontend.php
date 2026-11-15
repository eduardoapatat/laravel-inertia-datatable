<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use Illuminate\Filesystem\Filesystem;

/**
 * UI framework of the project: what the registry installs and what
 * `make:datatable` writes for it.
 */
enum Frontend: string
{
    case React = 'react';
    case Vue = 'vue';

    /**
     * The framework of the app's Inertia adapter in `package.json`, or null when
     * it has none or both.
     */
    public static function detect(Filesystem $files, string $basePath): ?self
    {
        $path = $basePath.DIRECTORY_SEPARATOR.'package.json';

        if (! $files->exists($path)) {
            return null;
        }

        /** @var mixed $package */
        $package = json_decode($files->get($path), true);

        if (! is_array($package)) {
            return null;
        }

        $dependencies = [
            ...(is_array($package['dependencies'] ?? null) ? $package['dependencies'] : []),
            ...(is_array($package['devDependencies'] ?? null) ? $package['devDependencies'] : []),
        ];

        $found = array_values(array_filter(
            self::cases(),
            fn (self $frontend): bool => array_key_exists($frontend->inertiaPackage(), $dependencies),
        ));

        return count($found) === 1 ? $found[0] : null;
    }

    public function label(): string
    {
        return match ($this) {
            self::React => 'React',
            self::Vue => 'Vue',
        };
    }

    public function inertiaPackage(): string
    {
        return match ($this) {
            self::React => '@inertiajs/react',
            self::Vue => '@inertiajs/vue3',
        };
    }

    /**
     * The shadcn CLI of the framework.
     */
    public function cliPackage(): string
    {
        return match ($this) {
            self::React => 'shadcn@latest',
            self::Vue => 'shadcn-vue@latest',
        };
    }

    /**
     * Registry item of the first install, with the missing shadcn primitives.
     */
    public function item(): string
    {
        return "data-table-{$this->value}";
    }

    /**
     * Registry item of the update: only the data table's own files.
     */
    public function filesItem(): string
    {
        return "data-table-{$this->value}-files";
    }

    /**
     * File that only exists when the UI is installed, relative to `resources/js`.
     */
    public function installedMarker(): string
    {
        return match ($this) {
            self::React => 'hooks/use-server-data-table.ts',
            self::Vue => 'composables/useServerDataTable.ts',
        };
    }

    /**
     * Files of older versions of the UI that the registry no longer has, relative
     * to `resources/js`. shadcn never deletes a file, and an old one would still
     * import what the new ones removed, breaking the build of the app.
     *
     * @return list<string>
     */
    public function obsoleteFiles(): array
    {
        return match ($this) {
            self::React => ['lib/data-table-filters.ts'],
            self::Vue => [],
        };
    }

    /**
     * What `inertia-datatable:ui --update` overwrites.
     */
    public function updatedFiles(): string
    {
        return match ($this) {
            self::React => 'components/data-table/*, components/ui/faceted.tsx, hooks/use-server-data-table.ts and lib/data-table-*.ts',
            self::Vue => 'components/data-table/*, components/ui/faceted/*, composables/useServerDataTable.ts and lib/data-table-*.ts',
        };
    }
}
