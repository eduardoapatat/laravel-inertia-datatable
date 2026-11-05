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
 * Resuelve las columnas que toman su valor de una relación a uno (`category.name`).
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
            throw new LogicException(sprintf('La columna [%s] usa la relación [%s], que no existe en %s.', $column->id(), $name, $model::class));
        }

        /** @var mixed $relation */
        $relation = Relation::noConstraints(fn (): mixed => $model->{$name}());

        if (! $relation instanceof BelongsTo
            && ! $relation instanceof HasOne
            && ! $relation instanceof MorphOne
            && ! $relation instanceof HasOneThrough) {
            throw new LogicException(sprintf('La columna [%s] usa la relación [%s], que no es a uno (belongsTo / hasOne).', $column->id(), $name));
        }

        return $relation;
    }

    /**
     * Subconsulta correlacionada que devuelve el valor relacionado de cada fila del padre.
     *
     * @param  Builder<covariant Model>  $parent
     * @return Builder<covariant Model>
     */
    public function valueQuery(Builder $parent, Column $column): Builder
    {
        $relation = $this->relation($parent->getModel(), $column);

        // Columna sin calificar: dentro de la subconsulta se resuelve contra la tabla
        // relacionada, también cuando Laravel le pone alias (relaciones consigo misma).
        return $relation
            ->getRelationExistenceQuery($relation->getRelated()->newQuery(), $parent->getModel()->newQuery(), [$column->attribute()])
            ->limit(1);
    }
}
