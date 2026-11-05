<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use Composer\InstalledVersions;

/**
 * Registro shadcn de la misma versión que el paquete instalado, para que la UI que se instala
 * o actualiza coincida siempre con el backend: `v0.1.0` → `…/v0.1.0/r`; `dev-*` → `…/main/r`.
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
