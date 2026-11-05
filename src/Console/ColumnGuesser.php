<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use BackedEnum;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use ReflectionMethod;
use ReflectionNamedType;
use Throwable;

/**
 * Propone las columnas de una tabla leyendo los casts del modelo y el esquema de la base de datos.
 */
final class ColumnGuesser
{
    /**
     * Columnas que nunca se proponen aunque no estén en `$hidden`.
     */
    private const array EXCLUDED = [
        'password', 'remember_token', 'updated_at', 'deleted_at',
        'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at',
        'email_verified_at',
    ];

    /**
     * Atributos preferidos para mostrar un modelo relacionado.
     */
    private const array DISPLAY_ATTRIBUTES = ['name', 'title', 'label', 'email'];

    /**
     * @return list<GuessedColumn>
     */
    public function guess(Model $model): array
    {
        $schema = $model->getConnection()->getSchemaBuilder();
        $hidden = $model->getHidden();
        $casts = $model->getCasts();
        $columns = [];

        foreach ($schema->getColumns($model->getTable()) as $column) {
            $name = $column['name'];

            if ($name === $model->getKeyName() || in_array($name, $hidden, true) || in_array($name, self::EXCLUDED, true)) {
                continue;
            }

            $guessed = str_ends_with($name, '_id')
                ? $this->guessRelation($model, $name, $column['nullable'])
                : $this->guessAttribute($name, $casts[$name] ?? null, strtolower($column['type_name']), strtolower($column['type']), $column['nullable']);

            if ($guessed !== null) {
                $columns[] = $guessed;
            }
        }

        return $this->lockIdentifyingColumn($columns);
    }

    /**
     * La columna que identifica la fila (name, title… o el primer texto propio)
     * va primero y no se puede ocultar.
     *
     * @param  list<GuessedColumn>  $columns
     * @return list<GuessedColumn>
     */
    private function lockIdentifyingColumn(array $columns): array
    {
        $candidates = array_filter($columns, fn (GuessedColumn $column): bool => ! $column->isRelation && $column->kind === 'string');
        $preferred = array_filter($candidates, fn (GuessedColumn $column): bool => in_array($column->id, self::DISPLAY_ATTRIBUTES, true));
        $index = array_key_first($preferred) ?? array_key_first($candidates);

        if ($index === null) {
            return $columns;
        }

        $locked = $columns[$index];
        unset($columns[$index]);

        return [
            new GuessedColumn($locked->id, $locked->label, [...$locked->calls, 'hideable(false)'], $locked->kind, $locked->nullable),
            ...array_values($columns),
        ];
    }

    private function guessAttribute(string $name, ?string $cast, string $typeName, string $type, bool $nullable): ?GuessedColumn
    {
        $label = Str::headline($name);
        $castType = $cast === null ? null : strtolower(Str::before($cast, ':'));

        if ($cast !== null && enum_exists($cast) && is_subclass_of($cast, BackedEnum::class)) {
            return new GuessedColumn($name, $label, ['multiSelect('.class_basename($cast).'::class)'], 'option', $nullable, $cast);
        }

        return match (true) {
            in_array($castType, ['bool', 'boolean'], true) || $this->isBooleanType($typeName, $type) => new GuessedColumn($name, $label, ['boolean()'], 'boolean', $nullable),
            in_array($castType, ['date', 'datetime', 'immutable_date', 'immutable_datetime', 'timestamp'], true) || $this->isDateType($typeName) => new GuessedColumn($name, $label, ['sortable()', 'dateRange()'], 'date', $nullable),
            in_array($castType, ['decimal', 'float', 'double', 'real'], true) || $this->isDecimalType($typeName) => new GuessedColumn($name, $label, ['sortable()', 'range()'], 'number', $nullable),
            in_array($castType, ['int', 'integer'], true) || $this->isIntegerType($typeName) => new GuessedColumn($name, $label, ['sortable()', 'number()'], 'number', $nullable),
            $this->isStringType($typeName) => new GuessedColumn($name, $label, $this->isLongText($typeName) ? ['searchable()', 'text()'] : ['sortable()', 'searchable()', 'text()'], 'string', $nullable),
            default => null,
        };
    }

    /**
     * `category_id` → `Column::make('category')->from('category.name')` si existe la relación `category()`.
     */
    private function guessRelation(Model $model, string $foreignKey, bool $nullable): ?GuessedColumn
    {
        $relationName = Str::camel(Str::beforeLast($foreignKey, '_id'));

        if (! method_exists($model, $relationName)) {
            return null;
        }

        $returnType = (new ReflectionMethod($model, $relationName))->getReturnType();

        if (! $returnType instanceof ReflectionNamedType || ! is_a($returnType->getName(), BelongsTo::class, true)) {
            return null;
        }

        try {
            /** @var BelongsTo<Model, Model> $relation */
            $relation = $model->{$relationName}();
            $related = $relation->getRelated();
            $relatedColumns = $related->getConnection()->getSchemaBuilder()->getColumnListing($related->getTable());
        } catch (Throwable) {
            return null;
        }

        $attribute = collect(self::DISPLAY_ATTRIBUTES)->first(fn (string $candidate): bool => in_array($candidate, $relatedColumns, true));

        if ($attribute === null) {
            return null;
        }

        return new GuessedColumn(
            Str::snake($relationName),
            Str::headline($relationName),
            ["from('{$relationName}.{$attribute}')", 'sortable()', 'searchable()', 'multiSelect()'],
            'string',
            $nullable,
            isRelation: true,
        );
    }

    private function isBooleanType(string $typeName, string $type): bool
    {
        return in_array($typeName, ['bool', 'boolean'], true) || $type === 'tinyint(1)';
    }

    private function isDateType(string $typeName): bool
    {
        return in_array($typeName, ['date', 'datetime', 'timestamp', 'timestamptz', 'datetime2', 'datetimeoffset', 'smalldatetime'], true);
    }

    private function isDecimalType(string $typeName): bool
    {
        return in_array($typeName, ['decimal', 'numeric', 'float', 'double', 'real', 'float4', 'float8', 'money'], true);
    }

    private function isIntegerType(string $typeName): bool
    {
        return in_array($typeName, ['int', 'integer', 'bigint', 'smallint', 'mediumint', 'tinyint', 'int2', 'int4', 'int8'], true);
    }

    private function isStringType(string $typeName): bool
    {
        return in_array($typeName, ['varchar', 'char', 'text', 'string', 'tinytext', 'mediumtext', 'longtext', 'citext', 'bpchar', 'nvarchar', 'nchar', 'ntext', 'character varying', 'character'], true);
    }

    private function isLongText(string $typeName): bool
    {
        return in_array($typeName, ['text', 'tinytext', 'mediumtext', 'longtext', 'ntext'], true);
    }
}
