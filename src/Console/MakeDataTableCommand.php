<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use Illuminate\Console\GeneratorCommand;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputOption;

#[AsCommand(name: 'make:datatable')]
class MakeDataTableCommand extends GeneratorCommand
{
    /**
     * @var string
     */
    protected $name = 'make:datatable';

    /**
     * @var string
     */
    protected $description = 'Create a new server-side DataTable class';

    /**
     * @var string
     */
    protected $type = 'DataTable';

    public function handle(): bool|int|null
    {
        $model = $this->modelClass();
        $result = $model === null ? false : parent::handle();
        $wantsReact = $this->option('react') || $this->wantsPage();

        // An existing class still gets the React files it lacks, so they can be added later.
        $existingTable = $model !== null && $result === false && $wantsReact
            && $this->alreadyExists($this->getNameInput());

        if ($model === null || ($result === false && ! $existingTable)) {
            // The UI does not depend on the table: --install-ui installs it even if the class is not created.
            if ($this->option('install-ui')) {
                $this->ensureUiIsInstalled($this->laravel->make(UiInstaller::class));
            }

            return $model === null ? self::FAILURE : false;
        }

        if ($wantsReact) {
            $this->writeReactComponent($model);
        }

        if ($this->wantsPage()) {
            $this->writeReactPage($model);
        }

        if (($wantsReact || $this->option('install-ui')) && ! $this->ensureUiIsInstalled($this->laravel->make(UiInstaller::class))) {
            return self::FAILURE;
        }

        $this->showNextSteps($model);

        return $result;
    }

    protected function getStub(): string
    {
        return $this->resolveStubPath('datatable.stub');
    }

    /**
     * @param  string  $rootNamespace
     */
    protected function getDefaultNamespace($rootNamespace): string
    {
        return $rootNamespace.'\\DataTables';
    }

    /**
     * @param  string  $name
     */
    protected function buildClass($name): string
    {
        /** @var class-string<Model> $model */
        $model = $this->modelClass();
        $columns = $this->guessColumns($model);

        $imports = collect([
            DataTable::class,
            Column::class,
            'Illuminate\\Database\\Eloquent\\Builder',
            $model,
            ...array_filter(array_map(fn (GuessedColumn $column): ?string => $column->enumClass, $columns)),
        ])->unique()->sort()->map(fn (string $class): string => "use {$class};")->implode("\n");

        $columnLines = $columns === []
            ? "            // Column::text('name')->searchable(),"
            : collect($columns)->map(fn (GuessedColumn $column): string => '            '.$column->toPhp().',')->implode("\n");

        return str_replace(
            ['{{ imports }}', '{{ model }}', '{{ columns }}', '{{ defaultSort }}'],
            [$imports, class_basename($model), $columnLines, $this->defaultSortMethod($columns)],
            parent::buildClass($name),
        );
    }

    /**
     * @return array<int, array<int, mixed>>
     */
    protected function getOptions(): array
    {
        return [
            ['model', 'm', InputOption::VALUE_REQUIRED, 'The model of the table (defaults to the singular of the class name)'],
            ['react', null, InputOption::VALUE_NONE, 'Also create a React component that renders the table (its columns come from the server)'],
            ['page', null, InputOption::VALUE_NONE, 'Also create the React component and an Inertia page that renders it'],
            ['defer', null, InputOption::VALUE_NONE, 'Create the page with the table deferred and a skeleton meanwhile (implies --page)'],
            ['install-ui', null, InputOption::VALUE_NONE, 'Install the data-table-react registry item if the project does not have it'],
            ['empty', null, InputOption::VALUE_NONE, 'Do not guess the columns from the model'],
            ['force', 'f', InputOption::VALUE_NONE, 'Overwrite the files if they already exist'],
        ];
    }

    /**
     * Model given with `--model` or guessed from the name: `ProductsTable` → `Product`.
     *
     * @return class-string<Model>|null
     */
    private function modelClass(): ?string
    {
        /** @var string|null $option */
        $option = $this->option('model');
        $name = $option ?? Str::singular(Str::beforeLast(class_basename($this->getNameInput()), 'Table'));
        // A fully qualified class (models outside app/Models) is used as is.
        $model = class_exists($name) ? ltrim($name, '\\') : $this->qualifyModel($name);

        if (! class_exists($model) || ! is_subclass_of($model, Model::class)) {
            $available = $this->availableModels();

            $this->components->error("Model [{$model}] does not exist. Use --model to choose one.");

            if ($available !== []) {
                $this->components->bulletList(['Available models: '.implode(', ', $available)]);
            }

            return null;
        }

        return $model;
    }

    /**
     * Eloquent models in `app/Models` (or `app/`), by short name.
     *
     * @return list<string>
     */
    private function availableModels(): array
    {
        return array_values(array_filter(
            $this->possibleModels(),
            fn (string $name): bool => is_subclass_of($this->qualifyModel($name), Model::class),
        ));
    }

    /**
     * @param  class-string<Model>  $model
     * @return list<GuessedColumn>
     */
    private function guessColumns(string $model): array
    {
        return $this->option('empty') ? [] : (new ColumnGuesser)->guess(new $model);
    }

    /**
     * @param  list<GuessedColumn>  $columns
     */
    private function defaultSortMethod(array $columns): string
    {
        $ids = array_map(fn (GuessedColumn $column): string => $column->id, $columns);
        $sort = in_array('created_at', $ids, true) ? '-created_at' : null;

        if ($sort === null) {
            return '';
        }

        return <<<PHP

    /**
     * Get the default sort of the table.
     */
    public function defaultSort(): string
    {
        return '{$sort}';
    }

PHP;
    }

    /**
     * Table component (row type, hook and DataTable), reusable in any page.
     * The table class decides the columns and their order.
     *
     * @param  class-string<Model>  $model
     */
    private function writeReactComponent(string $model): void
    {
        $names = $this->resourceNames($model);
        $columns = $this->guessColumns($model);

        $this->writeFile(
            $this->laravel->resourcePath("js/components/data-tables/{$names['file']}.tsx"),
            str_replace(
                ['{{ rowType }}', '{{ rowFields }}', '{{ prop }}', '{{ example }}', '{{ component }}', '{{ title }}'],
                [
                    $names['row'],
                    collect($columns)->map(fn (GuessedColumn $column): string => sprintf(
                        '    %s?: %s%s;',
                        $column->id,
                        match ($column->kind) {
                            'number' => 'number',
                            'number-or-string' => 'number | string',
                            'boolean' => 'boolean',
                            'boolean-or-number' => 'boolean | number',
                            default => 'string',
                        },
                        $column->nullable ? ' | null' : '',
                    ))->implode("\n"),
                    $names['prop'],
                    collect($columns)->first(fn (GuessedColumn $column): bool => in_array('searchable()', $column->calls, true))->id ?? $columns[0]->id ?? 'name',
                    $names['component'],
                    $names['title'],
                ],
                $this->files->get($this->resolveStubPath('datatable-react-component.stub')),
            ),
            'React component',
        );
    }

    /**
     * Inertia page that only renders the table component.
     *
     * @param  class-string<Model>  $model
     */
    private function writeReactPage(string $model): void
    {
        $names = $this->resourceNames($model);

        $this->writeFile(
            $this->laravel->resourcePath("js/pages/{$names['resource']}/index.tsx"),
            str_replace(
                ['{{ component }}', '{{ file }}', '{{ rowType }}', '{{ prop }}', '{{ page }}', '{{ title }}', '{{ url }}'],
                [$names['component'], $names['file'], $names['row'], $names['prop'], $names['page'], $names['title'], '/'.$names['resource']],
                $this->files->get($this->resolveStubPath($this->option('defer') ? 'datatable-react-page-deferred.stub' : 'datatable-react-page.stub')),
            ),
            'React page',
        );
    }

    private function writeFile(string $path, string $contents, string $type): void
    {
        if ($this->files->exists($path) && ! $this->option('force')) {
            $this->components->warn("{$type} [{$path}] already exists.");

            return;
        }

        $this->files->ensureDirectoryExists(dirname($path));
        $this->files->put($path, $contents);
        $this->components->info("{$type} [{$path}] created successfully.");
    }

    /**
     * The generic components (DataTable, toolbar, filters, hook) are installed once per
     * project from the registry; all tables share them.
     */
    private function ensureUiIsInstalled(UiInstaller $installer): bool
    {
        if ($installer->isInstalled()) {
            return true;
        }

        $command = $installer->installCommand();

        if (! $this->option('install-ui')) {
            $this->components->warn('The data table UI is not installed yet. Run: '.implode(' ', $command).' (or use --install-ui)');

            return true;
        }

        $this->components->info('Installing the data table UI: '.implode(' ', $command));

        if (! $installer->run($command, fn (string $type, string $output) => $this->output->write($output))) {
            $this->components->error('The data table UI could not be installed. Run the command above manually.');

            return false;
        }

        return true;
    }

    /**
     * @param  class-string<Model>  $model
     * @return array{resource: string, prop: string, component: string, file: string, page: string, title: string, row: string}
     */
    private function resourceNames(string $model): array
    {
        $plural = Str::plural(class_basename($model));

        return [
            'resource' => Str::kebab($plural),
            'prop' => Str::camel($plural),
            'component' => Str::studly($plural).'Table',
            'file' => Str::kebab($plural).'-table',
            'page' => Str::studly($plural).'Index',
            'title' => Str::headline($plural),
            'row' => class_basename($model),
        ];
    }

    private function wantsPage(): bool
    {
        return (bool) ($this->option('page') || $this->option('defer'));
    }

    /**
     * @param  class-string<Model>  $model
     */
    private function showNextSteps(string $model): void
    {
        $names = $this->resourceNames($model);
        $class = class_basename($this->qualifyClass($this->getNameInput()));

        $props = $this->option('defer')
            ? "['{$names['prop']}' => Inertia::defer(fn () => {$class}::make()), '{$names['prop']}Config' => fn () => {$class}::make()->config()]"
            : "['{$names['prop']}' => fn () => {$class}::make()]";

        $steps = [
            "Return it from a controller: Inertia::render('{$names['resource']}/index', {$props})",
            "Register a route: Route::get('{$names['resource']}', [{$names['row']}Controller::class, 'index'])->name('{$names['resource']}.index')",
        ];

        if ($this->option('react') && ! $this->wantsPage()) {
            $steps[] = "Render it in a page: <{$names['component']} {$names['prop']}={{$names['prop']}} /> from '@/components/data-tables/{$names['file']}'";
        }

        $this->components->bulletList($steps);
    }

    /**
     * Stub published in the application (`stubs/`) or the package one.
     */
    private function resolveStubPath(string $stub): string
    {
        $published = $this->laravel->basePath("stubs/{$stub}");

        return file_exists($published) ? $published : __DIR__."/../../stubs/{$stub}";
    }
}
