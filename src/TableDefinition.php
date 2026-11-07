<?php

declare(strict_types=1);

namespace InertiaDataTable;

use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use InvalidArgumentException;

/**
 * Complete, validated definition of a table, regardless of how it was declared
 * (`DataTable` class or `TableBuilder`).
 */
final readonly class TableDefinition
{
    /** @var Builder<covariant Model> */
    public Builder $query;

    /** @var array<string, Column> */
    public array $columns;

    /** @var list<SortItem> */
    public array $defaultSort;

    /** @var list<int> */
    public array $perPageOptions;

    public int $perPage;

    /** @var list<string> */
    public array $alwaysInclude;

    /**
     * @param  Builder<covariant Model>|Relation<covariant Model, covariant Model, mixed>  $query
     * @param  list<Column>  $columns
     * @param  list<int>  $perPageOptions
     * @param  list<string>|null  $alwaysInclude
     * @param  (Closure(Model): array<string, mixed>)|null  $transformer
     */
    public function __construct(
        Builder|Relation $query,
        array $columns,
        ?string $defaultSort,
        int $perPage,
        array $perPageOptions,
        public ?string $name = null,
        ?array $alwaysInclude = null,
        public ?Closure $transformer = null,
        public ?string $locale = null,
    ) {
        $this->query = $query instanceof Relation ? self::relationQuery($query) : $query;

        $indexed = [];

        foreach ($columns as $column) {
            if (isset($indexed[$column->id()])) {
                throw new InvalidArgumentException("The column [{$column->id()}] is declared twice.");
            }

            $indexed[$column->id()] = $column;
        }

        $this->columns = $indexed;
        $this->defaultSort = $defaultSort === null ? [] : SortItem::parseList($defaultSort);

        if ($perPage < 1) {
            throw new InvalidArgumentException('perPage must be greater than 0.');
        }

        $options = array_values(array_unique(array_filter($perPageOptions, fn (int $size): bool => $size > 0)));

        if (! in_array($perPage, $options, true)) {
            $options[] = $perPage;
        }

        sort($options);

        $this->perPage = $perPage;
        $this->perPageOptions = $options;
        $this->alwaysInclude = $alwaysInclude ?? [$this->query->getModel()->getKeyName()];

        if ($name !== null && preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', $name) !== 1) {
            throw new InvalidArgumentException("The table name [{$name}] may only contain letters, numbers and underscores.");
        }
    }

    public function column(string $id): ?Column
    {
        return $this->columns[$id] ?? null;
    }

    /**
     * Effective name of a query string parameter (prefixed when the table has a name).
     */
    public function queryKey(string $parameter): string
    {
        /** @var string $base */
        $base = config("inertia-datatable.query.{$parameter}", $parameter);

        return $this->name === null ? $base : "{$this->name}_{$base}";
    }

    public function isSearchable(): bool
    {
        foreach ($this->columns as $column) {
            if ($column->isSearchable()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Builder of a relation, limited to the related table. getQuery() keeps the joins of
     * through and pivot relations but not the select that Relation::get() adds: without it,
     * `select *` lets the joined table overwrite the id and the attributes of every row.
     *
     * @param  Relation<covariant Model, covariant Model, mixed>  $relation
     * @return Builder<covariant Model>
     */
    private static function relationQuery(Relation $relation): Builder
    {
        $query = clone $relation->getQuery();

        if ($query->getQuery()->columns === null) {
            $query->select($relation->getRelated()->qualifyColumn('*'));
        }

        return $query;
    }
}
