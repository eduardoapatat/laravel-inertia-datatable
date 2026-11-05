<?php

declare(strict_types=1);

namespace InertiaDataTable\Query;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Database\Eloquent\Relations\MorphOne;
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
        // also when Laravel aliases it (self-referencing relations).
        return $relation
            ->getRelationExistenceQuery($relation->getRelated()->newQuery(), $parent->getModel()->newQuery(), [$column->attribute()])
            ->limit(1);
    }
}
