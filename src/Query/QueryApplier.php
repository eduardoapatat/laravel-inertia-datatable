<?php

declare(strict_types=1);

namespace InertiaDataTable\Query;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use InertiaDataTable\Column;
use InertiaDataTable\Enums\FilterOperator;
use InertiaDataTable\Enums\FilterVariant;
use InertiaDataTable\FilterItem;
use InertiaDataTable\SortItem;
use InertiaDataTable\TableDefinition;

/**
 * Applies the filters, global search and sorting of a table to an Eloquent query.
 */
final class QueryApplier
{
    private const int MAX_SEARCH_WORDS = 10;

    public function __construct(private readonly RelationResolver $relations = new RelationResolver) {}

    /**
     * The filters of a column are combined with AND, except `is.empty`, which
     * adds the rows without a value: `(between AND …) OR IS NULL`.
     *
     * @param  Builder<covariant Model>  $query
     * @param  list<FilterItem>  $filters
     */
    public function applyFilters(Builder $query, TableDefinition $definition, array $filters): void
    {
        $byColumn = [];

        foreach ($filters as $filter) {
            $byColumn[$filter->id][] = $filter;
        }

        foreach ($byColumn as $id => $items) {
            $column = $definition->column((string) $id);

            if ($column === null) {
                continue;
            }

            $empty = array_values(array_filter($items, fn (FilterItem $item): bool => $item->operator === FilterOperator::IsEmpty));
            $values = array_values(array_filter($items, fn (FilterItem $item): bool => $item->operator !== FilterOperator::IsEmpty));

            if ($empty === [] || $values === []) {
                foreach ($items as $filter) {
                    $this->applyFilter($query, $column, $filter);
                }

                continue;
            }

            $query->where(fn (Builder $group) => $group
                ->where(function (Builder $matching) use ($column, $values): void {
                    foreach ($values as $filter) {
                        $this->applyFilter($matching, $column, $filter);
                    }
                })
                ->orWhere(fn (Builder $none) => $this->applyFilter($none, $column, $empty[0])));
        }
    }

    /**
     * Every word must appear in some searchable column.
     *
     * @param  Builder<covariant Model>  $query
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
     * Applies the sorting and, last, the primary key as a tiebreaker so pagination is stable.
     * The tiebreaker follows the direction of the first sort: with `-created_at`, newest first.
     *
     * @param  Builder<covariant Model>  $query
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

            // A default sort may use an attribute that is not a column of the table.
            $attribute = $column?->attribute() ?? $item->id;
            $query->orderBy($model->qualifyColumn($attribute), $direction);
            $isKeySorted = $isKeySorted || $attribute === $model->getKeyName();
        }

        if (! $isKeySorted) {
            $query->orderBy($model->getQualifiedKeyName(), ($sorting[0] ?? null)?->desc ? 'desc' : 'asc');
        }
    }

    /**
     * @param  Builder<covariant Model>  $query
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
            // Negations include NULL: "is not X" also matches rows without a value.
            $query->where(fn (Builder $where) => $where
                ->whereNot(fn (Builder $not) => $this->wherePredicate($not, $sqlColumn, $positive, $filter))
                ->orWhereNull($sqlColumn));
        } else {
            $this->wherePredicate($query, $sqlColumn, $operator, $filter);
        }
    }

    /**
     * @param  Builder<covariant Model>  $query
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
     * @param  Builder<covariant Model>  $query
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
     * @param  Builder<covariant Model>  $query
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
     * @param  Builder<covariant Model>  $query
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
     * @param  Builder<covariant Model>  $query
     */
    private function whereNotEmpty(Builder $query, string $column, FilterVariant $variant): void
    {
        $query->whereNotNull($column);

        if ($variant === FilterVariant::Text) {
            $query->where($column, '<>', '');
        }
    }

    /**
     * Case-insensitive `LIKE %value%` with the user's wildcards escaped.
     *
     * @param  Builder<covariant Model>  $query
     */
    private function whereContains(Builder $query, string $column, string $value): void
    {
        $pattern = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value).'%';
        $wrapped = $this->wrap($query, $column);

        match ($query->getModel()->getConnection()->getDriverName()) {
            'pgsql' => $query->whereRaw("{$wrapped}::text ilike ?", [$pattern]),
            // SQLite and SQL Server have no default escape character in LIKE.
            'sqlite', 'sqlsrv' => $query->whereRaw("{$wrapped} like ? escape '\\'", [$pattern]),
            default => $query->whereLike($column, $pattern),
        };
    }

    /**
     * @param  Builder<covariant Model>  $query
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
