<?php

declare(strict_types=1);

namespace InertiaDataTable\Query;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use InertiaDataTable\Column;
use LogicException;

/**
 * Resolves the columns that take their value from a to-one relation (`category.name`).
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
            && ! $relation instanceof HasOneThrough) {
            throw new LogicException(sprintf('The column [%s] uses the relation [%s], which is not a to-one relation (belongsTo / hasOne).', $column->id(), $name));
        }

        return $relation;
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

        // Unqualified column: inside the subquery it resolves against the related table,
        // also when Laravel aliases it (self-referencing relations). The constraints of the
        // relation method are merged as whereHas() does, so sort and facets see the same
        // related rows as the data, the filters and the search.
        return $relation
            ->getRelationExistenceQuery($relation->getRelated()->newQuery(), $parent->getModel()->newQuery(), [$column->attribute()])
            ->mergeConstraintsFrom($relation->getQuery())
            ->limit(1);
    }
}
