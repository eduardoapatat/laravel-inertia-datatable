<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\TableBuilder;
use InertiaDataTable\Tests\Fixtures\Models\Member;
use InertiaDataTable\Tests\Fixtures\Models\Team;

/**
 * Two teams. The ids of members, notes and pivot rows never match each other,
 * so a row hydrated from the wrong table shows up in the assertions.
 */
function seedTeams(): void
{
    DB::table('teams')->insert([['id' => 1, 'name' => 'Other'], ['id' => 2, 'name' => 'Mine']]);
    DB::table('members')->insert([
        ['id' => 1, 'team_id' => 1, 'name' => 'Bob', 'password' => 'hash-bob'],
        ['id' => 2, 'team_id' => 1, 'name' => 'Carol', 'password' => 'hash-carol'],
        ['id' => 3, 'team_id' => 2, 'name' => 'Alice', 'password' => 'hash-alice'],
    ]);
    DB::table('notes')->insert([
        ['id' => 1, 'member_id' => 3, 'title' => 'Alice note'],
        ['id' => 2, 'member_id' => 1, 'title' => 'Bob note'],
        ['id' => 3, 'member_id' => 2, 'title' => 'Carol note'],
    ]);
    DB::table('note_details')->insert([
        ['id' => 1, 'note_id' => 1, 'body' => 'Alice detail'],
        ['id' => 2, 'note_id' => 3, 'body' => 'Other team detail'],
    ]);
    DB::table('tags')->insert([['id' => 1, 'label' => 'Red'], ['id' => 2, 'label' => 'Blue']]);
    DB::table('member_tag')->insert([['id' => 50, 'member_id' => 3, 'tag_id' => 2, 'secret' => 'pivot secret']]);
}

/**
 * @return array<string, mixed>
 */
function resolveRelationTable(TableBuilder $table, string $query = ''): array
{
    return $table->withRequest(Request::create('/?'.$query))->toArray();
}

it('hydrates the rows of a through relation from the related table only', function () {
    seedTeams();

    $table = DataTable::for(Team::query()->findOrFail(2)->notes())
        ->columns([Column::text('title'), Column::text('detail')->from('detail.body')]);

    expect(resolveRelationTable($table)['data'])->toBe([
        ['id' => 1, 'title' => 'Alice note', 'detail' => 'Alice detail'],
    ]);
});

it('does not send the attributes of the through model', function () {
    seedTeams();

    $table = DataTable::for(Team::query()->findOrFail(2)->notes())
        ->columns([Column::text('title')])
        ->transform(fn (Model $note): array => $note->toArray());

    expect(resolveRelationTable($table)['data'][0])
        ->toMatchArray(['id' => 1, 'member_id' => 3, 'title' => 'Alice note'])
        ->not->toHaveKeys(['password', 'name', 'team_id']);
});

it('hydrates the rows of a belongsToMany relation without the pivot columns', function () {
    seedTeams();

    $table = DataTable::for(Member::query()->findOrFail(3)->tags())
        ->columns([Column::text('label')])
        ->transform(fn (Model $tag): array => $tag->toArray());

    expect(resolveRelationTable($table)['data'])->toBe([['id' => 2, 'label' => 'Blue']]);
});

it('does not change the select of the relation it receives', function () {
    $relation = Team::query()->make()->notes();

    DataTable::for($relation)->columns([Column::text('title')])->toDefinition();

    expect($relation->getQuery()->getQuery()->columns)->toBeNull();
});
