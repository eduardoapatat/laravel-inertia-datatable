<?php

declare(strict_types=1);

namespace InertiaDataTable\Query;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InertiaDataTable\Column;
use InertiaDataTable\TableDefinition;
use LogicException;

/**
 * Checks that the declared columns exist, so a typo or a missing migration fails
 * on the first load instead of when someone sorts or filters, and that the
 * filters with `empty: true` are on columns that can be NULL. Enabled with
 * `inertia-datatable.validate_columns` (by default, only in debug mode).
 */
final class ColumnValidator
{
    /** @var array<string, array<string, bool>> Whether each column (lowercase) is nullable, per connection and table. */
    private array $listings = [];

    public function __construct(
        private readonly RelationResolver $relations = new RelationResolver,
    ) {}

    public function enabled(): bool
    {
        $configured = config('inertia-datatable.validate_columns');

        return $configured === null ? app()->hasDebugModeEnabled() : (bool) $configured;
    }

    /**
     * Columns used in SQL (sorting, search, filters and the default sort) must be
     * columns of their table.
     */
    public function ensureQueryColumnsExist(TableDefinition $definition): void
    {
        $model = $definition->query->getModel();

        foreach ($definition->columns as $column) {
            $usages = array_keys(array_filter([
                'sortable' => $column->isSortable(),
                'searchable' => $column->isSearchable(),
                'filterable' => $column->variantOfFilter() !== null,
            ]));

            if ($usages !== []) {
                $this->ensureColumnExists($this->owner($model, $column), $column->attribute(), sprintf('The column [%s] is %s', $column->id(), implode(', ', $usages)));
            }

            $this->ensureCanBeEmpty($model, $column);
        }

        foreach ($definition->defaultSort as $item) {
            $column = $definition->column($item->id);

            $this->ensureColumnExists(
                $column === null ? $model : $this->owner($model, $column),
                $column?->attribute() ?? $item->id,
                sprintf('The default sort uses [%s]', $item->id),
            );
        }
    }

    /**
     * Displayed columns must have a value in the serialized model: a column, an
     * alias of the query (`withCount`, `addSelect`) or an attribute in `$appends`.
     * Only the first row is checked; tables with `transform()` are skipped.
     *
     * @param  list<string>  $visibleColumns
     */
    public function ensureDisplayedColumnsExist(TableDefinition $definition, array $visibleColumns, Model $row): void
    {
        foreach ($visibleColumns as $id) {
            $column = $definition->columns[$id];
            $relation = $column->relation();
            $model = $relation === null ? $row : $row->getRelation($relation);

            if (! $model instanceof Model || array_key_exists($column->attribute(), $model->toArray())) {
                continue;
            }

            throw new LogicException(sprintf('The column [%s] has no value to display: %s', $id, $this->missingReason($model, $column->attribute())));
        }
    }

    private function owner(Model $model, Column $column): Model
    {
        return $column->relation() === null ? $model : $this->relations->relation($model, $column)->getRelated();
    }

    private function ensureColumnExists(Model $model, string $attribute, string $subject): void
    {
        $columns = $this->columns($model);

        // An empty listing means the schema could not be read: nothing to compare with.
        if ($columns === [] || array_key_exists(strtolower($attribute), $columns)) {
            return;
        }

        throw new LogicException(sprintf(
            '%s, but [%s.%s] does not exist in the database. Check the name and the migrations; values computed in PHP (accessors, transform()) can only be displayed.',
            $subject,
            $model->getTable(),
            $attribute,
        ));
    }

    /**
     * The option "without value" of a filter never matches on a NOT NULL column.
     * On a `belongsTo` column a row is empty without the related record or
     * without its value, so both the foreign key and the related column must be
     * NOT NULL to fail; other relations are not checked.
     */
    private function ensureCanBeEmpty(Model $model, Column $column): void
    {
        if (! $column->filtersEmpty()) {
            return;
        }

        if ($column->relation() === null) {
            if ($this->isNotNull($model, $column->attribute())) {
                throw new LogicException(sprintf(
                    'The filter of the column [%s] offers the rows without a value, but [%s.%s] is NOT NULL: no row can match. Remove empty: true or make the column nullable.',
                    $column->id(),
                    $model->getTable(),
                    $column->attribute(),
                ));
            }

            return;
        }

        $relation = $this->relations->relation($model, $column);

        if (! $relation instanceof BelongsTo) {
            return;
        }

        $related = $relation->getRelated();

        if ($this->isNotNull($model, $relation->getForeignKeyName()) && $this->isNotNull($related, $column->attribute())) {
            throw new LogicException(sprintf(
                'The filter of the column [%s] offers the rows without a value, but [%s.%s] and [%s.%s] are NOT NULL: every row has a value. Remove empty: true or make one of them nullable.',
                $column->id(),
                $model->getTable(),
                $relation->getForeignKeyName(),
                $related->getTable(),
                $column->attribute(),
            ));
        }
    }

    private function isNotNull(Model $model, string $attribute): bool
    {
        return ($this->columns($model)[strtolower($attribute)] ?? true) === false;
    }

    /**
     * @return array<string, bool>
     */
    private function columns(Model $model): array
    {
        $key = $model->getConnectionName().'|'.$model->getTable();

        if (! isset($this->listings[$key])) {
            $this->listings[$key] = [];

            foreach ($model->getConnection()->getSchemaBuilder()->getColumns($model->getTable()) as $column) {
                $this->listings[$key][strtolower($column['name'])] = (bool) $column['nullable'];
            }
        }

        return $this->listings[$key];
    }

    private function missingReason(Model $model, string $attribute): string
    {
        $class = $model::class;

        if (in_array($attribute, $model->getHidden(), true)) {
            return sprintf('[%s] is in the $hidden attributes of %s.', $attribute, $class);
        }

        if ($model->hasGetMutator($attribute) || $model->hasAttributeMutator($attribute)) {
            return sprintf('[%s] is an accessor of %s that is not in $appends. Add it to $appends or build the rows with transform().', $attribute, $class);
        }

        return sprintf('[%s] is not a column of [%s], an alias selected by the query (withCount, addSelect) or an attribute in the $appends of %s.', $attribute, $model->getTable(), $class);
    }
}
