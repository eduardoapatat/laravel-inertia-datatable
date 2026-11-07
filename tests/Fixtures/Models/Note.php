<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Note extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /**
     * @return HasOne<NoteDetail, $this>
     */
    public function detail(): HasOne
    {
        return $this->hasOne(NoteDetail::class);
    }
}
