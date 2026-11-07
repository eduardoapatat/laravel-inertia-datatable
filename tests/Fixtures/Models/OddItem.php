<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Model whose table the test creates with column names that are not identifiers.
 */
class OddItem extends Model
{
    protected $guarded = [];
}
