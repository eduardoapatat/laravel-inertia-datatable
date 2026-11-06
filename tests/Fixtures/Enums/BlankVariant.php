<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Enums;

enum BlankVariant: string
{
    case Only = 'only';

    public function badgeVariant(): string
    {
        return '';
    }
}
