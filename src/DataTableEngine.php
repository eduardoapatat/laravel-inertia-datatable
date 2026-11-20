<?php

declare(strict_types=1);

namespace InertiaDataTable;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use InertiaDataTable\Columns\OptionColumn;
use InertiaDataTable\Columns\TextColumn;
use InertiaDataTable\Enums\DatePreset;
use InertiaDataTable\Parsing\StateParser;
use InertiaDataTable\Query\ColumnValidator;
use InertiaDataTable\Query\FacetResolver;
use InertiaDataTable\Query\QueryApplier;
use InertiaDataTable\Query\RelationResolver;
use LogicException;

/**
 * Resolves a table for a request and builds the contract response (docs/contract.md).
 *
 * @phpstan-type DataTableResponse array{
 *     data: list<array<string, mixed>>,
 *     meta: array{current_page: int, per_page: int, last_page: int, total: int, from: int|null, to: int|null},
 *     state: array{
 *         pagination: array{pageIndex: int, pageSize: int},
 *         sorting: list<array{id: string, desc: bool}>,
 *         columnFilters: list<array{id: string, filterId: string, variant: string, operator: string, value: string|list<string>, range?: array{string, string}}>,
 *         join: string,
 *         globalFilter: string,
 *         columnVisibility: array<string, bool>,
 *     },
 *     facets: array<string, mixed>,
 *     config: array<string, mixed>,
 * }
 */
final class DataTableEngine
{
    public function __construct(
        private readonly StateParser $parser = new StateParser,
        private readonly QueryApplier $applier = new QueryApplier,
        private readonly FacetResolver $facets = new FacetResolver,
        private readonly RelationResolver $relations = new RelationResolver,
        private readonly ColumnValidator $validator = new ColumnValidator,
    ) {}

    /**
     * @return DataTableResponse
     */
    public function resolve(TableDefinition $definition, Request $request): array
    {
        $this->ensureRelationsAreSupported($definition);
        $validate = $this->validator->enabled();

        if ($validate) {
            $this->validator->ensureQueryColumnsExist($definition);
        }

        /** @var array<array-key, mixed> $query */
        $query = $request->query->all();
        $state = $this->parser->parse($query, $definition);

        $filtered = clone $definition->query;
        $this->applier->applyFilters($filtered, $definition, $state->filters, $state->join);
        $this->applier->applySearch($filtered, $definition, $state->search);

        $total = (clone $filtered)->toBase()->getCountForPagination();
        $lastPage = max(1, (int) ceil($total / $state->perPage));
        $page = min($state->page, $lastPage);

        $rows = clone $filtered;
        $this->applier->applySorting($rows, $definition, $state->sorting !== [] ? $state->sorting : $definition->defaultSort);

        $relations = $this->visibleRelations($definition, $state);

        if ($relations !== []) {
            $rows->with($relations);
        }

        $models = $rows->forPage($page, $state->perPage)->get();
        $first = $models->first();

        if ($validate && $first instanceof Model) {
            // With transform() only the relation columns come from the model: the rest
            // come from the transformer.
            $this->validator->ensureDisplayedColumnsExist($definition, $definition->transformer === null
                ? $state->visibleColumns
                : array_values(array_filter($state->visibleColumns, fn (string $id): bool => $definition->columns[$id]->relation() !== null)), $first);
        }

        $data = $models
            ->map(fn (Model $model): array => $this->row($definition, $state, $model))
            ->values()
            ->all();

        $from = $total === 0 ? null : ($page - 1) * $state->perPage + 1;

        return [
            'data' => $data,
            'meta' => [
                'current_page' => $page,
                'per_page' => $state->perPage,
                'last_page' => $lastPage,
                'total' => $total,
                'from' => $from,
                'to' => $from === null ? null : $from + count($data) - 1,
            ],
            'state' => [
                'pagination' => ['pageIndex' => $page - 1, 'pageSize' => $state->perPage],
                'sorting' => array_map(fn (SortItem $item): array => $item->toArray(), $state->sorting),
                'columnFilters' => $this->columnFilters($state),
                'join' => $state->join->value,
                'globalFilter' => $state->search,
                'columnVisibility' => array_map(
                    fn (Column $column): bool => in_array($column->id(), $state->visibleColumns, true),
                    $definition->columns,
                ),
            ],
            'facets' => $this->facets->resolve($definition, $state),
            'config' => $this->config($definition),
        ];
    }

    /**
     * Configuration of the table (columns, texts, locale, page sizes and query
     * keys) without running any query: enough to draw a skeleton of the table
     * while its data is deferred.
     *
     * @return array<string, mixed>
     */
    public function config(TableDefinition $definition): array
    {
        return [
            'columns' => array_values(array_map(
                fn (Column $column): array => $this->relations->isToMany($definition->query->getModel(), $column)
                    ? [...$column->toConfig(), 'multiple' => true]
                    : $column->toConfig(),
                $definition->columns,
            )),
            'searchable' => $definition->isSearchable(),
            'locale' => $this->locale($definition),
            'date_format' => $this->dateFormat(),
            'messages' => $this->messages(),
            'per_page' => $definition->perPage,
            'per_page_options' => $definition->perPageOptions,
            'default_sorting' => array_map(fn (SortItem $item): array => $item->toArray(), $definition->defaultSort),
            'max_sorts' => (int) config('inertia-datatable.max_sorts', 3),
            'max_filters' => (int) config('inertia-datatable.max_filters', 20),
            'query' => [
                'page' => $definition->queryKey('page'),
                'per_page' => $definition->queryKey('per_page'),
                'sort' => $definition->queryKey('sort'),
                'filter' => $definition->queryKey('filter'),
                'search' => $definition->queryKey('search'),
                'columns' => $definition->queryKey('columns'),
                'join' => $definition->queryKey('join'),
            ],
        ];
    }

    /**
     * Locale to format numbers and dates: the table one, the configured one or
     * the app locale; `browser` leaves it to each browser (null).
     */
    private function locale(TableDefinition $definition): ?string
    {
        $locale = $definition->locale ?? config('inertia-datatable.locale') ?? app()->getLocale();

        return $locale === 'browser' ? null : str_replace('_', '-', (string) $locale);
    }

    /**
     * UI texts in the app language (lang/vendor/inertia-datatable when published),
     * falling back to English when the language has no file.
     *
     * @return array<string, string>
     */
    private function messages(): array
    {
        $messages = trans('inertia-datatable::ui');

        if (! is_array($messages)) {
            $messages = trans('inertia-datatable::ui', [], 'en');
        }

        if (! is_array($messages)) {
            return [];
        }

        /** @var array<string, string> $messages */
        return $messages;
    }

    /**
     * Date format of the date columns without `->format()`.
     */
    private function dateFormat(): string
    {
        return DatePreset::ensure((string) config('inertia-datatable.date_format', 'long'), 'The inertia-datatable.date_format')->value;
    }

    /**
     * Fails as soon as a column uses a relation that is not supported, even if it is only
     * displayed. A to-many column holds a list of values: only option and text columns,
     * and it cannot be sorted.
     */
    private function ensureRelationsAreSupported(TableDefinition $definition): void
    {
        $model = $definition->query->getModel();
        $defaultSort = array_map(fn (SortItem $item): string => $item->id, $definition->defaultSort);

        foreach ($definition->columns as $column) {
            if (! $this->relations->isToMany($model, $column)) {
                continue;
            }

            $problem = match (true) {
                ! $column instanceof OptionColumn && ! $column instanceof TextColumn => 'only option and text columns can hold a list of values.',
                $column->isSortable() => 'it cannot be sortable: a row has several values.',
                in_array($column->id(), $defaultSort, true) => 'it cannot be in the default sort: a row has several values.',
                default => null,
            };

            if ($problem !== null) {
                throw new LogicException(sprintf('The column [%s] uses the to-many relation [%s], so %s', $column->id(), $column->relation(), $problem));
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function row(TableDefinition $definition, TableState $state, Model $model): array
    {
        if ($definition->transformer !== null) {
            $row = ($definition->transformer)($model);

            // The keys of alwaysInclude() stay, like without transform(): the client needs
            // the primary key of each row also when its column is hidden.
            foreach (array_diff(array_keys($definition->columns), $state->visibleColumns, $definition->alwaysInclude) as $hiddenId) {
                unset($row[$hiddenId]);
            }

            // A relation column keeps the value the transformer gives it; when it gives
            // none (or the related model itself, as `$model->toArray()` does), it gets the
            // value of the relation, as without transform().
            foreach ($state->visibleColumns as $id) {
                $column = $definition->columns[$id];

                if ($column->relation() !== null && ! $this->isCellValue($row[$id] ?? null)) {
                    $row[$id] = $this->relationValue($model, $column);
                }
            }

            return $row;
        }

        $attributes = $model->toArray();
        $row = [];

        foreach ($definition->alwaysInclude as $key) {
            $row[$key] = $attributes[$key] ?? null;
        }

        foreach ($state->visibleColumns as $id) {
            $column = $definition->columns[$id];
            $relation = $column->relation();

            if ($relation === null) {
                $row[$id] = $attributes[$column->attribute()] ?? null;

                continue;
            }

            $row[$id] = $this->relationValue($model, $column);
        }

        return $row;
    }

    /**
     * The value of a relation column: the attribute of the related model, or the list
     * of distinct values of a to-many relation.
     */
    private function relationValue(Model $model, Column $column): mixed
    {
        $related = $model->getRelation((string) $column->relation());

        return match (true) {
            $related instanceof Model => $related->toArray()[$column->attribute()] ?? null,
            // To-many: the distinct values, in the order of the relation, without empty ones.
            $related instanceof Collection => $related
                ->map(fn (Model $item): mixed => $item->toArray()[$column->attribute()] ?? null)
                ->reject(fn (mixed $value): bool => $value === null || $value === '')
                ->unique()
                ->values()
                ->all(),
            default => null,
        };
    }

    /** A value a cell can show: a scalar or a list of scalars, not a related model. */
    private function isCellValue(mixed $value): bool
    {
        return is_scalar($value)
            || (is_array($value) && array_is_list($value) && array_filter($value, fn (mixed $item): bool => ! is_scalar($item)) === []);
    }

    /**
     * @return list<string>
     */
    private function visibleRelations(TableDefinition $definition, TableState $state): array
    {
        $relations = [];

        foreach ($state->visibleColumns as $id) {
            $relation = $definition->columns[$id]->relation();

            if ($relation !== null) {
                $relations[$relation] = $relation;
            }
        }

        return array_values($relations);
    }

    /**
     * @return list<array{id: string, filterId: string, variant: string, operator: string, value: string|list<string>, range?: array{string, string}}>
     */
    private function columnFilters(TableState $state): array
    {
        $indexes = [];
        $filters = [];

        foreach ($state->filters as $filter) {
            $index = $indexes[$filter->id] ?? 0;
            $indexes[$filter->id] = $index + 1;
            $filters[] = $filter->toArray($index);
        }

        return $filters;
    }
}
