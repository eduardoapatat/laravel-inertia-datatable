<?php

declare(strict_types=1);

namespace InertiaDataTable\Query;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\Builder as QueryBuilder;
use InertiaDataTable\Column;
use LogicException;

/**
 * Resolves the columns that take their value from a relation: to-one (`category.name`),
 * one value per row, or to-many (`tags.name`), a list of values per row.
 */
final class RelationResolver
{
    /**
     * @return Relation<Model, Model, mixed>
     */
    public function relation(Model $model, Column $column): Relation
    {
        $name = (string) $column->relation();

        if (! method_exists($model, $name)) {
            throw new LogicException(sprintf('The column [%s] uses the relation [%s], which does not exist on %s.', $column->id(), $name, $model::class));
        }

        /** @var mixed $relation */
        $relation = Relation::noConstraints(fn (): mixed => $model->{$name}());

        // MorphTo extends BelongsTo, but without a parent row it resolves against the parent
        // table itself, and the value subquery would lose its correlation to the outer row.
        if ($relation instanceof MorphTo) {
            throw new LogicException(sprintf('The column [%s] uses the relation [%s], which is a polymorphic morphTo relation and is not supported.', $column->id(), $name));
        }

        if (! $relation instanceof BelongsTo
            && ! $relation instanceof HasOne
            && ! $relation instanceof MorphOne
            && ! $relation instanceof HasOneThrough
            && ! $this->isToManyRelation($relation)) {
            throw new LogicException(sprintf('The column [%s] uses the relation [%s], which is not supported: use belongsTo, hasOne, morphOne, hasOneThrough, hasMany, morphMany, belongsToMany, morphToMany or hasManyThrough.', $column->id(), $name));
        }

        return $relation;
    }

    /**
     * Whether the column takes a list of values from a to-many relation.
     */
    public function isToMany(Model $model, Column $column): bool
    {
        return $column->relation() !== null && $this->isToManyRelation($this->relation($model, $column));
    }

    /**
     * One row per parent row and related value (`facet_row`, `facet_value`), for the counts
     * of a to-many column: a row counts once in each option it has. Related rows without a
     * value are left out.
     *
     * The existence query of whereHas() refers to the parent table by its name, so the
     * filtered parent rows are cross joined under that same name: the correlation turns the
     * cross join into an inner join, for any to-many relation (morph type, pivot, through
     * table and the constraints of the relation method included).
     *
     * @param  Builder<covariant Model>  $parent
     */
    public function toManyValueQuery(Builder $parent, Column $column): QueryBuilder
    {
        $model = $parent->getModel();
        $relation = $this->relation($model, $column);

        $query = $relation
            ->getRelationExistenceQuery($relation->getRelated()->newQuery(), $model->newQuery(), ['*'])
            ->mergeConstraintsFrom($relation->getQuery());

        $value = $query->qualifyColumn($column->attribute());
        $key = $model->getQualifiedKeyName();
        $parentColumns = array_values(array_unique([$key, $model->qualifyColumn($this->parentKey($relation))]));

        return $query->toBase()
            ->crossJoinSub($parent->toBase()->reorder()->select($parentColumns), $model->getTable())
            ->select([$key.' as facet_row', $value.' as facet_value'])
            ->whereNotNull($value)
            ->distinct();
    }

    /**
     * @param  Relation<Model, Model, mixed>  $relation
     */
    private function isToManyRelation(Relation $relation): bool
    {
        // MorphMany does not extend HasMany; MorphToMany extends BelongsToMany.
        return $relation instanceof HasMany
            || $relation instanceof MorphMany
            || $relation instanceof BelongsToMany
            || $relation instanceof HasManyThrough;
    }

    /**
     * The column of the parent table the existence query is correlated with.
     *
     * @param  Relation<Model, Model, mixed>  $relation
     */
    private function parentKey(Relation $relation): string
    {
        return match (true) {
            $relation instanceof HasManyThrough, $relation instanceof HasMany, $relation instanceof MorphMany => $relation->getLocalKeyName(),
            $relation instanceof BelongsToMany => $relation->getParentKeyName(),
            default => throw new LogicException(sprintf('[%s] is not a to-many relation.', $relation::class)),
        };
    }

    /**
     * Correlated subquery returning the related value for each parent row.
     *
     * @param  Builder<covariant Model>  $parent
     * @return Builder<covariant Model>
     */
    public function valueQuery(Builder $parent, Column $column): Builder
    {
        $relation = $this->relation($parent->getModel(), $column);

        // The constraints of the relation method are merged as whereHas() does, so sort and
        // facets see the same related rows as the data, the filters and the search.
        $query = $relation
            ->getRelationExistenceQuery($relation->getRelated()->newQuery(), $parent->getModel()->newQuery(), ['*'])
            ->mergeConstraintsFrom($relation->getQuery());

        // Qualified with the related table (its alias in self-referencing relations): a
        // through relation joins a table that may have a column with the same name.
        return $query->select($query->qualifyColumn($column->attribute()))->limit(1);
    }
}
