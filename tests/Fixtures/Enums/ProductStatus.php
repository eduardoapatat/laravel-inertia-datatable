<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Tests\Fixtures\Enums;

enum ProductStatus: string
{
    case Active = 'active';
    case Draft = 'draft';
    case Archived = 'archived';
}
