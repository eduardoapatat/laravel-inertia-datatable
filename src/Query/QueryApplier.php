<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Query;

use EduardoApatat\InertiaDataTable\Column;
use EduardoApatat\InertiaDataTable\Enums\FilterOperator;
use EduardoApatat\InertiaDataTable\Enums\FilterVariant;
use EduardoApatat\InertiaDataTable\FilterItem;
use EduardoApatat\InertiaDataTable\SortItem;
use EduardoApatat\InertiaDataTable\TableDefinition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Aplica filtros, búsqueda global y orden de una tabla a una consulta Eloquent.
 */
final class QueryApplier
{
    private const int MAX_SEARCH_WORDS = 10;

    public function __construct(private readonly RelationResolver $relations = new RelationResolver) {}

    /**
     * @param  Builder<Model>  $query
     * @param  list<FilterItem>  $filters
     */
    public function applyFilters(Builder $query, TableDefinition $definition, array $filters): void
    {
        foreach ($filters as $filter) {
            $column = $definition->column($filter->id);

            if ($column !== null) {
                $this->applyFilter($query, $column, $filter);
            }
        }
    }

    /**
     * Cada palabra debe aparecer en alguna columna buscable.
     *
     * @param  Builder<Model>  $query
     */
    public function applySearch(Builder $query, TableDefinition $definition, string $search): void
    {
        $columns = array_filter($definition->columns, fn (Column $column): bool => $column->isSearchable());
        $words = preg_split('/\s+/u', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $words = array_slice(array_values(array_unique($words)), 0, self::MAX_SEARCH_WORDS);

        if ($columns === [] || $words === []) {
            return;
        }

        foreach ($words as $word) {
            $query->where(function (Builder $group) use ($columns, $word): void {
                foreach ($columns as $column) {
                    $relation = $column->relation();

                    if ($relation === null) {
                        $group->orWhere(fn (Builder $where) => $this->whereContains($where, $where->qualifyColumn($column->attribute()), $word));
                    } else {
                        $group->orWhereHas($relation, fn (Builder $where) => $this->whereContains($where, $column->attribute(), $word));
                    }
                }
            });
        }
    }

    /**
     * Aplica el orden y, al final, la clave primaria como desempate para que la paginación sea estable.
     *
     * @param  Builder<Model>  $query
     * @param  list<SortItem>  $sorting
     */
    public function applySorting(Builder $query, TableDefinition $definition, array $sorting): void
    {
        $model = $query->getModel();
        $isKeySorted = false;

        if ($sorting !== []) {
            $query->reorder();
        }

        foreach ($sorting as $item) {
            $column = $definition->column($item->id);
            $direction = $item->desc ? 'desc' : 'asc';

            if ($column?->relation() !== null) {
                $query->orderBy($this->relations->valueQuery($query, $column), $direction);

                continue;
            }

            // Un orden por defecto puede usar un atributo que no es columna de la tabla.
            $attribute = $column?->attribute() ?? $item->id;
            $query->orderBy($model->qualifyColumn($attribute), $direction);
            $isKeySorted = $isKeySorted || $attribute === $model->getKeyName();
        }

        if (! $isKeySorted) {
            $query->orderBy($model->getQualifiedKeyName());
        }
    }

    /**
     * @param  Builder<Model>  $query
     */
    private function applyFilter(Builder $query, Column $column, FilterItem $filter): void
    {
        $operator = $filter->operator;
        $positive = $operator->negationOf();
        $relation = $column->relation();

        if ($relation !== null) {
            $attribute = $column->attribute();

            if ($operator === FilterOperator::IsEmpty) {
                $query->whereDoesntHave($relation, fn (Builder $where) => $this->whereNotEmpty($where, $attribute, $filter->variant));
            } elseif ($operator === FilterOperator::IsNotEmpty) {
                $query->whereHas($relation, fn (Builder $where) => $this->whereNotEmpty($where, $attribute, $filter->variant));
            } elseif ($positive !== null) {
                $query->whereDoesntHave($relation, fn (Builder $where) => $this->wherePredicate($where, $attribute, $positive, $filter));
            } else {
                $query->whereHas($relation, fn (Builder $where) => $this->wherePredicate($where, $attribute, $operator, $filter));
            }

            return;
        }

        $sqlColumn = $query->qualifyColumn($column->attribute());

        if ($operator === FilterOperator::IsEmpty) {
            $query->whereNot(fn (Builder $where) => $this->whereNotEmpty($where, $sqlColumn, $filter->variant));
        } elseif ($operator === FilterOperator::IsNotEmpty) {
            $this->whereNotEmpty($query, $sqlColumn, $filter->variant);
        } elseif ($positive !== null) {
            // Las negaciones incluyen los NULL: "no es X" también vale para lo que no tiene valor.
            $query->where(fn (Builder $where) => $where
                ->whereNot(fn (Builder $not) => $this->wherePredicate($not, $sqlColumn, $positive, $filter))
                ->orWhereNull($sqlColumn));
        } else {
            $this->wherePredicate($query, $sqlColumn, $operator, $filter);
        }
    }

    /**
     * @param  Builder<Model>  $query
     */
    private function wherePredicate(Builder $query, string $column, FilterOperator $operator, FilterItem $filter): void
    {
        $value = $filter->value;
        $variant = $filter->variant;

        match ($operator) {
            FilterOperator::ILike => $this->whereContains($query, $column, (string) (is_array($value) ? ($value[0] ?? '') : $value)),
            FilterOperator::InArray => $query->whereIn($column, (array) $value),
            FilterOperator::IsBetween => $this->whereBetween($query, $column, $variant, (array) $value),
            FilterOperator::Eq => $this->whereEquals($query, $column, $variant, (string) (is_array($value) ? ($value[0] ?? '') : $value)),
            default => $this->whereCompare($query, $column, $variant, $operator, (string) (is_array($value) ? ($value[0] ?? '') : $value)),
        };
    }

    /**
     * @param  Builder<Model>  $query
     */
    private function whereEquals(Builder $query, string $column, FilterVariant $variant, string $value): void
    {
        match (true) {
            $variant === FilterVariant::Text => $query->whereRaw('lower('.$this->wrap($query, $column).') = ?', [mb_strtolower($value)]),
            $variant->isDate() => $query->whereDate($column, '=', $value),
            $variant === FilterVariant::Boolean => $query->where($column, $value === 'true'),
            $variant->isNumeric() => $query->where($column, $this->number($value)),
            default => $query->where($column, $value),
        };
    }

    /**
     * @param  Builder<Model>  $query
     */
    private function whereCompare(Builder $query, string $column, FilterVariant $variant, FilterOperator $operator, string $value): void
    {
        $sqlOperator = match ($operator) {
            FilterOperator::Lt => '<',
            FilterOperator::Lte => '<=',
            FilterOperator::Gt => '>',
            default => '>=',
        };

        if ($variant->isDate()) {
            $query->whereDate($column, $sqlOperator, $value);
        } else {
            $query->where($column, $sqlOperator, $this->number($value));
        }
    }

    /**
     * @param  Builder<Model>  $query
     * @param  array<int, string>  $bounds
     */
    private function whereBetween(Builder $query, string $column, FilterVariant $variant, array $bounds): void
    {
        [$from, $to] = [$bounds[0] ?? '', $bounds[1] ?? ''];

        if ($from !== '') {
            $this->whereCompare($query, $column, $variant, FilterOperator::Gte, $from);
        }

        if ($to !== '') {
            $this->whereCompare($query, $column, $variant, FilterOperator::Lte, $to);
        }
    }

    /**
     * @param  Builder<Model>  $query
     */
    private function whereNotEmpty(Builder $query, string $column, FilterVariant $variant): void
    {
        $query->whereNotNull($column);

        if ($variant === FilterVariant::Text) {
            $query->where($column, '<>', '');
        }
    }

    /**
     * `LIKE %valor%` sin distinguir mayúsculas y con los comodines del usuario escapados.
     *
     * @param  Builder<Model>  $query
     */
    private function whereContains(Builder $query, string $column, string $value): void
    {
        $pattern = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value).'%';
        $wrapped = $this->wrap($query, $column);

        match ($query->getModel()->getConnection()->getDriverName()) {
            'pgsql' => $query->whereRaw("{$wrapped}::text ilike ?", [$pattern]),
            // SQLite y SQL Server no tienen carácter de escape por defecto en LIKE.
            'sqlite', 'sqlsrv' => $query->whereRaw("{$wrapped} like ? escape '\\'", [$pattern]),
            default => $query->whereLike($column, $pattern),
        };
    }

    /**
     * @param  Builder<Model>  $query
     */
    private function wrap(Builder $query, string $column): string
    {
        return $query->getQuery()->getGrammar()->wrap($column);
    }

    private function number(string $value): int|float
    {
        return filter_var($value, FILTER_VALIDATE_INT) !== false ? (int) $value : (float) $value;
    }
}
