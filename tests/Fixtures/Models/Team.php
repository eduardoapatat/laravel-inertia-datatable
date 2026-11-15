<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
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

    /**
     * @return HasMany<Member, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(Member::class);
    }

    /**
     * Members whose name starts with "A" or "B": the constraints of the method count.
     *
     * @return HasMany<Member, $this>
     */
    public function earlyMembers(): HasMany
    {
        return $this->hasMany(Member::class)->where(fn ($query) => $query->where('name', 'like', 'A%')->orWhere('name', 'like', 'B%'));
    }
}
