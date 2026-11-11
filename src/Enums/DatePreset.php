<?php

declare(strict_types=1);

namespace InertiaDataTable\Enums;

/**
 * Date formats with a name, for `DateColumn::format()` and `inertia-datatable.date_format`.
 */
enum DatePreset: string
{
    case Short = 'short';
    case Medium = 'medium';
    case Long = 'long';
    case Datetime = 'datetime';
    case Relative = 'relative';

    /**
     * @throws \InvalidArgumentException
     */
    public static function ensure(string $format, string $subject): self
    {
        return self::tryFrom($format) ?? throw new \InvalidArgumentException(sprintf(
            '%s [%s] is not one of: %s.',
            $subject,
            $format,
            implode(', ', array_map(fn (self $preset): string => $preset->value, self::cases())),
        ));
    }
}
