<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Query;

use EduardoApatat\InertiaDataTable\Column;
use EduardoApatat\InertiaDataTable\Enums\FilterVariant;
use EduardoApatat\InertiaDataTable\TableDefinition;
use EduardoApatat\InertiaDataTable\TableState;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Calcula lo que TanStack no puede calcular en modo servidor: opciones con conteo
 * (select / multi-select) y límites de los rangos numéricos.
 */
final class FacetResolver
{
    public function __construct(
        private readonly QueryApplier $applier = new QueryApplier,
        private readonly RelationResolver $relations = new RelationResolver,
    ) {}

    /**
     * @return array<string, list<array{value: string, label: string, count?: int}>|array{min: int|float|null, max: int|float|null}>
     */
    public function resolve(TableDefinition $definition, TableState $state): array
    {
        $facets = [];

        foreach ($definition->columns as $id => $column) {
            $variant = $column->filterVariant();

            if ($variant?->hasOptions()) {
                $facets[$id] = $this->options($definition, $state, $column);
            } elseif ($variant === FilterVariant::Range) {
                $facets[$id] = $this->range($definition, $column);
            }
        }

        return $facets;
    }

    /**
     * Conteo cruzado: con todos los filtros y la búsqueda, salvo los de la propia columna.
     *
     * @return list<array{value: string, label: string, count?: int}>
     */
    private function options(TableDefinition $definition, TableState $state, Column $column): array
    {
        $declared = $column->options();
        $counts = [];

        if ($column->hasCounts() || $declared === null) {
            $query = clone $definition->query;
            $this->applier->applyFilters($query, $definition, $state->filtersExcept($column->id()));
            $this->applier->applySearch($query, $definition, $state->search);
            $counts = $this->groupedCounts($query, $column);
        }

        $labels = $declared ?? array_combine(array_keys($counts), array_map(strval(...), array_keys($counts)));

        // Los valores seleccionados se muestran siempre, aunque ya no tengan filas.
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

        return $options;
    }

    /**
     * @param  Builder<Model>  $query
     * @return array<string, int>
     */
    private function groupedCounts(Builder $query, Column $column): array
    {
        $rows = $query->getQuery()->newQuery()
            ->fromSub($this->valueQuery($query, $column), 'facet')
            ->select('facet_value')
            ->selectRaw('count(*) as facet_count')
            ->whereNotNull('facet_value')
            ->groupBy('facet_value')
            ->orderBy('facet_value')
            ->get();

        $counts = [];

        foreach ($rows as $row) {
            /** @var object{facet_value: string|int|float|bool, facet_count: int|string} $row */
            $counts[(string) $row->facet_value] = (int) $row->facet_count;
        }

        return $counts;
    }

    /**
     * Límites sobre la consulta base (sin filtros), salvo los fijados en la columna.
     *
     * @return array{min: int|float|null, max: int|float|null}
     */
    private function range(TableDefinition $definition, Column $column): array
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
     * Consulta escalar que expone el valor de la columna como `facet_value`.
     *
     * @param  Builder<Model>  $query
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

        return filter_var($value, FILTER_VALIDATE_INT) !== false ? (int) $value : (float) $value;
    }
}
