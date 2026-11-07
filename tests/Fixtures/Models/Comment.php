<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Comment extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /**
     * @return MorphTo<Model, $this>
     */
    public function commentable(): MorphTo
    {
        return $this->morphTo(ownerKey: 'id');
    }
}
