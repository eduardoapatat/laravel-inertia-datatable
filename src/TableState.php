<?php

declare(strict_types=1);

namespace InertiaDataTable;

/**
 * Table state requested in the request, already normalized.
 */
final readonly class TableState
{
    /**
     * @param  list<SortItem>  $sorting  Sorting explicitly requested (empty when there is none).
     * @param  list<FilterItem>  $filters
     * @param  list<string>  $visibleColumns
     */
    public function __construct(
        public int $page,
        public int $perPage,
        public array $sorting,
        public array $filters,
        public string $search,
        public array $visibleColumns,
    ) {}

    /**
     * Filters of every column except one (for the cross counts).
     *
     * @return list<FilterItem>
     */
    public function filtersExcept(string $columnId): array
    {
        return array_values(array_filter($this->filters, fn (FilterItem $filter): bool => $filter->id !== $columnId));
    }

    /**
     * @return list<FilterItem>
     */
    public function filtersFor(string $columnId): array
    {
        return array_values(array_filter($this->filters, fn (FilterItem $filter): bool => $filter->id === $columnId));
    }
}
