<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Console;

use EduardoApatat\InertiaDataTable\Column;
use EduardoApatat\InertiaDataTable\DataTable;
use Illuminate\Console\GeneratorCommand;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
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

        if ($model === null) {
            return self::FAILURE;
        }

        $result = parent::handle();

        if ($result === false) {
            return false;
        }

        $wantsReact = $this->option('react') || $this->option('page');

        if ($wantsReact) {
            $this->writeReactComponent($model);
        }

        if ($this->option('page')) {
            $this->writeReactPage($model);
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
            ? "            // Column::make('name')->sortable()->searchable()->text(),"
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
            ['react', null, InputOption::VALUE_NONE, 'Also create a React component with the columns of the table'],
            ['page', null, InputOption::VALUE_NONE, 'Also create the React component and an Inertia page that renders it'],
            ['empty', null, InputOption::VALUE_NONE, 'Do not guess the columns from the model'],
            ['force', 'f', InputOption::VALUE_NONE, 'Overwrite the files if they already exist'],
        ];
    }

    /**
     * Modelo indicado con `--model` o deducido del nombre: `ProductsTable` → `Product`.
     *
     * @return class-string<Model>|null
     */
    private function modelClass(): ?string
    {
        /** @var string|null $option */
        $option = $this->option('model');
        $name = $option ?? Str::singular(Str::beforeLast(class_basename($this->getNameInput()), 'Table'));
        // Una clase completa (modelos fuera de app/Models) se usa tal cual.
        $model = class_exists($name) ? ltrim($name, '\\') : $this->qualifyModel($name);

        if (! class_exists($model) || ! is_subclass_of($model, Model::class)) {
            $this->components->error("Model [{$model}] does not exist. Use --model to choose one.");

            return null;
        }

        return $model;
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

        foreach ($columns as $column) {
            if ($sort === null && in_array('sortable()', $column->calls, true)) {
                $sort = $column->id;
            }
        }

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
     * Componente de la tabla (tipos, columnas, hook y DataTable), reutilizable en cualquier página.
     *
     * @param  class-string<Model>  $model
     */
    private function writeReactComponent(string $model): void
    {
        $names = $this->resourceNames($model);
        $columns = $this->guessColumns($model);
        $kinds = array_map(fn (GuessedColumn $column): string => $column->kind, $columns);

        $this->writeFile(
            $this->laravel->resourcePath("js/components/data-tables/{$names['file']}.tsx"),
            str_replace(
                ['{{ imports }}', '{{ rowType }}', '{{ rowFields }}', '{{ prop }}', '{{ columns }}', '{{ component }}', '{{ title }}'],
                [
                    $this->componentImports(in_array('option', $kinds, true), in_array('date', $kinds, true)),
                    $names['row'],
                    collect($columns)->map(fn (GuessedColumn $column): string => sprintf(
                        '    %s?: %s%s;',
                        $column->id,
                        match ($column->kind) {
                            'number' => 'number',
                            'boolean' => 'boolean',
                            default => 'string',
                        },
                        $column->nullable ? ' | null' : '',
                    ))->implode("\n"),
                    $names['prop'],
                    collect($columns)->map(fn (GuessedColumn $column): string => $this->reactColumn($column))->implode("\n"),
                    $names['component'],
                    $names['title'],
                ],
                $this->files->get($this->resolveStubPath('datatable-react-component.stub')),
            ),
            'React component',
        );
    }

    /**
     * Página de Inertia que solo renderiza el componente de la tabla.
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
                $this->files->get($this->resolveStubPath('datatable-react-page.stub')),
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

    private function componentImports(bool $usesOptions, bool $usesDates): string
    {
        $imports = [
            "import { createColumnHelper } from '@tanstack/react-table';",
            "import { DataTable } from '@/components/data-table/data-table';",
            "import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';",
            "import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';",
            $usesOptions
                ? "import {\n    getOptionLabel,\n    useServerDataTable,\n} from '@/hooks/use-server-data-table';"
                : "import { useServerDataTable } from '@/hooks/use-server-data-table';",
            "import type { DataTableFeatures } from '@/lib/data-table-features';",
        ];

        if ($usesDates) {
            $imports[] = "import { formatDate } from '@/lib/data-table-format';";
        }

        $imports[] = "import type { ServerDataTable } from '@/lib/data-table-server';";
        $imports[] = "import { cn } from '@/lib/utils';";

        return implode("\n", $imports);
    }

    private function reactColumn(GuessedColumn $column): string
    {
        $cell = match ($column->kind) {
            'boolean' => "        cell: ({ cell }) => (cell.getValue() ? 'Yes' : 'No'),\n",
            'date' => "        cell: ({ cell }) => formatDate(cell.getValue() ?? undefined),\n",
            'option' => "        cell: ({ cell, column }) =>\n            getOptionLabel(column.columnDef.meta, cell.getValue()),\n",
            default => '',
        };

        return <<<TSX
    columnHelper.accessor('{$column->id}', {
        id: '{$column->id}',
        header: ({ column }) => (
            <DataTableColumnHeader column={column} label="{$column->label}" />
        ),
{$cell}    }),
TSX;
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

    /**
     * @param  class-string<Model>  $model
     */
    private function showNextSteps(string $model): void
    {
        $names = $this->resourceNames($model);
        $class = class_basename($this->qualifyClass($this->getNameInput()));

        $steps = [
            "Return it from a controller: Inertia::render('{$names['resource']}/index', ['{$names['prop']}' => fn () => {$class}::make()])",
            "Register a route: Route::get('{$names['resource']}', [{$names['row']}Controller::class, 'index'])->name('{$names['resource']}.index')",
        ];

        if ($this->option('react') && ! $this->option('page')) {
            $steps[] = "Render it in a page: <{$names['component']} {$names['prop']}={{$names['prop']}} /> from '@/components/data-tables/{$names['file']}'";
        }

        $this->components->bulletList($steps);
    }

    /**
     * Stub publicado en la aplicación (`stubs/`) o el del paquete.
     */
    private function resolveStubPath(string $stub): string
    {
        $published = $this->laravel->basePath("stubs/{$stub}");

        return file_exists($published) ? $published : __DIR__."/../../stubs/{$stub}";
    }
}
