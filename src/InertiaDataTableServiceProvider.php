<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable;

use Illuminate\Support\ServiceProvider;

class InertiaDataTableServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/inertia-datatable.php', 'inertia-datatable');
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../config/inertia-datatable.php' => config_path('inertia-datatable.php'),
            ], 'inertia-datatable-config');
        }
    }
}
