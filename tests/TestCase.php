<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Tests;

use EduardoApatat\InertiaDataTable\InertiaDataTableServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;

abstract class TestCase extends Orchestra
{
    protected function getPackageProviders($app): array
    {
        return [
            InertiaDataTableServiceProvider::class,
        ];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'testing');
    }
}
