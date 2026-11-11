<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;

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

    /**
     * The team of the member who wrote the note; `members` and `teams` both have a `name`.
     *
     * @return HasOneThrough<Team, Member, $this>
     */
    public function team(): HasOneThrough
    {
        return $this->hasOneThrough(Team::class, Member::class, 'id', 'id', 'member_id', 'team_id');
    }
}
