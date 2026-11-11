<?php

declare(strict_types=1);

namespace InertiaDataTable;

use Illuminate\Support\ServiceProvider;
use InertiaDataTable\Console\MakeDataTableCommand;
use InertiaDataTable\Console\UiCommand;

class InertiaDataTableServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/inertia-datatable.php', 'inertia-datatable');
    }

    public function boot(): void
    {
        $this->loadTranslationsFrom(__DIR__.'/../lang', 'inertia-datatable');

        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../config/inertia-datatable.php' => config_path('inertia-datatable.php'),
            ], 'inertia-datatable-config');

            $this->publishes([
                __DIR__.'/../lang' => $this->app->langPath('vendor/inertia-datatable'),
            ], 'inertia-datatable-lang');

            $this->publishes([
                __DIR__.'/../stubs/datatable.stub' => base_path('stubs/datatable.stub'),
                __DIR__.'/../stubs/datatable-react-component.stub' => base_path('stubs/datatable-react-component.stub'),
                __DIR__.'/../stubs/datatable-react-page.stub' => base_path('stubs/datatable-react-page.stub'),
                __DIR__.'/../stubs/datatable-react-page-deferred.stub' => base_path('stubs/datatable-react-page-deferred.stub'),
            ], 'inertia-datatable-stubs');

            $this->commands([MakeDataTableCommand::class, UiCommand::class]);
        }
    }
}
