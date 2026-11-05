<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Parsing;

use DateTimeImmutable;
use EduardoApatat\InertiaDataTable\Column;
use EduardoApatat\InertiaDataTable\Enums\FilterOperator;
use EduardoApatat\InertiaDataTable\Enums\FilterVariant;
use EduardoApatat\InertiaDataTable\FilterItem;

/**
 * Interpreta un parámetro `filter[<col>]=[<operador>.]<valor>` (sintaxis de tablecn).
 */
final class FilterParser
{
    /**
     * Máximo de segmentos separados por punto que puede tener un operador (`not.is.empty`).
     */
    private const int MAX_OPERATOR_PARTS = 3;

    private const int MAX_TEXT_LENGTH = 255;

    public function parse(Column $column, string $param): ?FilterItem
    {
        $variant = $column->filterVariant();

        if ($variant === null) {
            return null;
        }

        [$operator, $rawValue] = $this->splitOperator($param, $variant);

        if ($operator->isValueless()) {
            return new FilterItem($column->id(), $variant, $operator, '');
        }

        if ($operator === FilterOperator::IsBetween) {
            $bounds = $this->parseBetween($column, $variant, $rawValue);

            return $bounds === null ? null : new FilterItem($column->id(), $variant, $operator, $bounds);
        }

        if ($operator->isList()) {
            $values = [];

            foreach ($this->parseList($rawValue) as $item) {
                $value = $this->normalizeValue($column, $variant, $item);

                if ($value === null) {
                    continue;
                }

                $values[] = $value;
            }

            $values = array_values(array_unique($values));

            return $values === [] ? null : new FilterItem($column->id(), $variant, $operator, $values);
        }

        $value = $this->normalizeValue($column, $variant, $rawValue);

        return $value === null ? null : new FilterItem($column->id(), $variant, $operator, $value);
    }

    /**
     * Separa el operador del valor. Si el prefijo no es un operador de la variante,
     * todo el parámetro es el valor y se usa el operador implícito.
     *
     * @return array{FilterOperator, string}
     */
    private function splitOperator(string $param, FilterVariant $variant): array
    {
        $parts = explode('.', $param);

        for ($count = min(self::MAX_OPERATOR_PARTS, count($parts)); $count > 0; $count--) {
            $operator = FilterOperator::fromName(implode('.', array_slice($parts, 0, $count)));

            if ($operator === null || ! $variant->allows($operator)) {
                continue;
            }

            // "eq" a secas no es un operador sin valor: se toma como valor literal.
            if ($count === count($parts) && ! $operator->isValueless()) {
                continue;
            }

            return [$operator, implode('.', array_slice($parts, $count))];
        }

        return [$variant->implicitOperator(), $param];
    }

    /**
     * @return list<string>|null
     */
    private function parseBetween(Column $column, FilterVariant $variant, string $rawValue): ?array
    {
        $items = $this->parseList($rawValue, keepEmpty: true);
        $bounds = [];

        foreach ([$items[0] ?? '', $items[1] ?? ''] as $item) {
            if ($item === '') {
                $bounds[] = '';

                continue;
            }

            $value = $this->normalizeValue($column, $variant, $item);

            if ($value === null) {
                return null;
            }

            $bounds[] = $value;
        }

        [$from, $to] = $bounds;

        if ($from === '' && $to === '') {
            return null;
        }

        if ($from !== '' && $to !== '' && $this->isGreater($variant, $from, $to)) {
            [$from, $to] = [$to, $from];
        }

        return [$from, $to];
    }

    private function isGreater(FilterVariant $variant, string $left, string $right): bool
    {
        return $variant->isNumeric() ? (float) $left > (float) $right : strcmp($left, $right) > 0;
    }

    private function normalizeValue(Column $column, FilterVariant $variant, string $value): ?string
    {
        return match ($variant) {
            FilterVariant::Text => $this->normalizeText($value),
            FilterVariant::Number, FilterVariant::Range => is_numeric(trim($value)) ? trim($value) : null,
            FilterVariant::Date, FilterVariant::DateRange => $this->isValidDate(trim($value)) ? trim($value) : null,
            FilterVariant::Boolean => in_array(strtolower(trim($value)), ['true', 'false'], true) ? strtolower(trim($value)) : null,
            FilterVariant::Select, FilterVariant::MultiSelect => $this->normalizeOption($column, $value),
        };
    }

    private function normalizeText(string $value): ?string
    {
        $value = trim($value);

        return $value === '' ? null : mb_substr($value, 0, self::MAX_TEXT_LENGTH);
    }

    private function normalizeOption(Column $column, string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        $options = $column->options();

        return $options === null || array_key_exists($value, $options) ? $value : null;
    }

    private function isValidDate(string $value): bool
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }

    /**
     * Lista separada por comas; un elemento entre comillas dobles puede contener comas,
     * y `""` dentro de comillas es una comilla literal (igual que tablecn).
     *
     * @return list<string>
     */
    private function parseList(string $rawValue, bool $keepEmpty = false): array
    {
        $items = [];
        $item = '';
        $isQuoted = false;
        $wasQuoted = false;
        $length = strlen($rawValue);

        for ($index = 0; $index < $length; $index++) {
            $char = $rawValue[$index];

            if ($char === '"') {
                if ($isQuoted && ($rawValue[$index + 1] ?? null) === '"') {
                    $item .= '"';
                    $index++;
                } else {
                    $isQuoted = ! $isQuoted;
                    $wasQuoted = true;
                }
            } elseif ($char === ',' && ! $isQuoted) {
                $items[] = $wasQuoted ? $item : trim($item);
                $item = '';
                $wasQuoted = false;
            } else {
                $item .= $char;
            }
        }

        if ($rawValue !== '') {
            $items[] = $wasQuoted ? $item : trim($item);
        }

        return $keepEmpty ? $items : array_values(array_filter($items, fn (string $value): bool => $value !== ''));
    }
}
