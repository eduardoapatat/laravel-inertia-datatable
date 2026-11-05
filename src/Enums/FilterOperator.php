<?php

declare(strict_types=1);

namespace InertiaDataTable\Enums;

/**
 * Filter operators of the contract (same keys as the frontend DataTable).
 *
 * The enum value is the key sent in `state.columnFilters[].operator`;
 * `urlName()` is the name used in the query string.
 */
enum FilterOperator: string
{
    case ILike = 'iLike';
    case NotILike = 'notILike';
    case Eq = 'eq';
    case Ne = 'ne';
    case InArray = 'inArray';
    case NotInArray = 'notInArray';
    case IsEmpty = 'isEmpty';
    case IsNotEmpty = 'isNotEmpty';
    case Lt = 'lt';
    case Lte = 'lte';
    case Gt = 'gt';
    case Gte = 'gte';
    case IsBetween = 'isBetween';

    public function urlName(): string
    {
        return match ($this) {
            self::ILike => 'ilike',
            self::NotILike => 'not.ilike',
            self::Eq => 'eq',
            self::Ne => 'neq',
            self::InArray => 'in',
            self::NotInArray => 'not.in',
            self::IsEmpty => 'is.empty',
            self::IsNotEmpty => 'not.is.empty',
            self::Lt => 'lt',
            self::Lte => 'lte',
            self::Gt => 'gt',
            self::Gte => 'gte',
            self::IsBetween => 'between',
        };
    }

    /**
     * Finds an operator by its URL name or its key, case-insensitively.
     */
    public static function fromName(string $name): ?self
    {
        $name = strtolower($name);

        foreach (self::cases() as $operator) {
            if ($name === strtolower($operator->value) || $name === $operator->urlName()) {
                return $operator;
            }
        }

        return null;
    }

    /**
     * Operators without a value.
     */
    public function isValueless(): bool
    {
        return $this === self::IsEmpty || $this === self::IsNotEmpty;
    }

    /**
     * Operators whose value is a comma-separated list.
     */
    public function isList(): bool
    {
        return in_array($this, [self::InArray, self::NotInArray, self::IsBetween], true);
    }

    /**
     * Positive operator this one negates, if it is a negation.
     */
    public function negationOf(): ?self
    {
        return match ($this) {
            self::NotILike => self::ILike,
            self::Ne => self::Eq,
            self::NotInArray => self::InArray,
            default => null,
        };
    }
}
