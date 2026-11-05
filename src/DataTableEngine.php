<?php

declare(strict_types=1);

namespace InertiaDataTable;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use InertiaDataTable\Parsing\StateParser;
use InertiaDataTable\Query\FacetResolver;
use InertiaDataTable\Query\QueryApplier;
use InertiaDataTable\Query\RelationResolver;

/**
 * Resolves a table for a request and builds the contract response (docs/contract.md).
 *
 * @phpstan-type DataTableResponse array{
 *     data: list<array<string, mixed>>,
 *     meta: array{current_page: int, per_page: int, last_page: int, total: int, from: int|null, to: int|null},
 *     state: array{
 *         pagination: array{pageIndex: int, pageSize: int},
 *         sorting: list<array{id: string, desc: bool}>,
 *         columnFilters: list<array{id: string, filterId: string, variant: string, operator: string, value: string|list<string>}>,
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
    ) {}

    /**
     * @return DataTableResponse
     */
    public function resolve(TableDefinition $definition, Request $request): array
    {
        $this->ensureRelationsAreToOne($definition);

        /** @var array<array-key, mixed> $query */
        $query = $request->query->all();
        $state = $this->parser->parse($query, $definition);

        $filtered = clone $definition->query;
        $this->applier->applyFilters($filtered, $definition, $state->filters);
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

        $data = $rows->forPage($page, $state->perPage)->get()
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
                'globalFilter' => $state->search,
                'columnVisibility' => array_map(
                    fn (Column $column): bool => in_array($column->id(), $state->visibleColumns, true),
                    $definition->columns,
                ),
            ],
            'facets' => $this->facets->resolve($definition, $state),
            'config' => [
                'columns' => array_values(array_map(fn (Column $column): array => $column->toConfig(), $definition->columns)),
                'searchable' => $definition->isSearchable(),
                'per_page' => $definition->perPage,
                'per_page_options' => $definition->perPageOptions,
                'default_sorting' => array_map(fn (SortItem $item): array => $item->toArray(), $definition->defaultSort),
                'query' => [
                    'page' => $definition->queryKey('page'),
                    'per_page' => $definition->queryKey('per_page'),
                    'sort' => $definition->queryKey('sort'),
                    'filter' => $definition->queryKey('filter'),
                    'search' => $definition->queryKey('search'),
                    'columns' => $definition->queryKey('columns'),
                ],
            ],
        ];
    }

    /**
     * Fails as soon as a column of a to-many relation is declared, even if it is only displayed.
     */
    private function ensureRelationsAreToOne(TableDefinition $definition): void
    {
        $model = $definition->query->getModel();

        foreach ($definition->columns as $column) {
            if ($column->relation() !== null) {
                $this->relations->relation($model, $column);
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

            foreach (array_diff(array_keys($definition->columns), $state->visibleColumns) as $hiddenId) {
                unset($row[$hiddenId]);
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

            $related = $model->getRelation($relation);
            $row[$id] = $related instanceof Model ? ($related->toArray()[$column->attribute()] ?? null) : null;
        }

        return $row;
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
     * @return list<array{id: string, filterId: string, variant: string, operator: string, value: string|list<string>}>
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
