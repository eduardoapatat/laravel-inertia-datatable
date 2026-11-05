<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Enums;

enum ProductStatus: string
{
    case Active = 'active';
    case Draft = 'draft';
    case Archived = 'archived';
}
