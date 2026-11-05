<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use Composer\InstalledVersions;

/**
 * shadcn registry of the same version as the installed package, so the UI that gets installed
 * or updated always matches the backend: `v0.1.0` → `…/v0.1.0/r`; `dev-*` → `…/main/r`.
 */
final class RegistryUrl
{
    public const PACKAGE = 'eduardoapatat/laravel-inertia-datatable';

    public const REPOSITORY = 'https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable';

    public static function forInstalledVersion(): string
    {
        $version = InstalledVersions::isInstalled(self::PACKAGE)
            ? InstalledVersions::getPrettyVersion(self::PACKAGE)
            : null;

        return self::forVersion($version);
    }

    public static function forVersion(?string $version): string
    {
        $ref = $version !== null && preg_match('/^v?\d+\.\d+\.\d+$/', $version) === 1 ? $version : 'main';

        return self::REPOSITORY."/{$ref}/r";
    }
}
