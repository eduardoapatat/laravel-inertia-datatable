<?php

declare(strict_types=1);

namespace InertiaDataTable\Query;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder as QueryBuilder;
use InertiaDataTable\Column;
use InertiaDataTable\Columns\NumberColumn;
use InertiaDataTable\Columns\OptionColumn;
use InertiaDataTable\Enums\FilterVariant;
use InertiaDataTable\TableDefinition;
use InertiaDataTable\TableState;

/**
 * Computes what TanStack cannot compute in server mode: options with counts
 * (select / multi-select) and numeric range bounds.
 */
final class FacetResolver
{
    public function __construct(
        private readonly QueryApplier $applier = new QueryApplier,
        private readonly RelationResolver $relations = new RelationResolver,
    ) {}

    /**
     * @return array<string, list<array{value: string|null, label: string, count?: int}>|array{min: int|float|null, max: int|float|null}>
     */
    public function resolve(TableDefinition $definition, TableState $state): array
    {
        $facets = [];

        foreach ($definition->columns as $id => $column) {
            if ($column instanceof OptionColumn) {
                $options = $column->variantOfFilter() === null
                    ? $this->declaredOptions($column)
                    : $this->options($definition, $state, $column);

                if ($options !== null) {
                    $facets[$id] = $options;
                }
            } elseif ($column instanceof NumberColumn && $column->variantOfFilter() === FilterVariant::Range) {
                $facets[$id] = $this->range($definition, $column);
            }
        }

        return $facets;
    }

    /**
     * Labels of a column without a filter, so its cells show them; no query.
     *
     * @return list<array{value: string, label: string}>|null
     */
    private function declaredOptions(OptionColumn $column): ?array
    {
        $declared = $column->optionLabels();

        if ($declared === null) {
            return null;
        }

        $options = [];

        foreach ($declared as $value => $label) {
            $options[] = ['value' => (string) $value, 'label' => $label];
        }

        return $options;
    }

    /**
     * Cross count: with every filter and the search applied, except the column's own filters.
     * With `empty: true`, the rows without a value go last with `value: null`.
     *
     * @return list<array{value: string|null, label: string, count?: int}>
     */
    private function options(TableDefinition $definition, TableState $state, OptionColumn $column): array
    {
        $declared = $column->optionLabels();
        $counts = [];
        $emptyCount = 0;

        if ($column->hasCounts() || $declared === null) {
            $query = clone $definition->query;
            $this->applier->applyFilters($query, $definition, $state->filtersExcept($column->id()));
            $this->applier->applySearch($query, $definition, $state->search);
            [$counts, $emptyCount] = $this->groupedCounts($query, $column);
        }

        $labels = $declared ?? array_combine(array_keys($counts), array_map(strval(...), array_keys($counts)));

        // Selected values are always listed, even when they no longer have rows.
        foreach ($state->filtersFor($column->id()) as $filter) {
            foreach ((array) $filter->value as $value) {
                if ($value !== '' && ! array_key_exists($value, $labels)) {
                    $labels[$value] = $value;
                }
            }
        }

        $options = [];

        foreach ($labels as $value => $label) {
            $option = ['value' => (string) $value, 'label' => $label];

            if ($column->hasCounts()) {
                $option['count'] = $counts[(string) $value] ?? 0;
            }

            $options[] = $option;
        }

        if ($column->filtersEmpty()) {
            $options[] = ['value' => null, 'label' => $column->emptyLabel(), ...($column->hasCounts() ? ['count' => $emptyCount] : [])];
        }

        return $options;
    }

    /**
     * Rows per value, and the rows without a value apart.
     *
     * @param  Builder<covariant Model>  $query
     * @return array{array<string, int>, int}
     */
    private function groupedCounts(Builder $query, Column $column): array
    {
        $rows = $query->getQuery()->newQuery()
            ->fromSub($this->valueQuery($query, $column), 'facet')
            ->select('facet_value')
            ->selectRaw('count(*) as facet_count')
            ->groupBy('facet_value')
            ->orderBy('facet_value')
            ->get();

        $counts = [];
        $emptyCount = 0;

        foreach ($rows as $row) {
            /** @var object{facet_value: string|int|float|bool|null, facet_count: int|string} $row */
            if ($row->facet_value === null) {
                $emptyCount = (int) $row->facet_count;
            } else {
                $counts[(string) $row->facet_value] = (int) $row->facet_count;
            }
        }

        return [$counts, $emptyCount];
    }

    /**
     * Bounds over the base query (without filters), unless the column fixes them.
     *
     * @return array{min: int|float|null, max: int|float|null}
     */
    private function range(TableDefinition $definition, NumberColumn $column): array
    {
        if ($column->min() !== null && $column->max() !== null) {
            return ['min' => $column->min(), 'max' => $column->max()];
        }

        $query = clone $definition->query;

        /** @var object{range_min: mixed, range_max: mixed}|null $row */
        $row = $query->getQuery()->newQuery()
            ->fromSub($this->valueQuery($query, $column), 'facet')
            ->selectRaw('min(facet_value) as range_min, max(facet_value) as range_max')
            ->first();

        return [
            'min' => $column->min() ?? $this->number($row?->range_min),
            'max' => $column->max() ?? $this->number($row?->range_max),
        ];
    }

    /**
     * Scalar query exposing the column value as `facet_value`.
     *
     * @param  Builder<covariant Model>  $query
     */
    private function valueQuery(Builder $query, Column $column): QueryBuilder
    {
        $valueQuery = $column->relation() === null
            ? null
            : $this->relations->valueQuery($query, $column);

        $base = $query->toBase()->reorder();

        return $valueQuery === null
            ? $base->select($query->qualifyColumn($column->attribute()).' as facet_value')
            : $base->select([])->selectSub($valueQuery, 'facet_value');
    }

    private function number(mixed $value): int|float|null
    {
        if (! is_numeric($value)) {
            return null;
        }

        if (filter_var($value, FILTER_VALIDATE_INT) !== false) {
            return (int) $value;
        }

        // A stored overflow (SQLite keeps '1e400' as Infinity) cannot be JSON encoded and
        // would break every response of the table: treat it as a missing bound.
        $number = (float) $value;

        return is_finite($number) ? $number : null;
    }
}
