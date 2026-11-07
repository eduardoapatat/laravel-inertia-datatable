<?php

declare(strict_types=1);

namespace InertiaDataTable\Console;

use BackedEnum;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Proposes the columns of a table from the model casts and the database schema:
 * only the model's own columns and what is needed to show them (type, enum
 * labels, decimals), plus the global search on a `name` or `title` column.
 * Foreign keys are left out; relations, sorting, filters and hiding are added
 * by hand.
 */
final class ColumnGuesser
{
    /**
     * Columns that are never proposed, even when they are not in `$hidden`.
     */
    private const array EXCLUDED = [
        'password', 'remember_token', 'updated_at', 'deleted_at',
        'two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at',
        'email_verified_at',
    ];

    /**
     * Columns that get the global search, the first one found.
     */
    private const array SEARCH_ATTRIBUTES = ['name', 'title'];

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

            if ($name === $model->getKeyName() || str_ends_with($name, '_id') || in_array($name, $hidden, true) || in_array($name, self::EXCLUDED, true)) {
                continue;
            }

            // The name is written into PHP and TypeScript source: anything that is not a plain
            // identifier is left for the developer to add by hand.
            if (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name) !== 1) {
                continue;
            }

            $guessed = $this->guessAttribute($name, $casts[$name] ?? null, strtolower($column['type_name']), strtolower($column['type']), $column['nullable']);

            if ($guessed !== null) {
                $columns[] = $guessed;
            }
        }

        return $this->withSearch($columns);
    }

    /**
     * The global search goes on one column: `name`, else `title`.
     *
     * @param  list<GuessedColumn>  $columns
     * @return list<GuessedColumn>
     */
    private function withSearch(array $columns): array
    {
        foreach (self::SEARCH_ATTRIBUTES as $attribute) {
            foreach ($columns as $index => $column) {
                if ($column->id === $attribute && $column->type === 'text') {
                    $columns[$index] = new GuessedColumn($column->id, $column->label, $column->type, [...$column->calls, 'searchable()'], $column->kind, $column->nullable);

                    return $columns;
                }
            }
        }

        return $columns;
    }

    private function guessAttribute(string $name, ?string $cast, string $typeName, string $type, bool $nullable): ?GuessedColumn
    {
        $label = Str::headline($name);
        $castType = $cast === null ? null : strtolower(Str::before($cast, ':'));

        if ($cast !== null && enum_exists($cast) && is_subclass_of($cast, BackedEnum::class)) {
            return new GuessedColumn($name, $label, 'option', ['options('.class_basename($cast).'::class)'], 'option', $nullable, $cast);
        }

        return match (true) {
            in_array($castType, ['bool', 'boolean'], true) => new GuessedColumn($name, $label, 'boolean', [], 'boolean', $nullable),
            // Without a cast, SQLite and MySQL return 1/0.
            $this->isBooleanType($typeName, $type) => new GuessedColumn($name, $label, 'boolean', [], 'boolean-or-number', $nullable),
            in_array($castType, ['date', 'datetime', 'immutable_date', 'immutable_datetime', 'timestamp'], true) || $this->isDateType($typeName) => new GuessedColumn($name, $label, 'date', [], 'date', $nullable),
            // The decimal cast serializes as a string to keep the precision.
            $castType === 'decimal' => new GuessedColumn($name, $label, 'number', $this->decimalsCall((string) $cast), 'decimal', $nullable),
            in_array($castType, ['float', 'double', 'real'], true) || $this->isFloatType($typeName) => new GuessedColumn($name, $label, 'number', [], 'number', $nullable),
            // Without a cast, MySQL and PostgreSQL return DECIMAL/NUMERIC as a string; SQLite as a number.
            $this->isDecimalType($typeName) => new GuessedColumn($name, $label, 'number', [], 'number-or-string', $nullable),
            in_array($castType, ['int', 'integer'], true) || $this->isIntegerType($typeName) => new GuessedColumn($name, $label, 'number', [], 'number', $nullable),
            $this->isStringType($typeName) => new GuessedColumn($name, $label, 'text', [], 'string', $nullable),
            default => null,
        };
    }

    /**
     * `decimal:2` → `decimals(2)`, so the cell shows the same decimals as the cast.
     *
     * @return list<string>
     */
    private function decimalsCall(string $cast): array
    {
        $decimals = Str::after($cast, ':');

        return ctype_digit($decimals) ? ["decimals({$decimals})"] : [];
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
        return in_array($typeName, ['decimal', 'numeric', 'money'], true);
    }

    private function isFloatType(string $typeName): bool
    {
        return in_array($typeName, ['float', 'double', 'real', 'float4', 'float8'], true);
    }

    private function isIntegerType(string $typeName): bool
    {
        return in_array($typeName, ['int', 'integer', 'bigint', 'smallint', 'mediumint', 'tinyint', 'int2', 'int4', 'int8'], true);
    }

    private function isStringType(string $typeName): bool
    {
        return in_array($typeName, ['varchar', 'char', 'text', 'string', 'tinytext', 'mediumtext', 'longtext', 'citext', 'bpchar', 'nvarchar', 'nchar', 'ntext', 'character varying', 'character'], true);
    }
}
