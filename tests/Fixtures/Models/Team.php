<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Team extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /**
     * @return HasManyThrough<Note, Member, $this>
     */
    public function notes(): HasManyThrough
    {
        return $this->hasManyThrough(Note::class, Member::class);
    }
}
