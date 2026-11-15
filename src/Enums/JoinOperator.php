<?php

declare(strict_types=1);

namespace InertiaDataTable\Enums;

/**
 * How the column filters are combined: every one must match (`and`, the
 * default) or at least one (`or`, the `join=or` parameter).
 */
enum JoinOperator: string
{
    case And = 'and';
    case Or = 'or';

    /**
     * Anything that is not `or` (in any case) is normalized to `and`.
     */
    public static function parse(mixed $value): self
    {
        return is_string($value) && strtolower(trim($value)) === self::Or->value ? self::Or : self::And;
    }
}
