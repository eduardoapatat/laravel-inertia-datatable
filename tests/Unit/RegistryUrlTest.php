<?php

declare(strict_types=1);

use InertiaDataTable\Console\RegistryUrl;

it('uses the registry of the installed tag', function (string $version) {
    expect(RegistryUrl::forVersion($version))->toBe(RegistryUrl::REPOSITORY."/{$version}/r");
})->with(['v0.1.0', '1.2.3']);

it('uses main for development versions', function (?string $version) {
    expect(RegistryUrl::forVersion($version))->toBe(RegistryUrl::REPOSITORY.'/main/r');
})->with(['dev-main', 'dev-feature', '1.0.x-dev', 'v1.0.0-beta.1', null]);
