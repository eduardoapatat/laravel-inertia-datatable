<?php

declare(strict_types=1);

namespace InertiaDataTable\Parsing;

use InertiaDataTable\FilterItem;
use InertiaDataTable\SortItem;
use InertiaDataTable\TableDefinition;
use InertiaDataTable\TableState;

/**
 * Turns the query string into a `TableState` normalized against the table definition.
 */
final class StateParser
{
    public function __construct(private readonly FilterParser $filterParser = new FilterParser) {}

    /**
     * @param  array<array-key, mixed>  $query
     */
    public function parse(array $query, TableDefinition $definition): TableState
    {
        return new TableState(
            page: $this->parsePage($query[$definition->queryKey('page')] ?? null),
            perPage: $this->parsePerPage($query[$definition->queryKey('per_page')] ?? null, $definition),
            sorting: $this->parseSorting($query[$definition->queryKey('sort')] ?? null, $definition),
            filters: $this->parseFilters($query[$definition->queryKey('filter')] ?? null, $definition),
            search: $this->parseSearch($query[$definition->queryKey('search')] ?? null, $definition),
            visibleColumns: $this->parseColumns($query[$definition->queryKey('columns')] ?? null, $definition),
        );
    }

    private function parsePage(mixed $value): int
    {
        $page = is_string($value) ? filter_var($value, FILTER_VALIDATE_INT) : false;

        return is_int($page) && $page > 0 ? $page : 1;
    }

    private function parsePerPage(mixed $value, TableDefinition $definition): int
    {
        $perPage = is_string($value) ? filter_var($value, FILTER_VALIDATE_INT) : false;

        return is_int($perPage) && in_array($perPage, $definition->perPageOptions, true) ? $perPage : $definition->perPage;
    }

    /**
     * @return list<SortItem>
     */
    private function parseSorting(mixed $value, TableDefinition $definition): array
    {
        if (! is_string($value)) {
            return [];
        }

        $maxSorts = (int) config('inertia-datatable.max_sorts', 3);
        $sorting = [];

        foreach (SortItem::parseList($value) as $item) {
            if (count($sorting) >= $maxSorts) {
                break;
            }

            if (isset($sorting[$item->id]) || ! $definition->column($item->id)?->isSortable()) {
                continue;
            }

            $sorting[$item->id] = $item;
        }

        return array_values($sorting);
    }

    /**
     * @return list<FilterItem>
     */
    private function parseFilters(mixed $value, TableDefinition $definition): array
    {
        if (! is_array($value)) {
            return [];
        }

        $maxFilters = (int) config('inertia-datatable.max_filters', 20);
        $filters = [];

        foreach ($value as $columnId => $params) {
            $column = $definition->column((string) $columnId);

            if ($column === null || $column->filterVariant() === null) {
                continue;
            }

            foreach (is_array($params) ? $params : [$params] as $param) {
                if (! is_string($param) || count($filters) >= $maxFilters) {
                    continue;
                }

                $filter = $this->filterParser->parse($column, $param);

                if ($filter !== null) {
                    $filters[] = $filter;
                }
            }
        }

        return $filters;
    }

    private function parseSearch(mixed $value, TableDefinition $definition): string
    {
        if (! is_string($value) || ! $definition->isSearchable()) {
            return '';
        }

        return mb_substr(trim($value), 0, (int) config('inertia-datatable.max_search_length', 100));
    }

    /**
     * @return list<string>
     */
    private function parseColumns(mixed $value, TableDefinition $definition): array
    {
        $requested = is_string($value) && trim($value) !== ''
            ? array_map(trim(...), explode(',', $value))
            : null;

        $visible = [];

        foreach ($definition->columns as $id => $column) {
            $isVisible = $requested === null
                ? $column->isVisibleByDefault()
                : in_array($id, $requested, true) || ! $column->isHideable();

            if ($isVisible) {
                $visible[] = $id;
            }
        }

        return $visible;
    }
}
