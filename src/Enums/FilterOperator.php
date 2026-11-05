<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Enums;

/**
 * Operadores de filtro del contrato (mismas claves que tablecn).
 *
 * El valor del enum es la clave que viaja en `state.columnFilters[].operator`;
 * `urlName()` es el nombre que se usa en el query string.
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
     * Busca un operador por su nombre de URL o por su clave, sin distinguir mayúsculas.
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
     * Operadores que no llevan valor.
     */
    public function isValueless(): bool
    {
        return $this === self::IsEmpty || $this === self::IsNotEmpty;
    }

    /**
     * Operadores cuyo valor es una lista separada por comas.
     */
    public function isList(): bool
    {
        return in_array($this, [self::InArray, self::NotInArray, self::IsBetween], true);
    }

    /**
     * Operador positivo del que este es la negación, si lo es.
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
