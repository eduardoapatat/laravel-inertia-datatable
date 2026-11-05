<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable;

use EduardoApatat\InertiaDataTable\Console\MakeDataTableCommand;
use EduardoApatat\InertiaDataTable\Console\UiCommand;
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

            $this->publishes([
                __DIR__.'/../stubs/datatable.stub' => base_path('stubs/datatable.stub'),
                __DIR__.'/../stubs/datatable-react-component.stub' => base_path('stubs/datatable-react-component.stub'),
                __DIR__.'/../stubs/datatable-react-page.stub' => base_path('stubs/datatable-react-page.stub'),
            ], 'inertia-datatable-stubs');

            $this->commands([MakeDataTableCommand::class, UiCommand::class]);
        }
    }
}
