<?php

declare(strict_types=1);

namespace InertiaDataTable\Query;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use InertiaDataTable\Column;
use InertiaDataTable\Columns\OptionColumn;
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
    /** Largest value of a Postgres `integer` column. */
    private const int MAX_INT4 = 2147483647;

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
                        $group->orWhereHas($relation, fn (Builder $where) => $this->whereContains($where, $where->qualifyColumn($column->attribute()), $word));
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
                $value = $this->relations->valueQuery($query, $column);

                if ($this->driver($query) === 'pgsql') {
                    $query->orderByRaw('('.$value->toSql().') '.$this->nullsLikeTheRest($direction), $value->getBindings());
                } else {
                    $query->orderBy($value, $direction);
                }

                continue;
            }

            // A default sort may use an attribute that is not a column of the table.
            $attribute = $column?->attribute() ?? $item->id;

            if ($this->driver($query) === 'pgsql') {
                $query->orderByRaw($this->wrap($query, $model->qualifyColumn($attribute)).' '.$this->nullsLikeTheRest($direction));
            } else {
                $query->orderBy($model->qualifyColumn($attribute), $direction);
            }

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

        // Without declared options the values are not checked against a list, and Postgres
        // rejects a text compared with a number column: the column is compared as text.
        $asText = in_array($filter->variant, [FilterVariant::Select, FilterVariant::MultiSelect], true)
            && ! ($column instanceof OptionColumn && $column->optionLabels() !== null);

        if ($relation !== null) {
            // Qualified: a through relation joins a table that may have the same column.
            $attribute = fn (Builder $where): string => $where->qualifyColumn($column->attribute());

            if ($operator === FilterOperator::IsEmpty) {
                $query->whereDoesntHave($relation, fn (Builder $where) => $this->whereNotEmpty($where, $attribute($where), $filter->variant));
            } elseif ($operator === FilterOperator::IsNotEmpty) {
                $query->whereHas($relation, fn (Builder $where) => $this->whereNotEmpty($where, $attribute($where), $filter->variant));
            } elseif ($positive !== null) {
                $query->whereDoesntHave($relation, fn (Builder $where) => $this->wherePredicate($where, $attribute($where), $positive, $filter, $asText));
            } else {
                $query->whereHas($relation, fn (Builder $where) => $this->wherePredicate($where, $attribute($where), $operator, $filter, $asText));
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
                ->whereNot(fn (Builder $not) => $this->wherePredicate($not, $sqlColumn, $positive, $filter, $asText))
                ->orWhereNull($sqlColumn));
        } else {
            $this->wherePredicate($query, $sqlColumn, $operator, $filter, $asText);
        }
    }

    /**
     * @param  Builder<covariant Model>  $query
     */
    private function wherePredicate(Builder $query, string $column, FilterOperator $operator, FilterItem $filter, bool $asText = false): void
    {
        $value = $filter->value;
        $variant = $filter->variant;

        if ($asText && $this->driver($query) === 'pgsql' && in_array($operator, [FilterOperator::InArray, FilterOperator::Eq], true)) {
            $values = array_map(strval(...), (array) $value);
            $query->whereRaw($this->wrap($query, $column).'::text in ('.implode(', ', array_fill(0, count($values), '?')).')', $values);

            return;
        }

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
            // The exact value too: `lower()` only folds ASCII in SQLite, PHP folds "Á" as well.
            $variant === FilterVariant::Text => $query->whereRaw(
                '(lower('.$this->wrap($query, $column).') = ? or '.$this->wrap($query, $column).' = ?)',
                [mb_strtolower($value), $value],
            ),
            $variant->isDate() => $query->whereDate($column, '=', $value),
            $variant === FilterVariant::Boolean => $query->where($column, $value === 'true'),
            $variant->isNumeric() => $this->whereNumber($query, $column, '=', $value),
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
            $this->whereNumber($query, $column, $sqlOperator, $value);
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

        match ($this->driver($query)) {
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

    /**
     * Postgres takes the type of the value from the column, so `1.5` or a number over its
     * range fails on an integer column: those go as `numeric` and compare with any number.
     *
     * @param  Builder<covariant Model>  $query
     */
    private function whereNumber(Builder $query, string $column, string $sqlOperator, string $value): void
    {
        $number = $this->number($value);

        if ($this->driver($query) === 'pgsql' && (is_float($number) || abs($number) > self::MAX_INT4)) {
            $query->whereRaw($this->wrap($query, $column)." {$sqlOperator} ?::numeric", [(string) $number]);

            return;
        }

        $query->where($column, $sqlOperator, $number);
    }

    /**
     * Postgres sorts the rows without a value as the largest; SQLite, MySQL and SQL Server
     * as the smallest. The same sort gives the same order everywhere: first ascending, last
     * descending.
     */
    private function nullsLikeTheRest(string $direction): string
    {
        return $direction === 'desc' ? 'desc nulls last' : 'asc nulls first';
    }

    /**
     * @param  Builder<covariant Model>  $query
     */
    private function driver(Builder $query): string
    {
        return $query->getModel()->getConnection()->getDriverName();
    }

    private function number(string $value): int|float
    {
        return filter_var($value, FILTER_VALIDATE_INT) !== false ? (int) $value : (float) $value;
    }
}
