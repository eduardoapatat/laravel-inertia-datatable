<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable;

/**
 * Estado de la tabla pedido en la request, ya normalizado.
 */
final readonly class TableState
{
    /**
     * @param  list<SortItem>  $sorting  Orden pedido explícitamente (vacío si no hay).
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
     * Filtros de todas las columnas salvo una (para los conteos cruzados).
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
