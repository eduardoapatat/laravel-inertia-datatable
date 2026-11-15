<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\TableBuilder;
use InertiaDataTable\Tests\Fixtures\Models\Member;
use InertiaDataTable\Tests\Fixtures\Models\Note;
use InertiaDataTable\Tests\Fixtures\Models\Team;

/**
 * Ana: Red, Blue. Bob: Blue. Cid: no tags. Dan: two tags labeled Blue and Green.
 * The ids of members, tags and pivot rows never match each other.
 */
function seedTaggedMembers(): void
{
    DB::table('teams')->insert([['id' => 1, 'name' => 'Ops'], ['id' => 2, 'name' => 'Empty']]);
    DB::table('members')->insert([
        ['id' => 11, 'team_id' => 1, 'name' => 'Ana', 'password' => 'x'],
        ['id' => 12, 'team_id' => 1, 'name' => 'Bob', 'password' => 'x'],
        ['id' => 13, 'team_id' => 1, 'name' => 'Cid', 'password' => 'x'],
        ['id' => 14, 'team_id' => 1, 'name' => 'Dan', 'password' => 'x'],
    ]);
    DB::table('tags')->insert([
        ['id' => 21, 'label' => 'Red'],
        ['id' => 22, 'label' => 'Blue'],
        ['id' => 23, 'label' => 'Green'],
        ['id' => 24, 'label' => 'Blue'],
    ]);
    DB::table('member_tag')->insert([
        ['id' => 31, 'member_id' => 11, 'tag_id' => 21, 'secret' => 's'],
        ['id' => 32, 'member_id' => 11, 'tag_id' => 22, 'secret' => 's'],
        ['id' => 33, 'member_id' => 12, 'tag_id' => 22, 'secret' => 's'],
        ['id' => 34, 'member_id' => 14, 'tag_id' => 22, 'secret' => 's'],
        ['id' => 35, 'member_id' => 14, 'tag_id' => 24, 'secret' => 's'],
        ['id' => 36, 'member_id' => 14, 'tag_id' => 23, 'secret' => 's'],
    ]);
}

function taggedMembersTable(): TableBuilder
{
    return DataTable::for(Member::query())->columns([
        Column::text('name')->filterInput()->searchable(),
        Column::option('tags')->from('tags.label')->filterMultiSelect(empty: true)->maxVisible(2),
        Column::text('tag_text')->from('tags.label')->filterInput()->searchable(),
    ]);
}

/**
 * @return array<string, mixed>
 */
function resolveToMany(TableBuilder $table, string $query = ''): array
{
    return $table->withRequest(Request::create('/?'.$query))->toArray();
}

/**
 * @return list<string>
 */
function toManyNames(string $query): array
{
    return collect(resolveToMany(taggedMembersTable(), $query)['data'])->pluck('name')->all();
}

beforeEach(fn () => seedTaggedMembers());

it('sends the distinct values of each row as a list', function () {
    $rows = collect(resolveToMany(taggedMembersTable())['data'])->keyBy('name');

    expect($rows['Ana']['tags'])->toEqualCanonicalizing(['Red', 'Blue'])
        ->and($rows['Bob']['tags'])->toBe(['Blue'])
        ->and($rows['Cid']['tags'])->toBe([])
        ->and($rows['Dan']['tags'])->toEqualCanonicalizing(['Blue', 'Green']);
});

it('marks the to-many columns as multiple in the config', function () {
    $columns = collect(resolveToMany(taggedMembersTable())['config']['columns'])->keyBy('id');

    expect($columns['tags']['multiple'])->toBeTrue()
        ->and($columns['tags']['display'])->toMatchArray(['type' => 'option', 'max' => 2])
        ->and($columns['name'])->not->toHaveKey('multiple');
});

it('loads the values of every row in one query', function () {
    $count = 0;
    DB::listen(function ($query) use (&$count): void {
        $count += str_contains($query->sql, 'member_tag') ? 1 : 0;
    });

    resolveToMany(DataTable::for(Member::query())->columns([Column::text('name'), Column::option('tags')->from('tags.label')]));

    // Four rows and no filter, no facet: only the eager load reads the pivot table.
    expect($count)->toBe(1);
});

it('matches the rows where some related value is in the list', function () {
    expect(toManyNames('filter[tags]=in.Blue'))->toBe(['Ana', 'Bob', 'Dan'])
        ->and(toManyNames('filter[tags]=in.Red,Green'))->toBe(['Ana', 'Dan']);
});

it('matches the rows where no related value is in the list, also those without related rows', function () {
    expect(toManyNames('filter[tags]=not.in.Blue'))->toBe(['Cid'])
        ->and(toManyNames('filter[tags]=not.in.Red'))->toBe(['Bob', 'Cid', 'Dan']);
});

it('matches the rows without related rows as empty', function () {
    expect(toManyNames('filter[tags]=is.empty'))->toBe(['Cid'])
        ->and(toManyNames('filter[tags]=not.is.empty'))->toBe(['Ana', 'Bob', 'Dan']);
});

it('matches the rows that have all the values with one filter per value', function () {
    expect(toManyNames('filter[tags][]=in.Red&filter[tags][]=in.Blue'))->toBe(['Ana']);
});

it('adds the rows without related rows to the other filters of the column', function () {
    expect(toManyNames('filter[tags][]=in.Red&filter[tags][]=is.empty'))->toBe(['Ana', 'Cid']);
});

it('combines a to-many filter with the others with join=or', function () {
    expect(toManyNames('filter[tags]=in.Green&filter[name]=eq.Bob&join=or'))->toBe(['Bob', 'Dan']);
});

it('matches the rows where some related value contains the text, or none does', function () {
    expect(toManyNames('filter[tag_text]=ree'))->toBe(['Dan'])
        ->and(toManyNames('filter[tag_text]=not.ilike.blu'))->toBe(['Cid']);
});

it('searches in the related values', function () {
    expect(toManyNames('search=green'))->toBe(['Dan'])
        ->and(toManyNames('search=dan blue'))->toBe(['Dan']);
});

it('counts each row once in every option it has', function () {
    $facets = resolveToMany(taggedMembersTable())['facets']['tags'];

    expect($facets)->toBe([
        ['value' => 'Blue', 'label' => 'Blue', 'count' => 3],
        ['value' => 'Green', 'label' => 'Green', 'count' => 1],
        ['value' => 'Red', 'label' => 'Red', 'count' => 1],
        ['value' => null, 'label' => 'No value', 'count' => 1],
    ]);
});

it('counts the options with the other filters but not its own', function () {
    $facets = resolveToMany(taggedMembersTable(), 'filter[tags]=in.Red&filter[name]=b')['facets']['tags'];

    expect(collect($facets)->pluck('count', 'label')->all())->toBe(['Blue' => 1, 'Red' => 0, 'No value' => 0]);
});

it('reads hasMany, hasManyThrough and morphMany relations', function () {
    DB::table('notes')->insert([['id' => 41, 'member_id' => 11, 'title' => 'Plan'], ['id' => 42, 'member_id' => 12, 'title' => 'Memo']]);
    DB::table('comments')->insert([
        ['id' => 51, 'team_id' => 1, 'body' => 'Nice', 'commentable_type' => Note::class, 'commentable_id' => 41],
        ['id' => 52, 'team_id' => 1, 'body' => 'Wrong type', 'commentable_type' => Member::class, 'commentable_id' => 42],
    ]);

    $teams = DataTable::for(Team::query())->columns([
        Column::text('name'),
        Column::option('members')->from('members.name')->filterMultiSelect(),
        Column::option('notes')->from('notes.title')->filterMultiSelect(),
    ]);
    $notes = DataTable::for(Note::query())->columns([
        Column::text('title'),
        Column::option('comments')->from('comments.body')->filterMultiSelect(empty: true),
    ]);

    $team = resolveToMany($teams, 'filter[notes]=in.Memo');
    $note = resolveToMany($notes);

    expect(collect($team['data'])->pluck('name')->all())->toBe(['Ops'])
        ->and($team['data'][0]['members'])->toEqualCanonicalizing(['Ana', 'Bob', 'Cid', 'Dan'])
        ->and(collect($team['facets']['members'])->pluck('count', 'value')->all())->toBe(['Ana' => 1, 'Bob' => 1, 'Cid' => 1, 'Dan' => 1])
        ->and(collect($team['facets']['notes'])->pluck('count', 'value')->all())->toBe(['Memo' => 1, 'Plan' => 1])
        ->and(collect($note['data'])->pluck('comments', 'title')->all())->toBe(['Plan' => ['Nice'], 'Memo' => []])
        ->and(collect($note['facets']['comments'])->pluck('count', 'label')->all())->toBe(['Nice' => 1, 'No value' => 1]);
});

it('applies the constraints of a to-many relation method', function () {
    $table = DataTable::for(Team::query())->columns([
        Column::text('name'),
        Column::option('members')->from('earlyMembers.name')->filterMultiSelect(empty: true),
    ]);

    $resolved = resolveToMany($table, 'filter[members]=is.empty');

    expect(collect($resolved['data'])->pluck('name')->all())->toBe(['Empty'])
        ->and(collect($resolved['facets']['members'])->pluck('count', 'label')->all())->toBe(['Ana' => 1, 'Bob' => 1, 'No value' => 1]);
});

it('rejects a sortable to-many column', function () {
    resolveToMany(DataTable::for(Member::query())->columns([Column::option('tags')->from('tags.label')->sortable()]));
})->throws(LogicException::class, 'The column [tags] uses the to-many relation [tags], so it cannot be sortable: a row has several values.');

it('rejects a to-many column in the default sort', function () {
    resolveToMany(DataTable::for(Member::query())->columns([Column::text('name'), Column::option('tags')->from('tags.label')])->defaultSort('tags'));
})->throws(LogicException::class, 'it cannot be in the default sort');

it('checks that the related column of a to-many column exists', function () {
    config()->set('inertia-datatable.validate_columns', true);

    resolveToMany(DataTable::for(Member::query())->columns([Column::option('tags')->from('tags.nope')->filterMultiSelect()]));
})->throws(LogicException::class, '[tags.nope] does not exist in the database');

it('checks the displayed value of a to-many column on its first related row', function () {
    config()->set('inertia-datatable.validate_columns', true);

    resolveToMany(DataTable::for(Member::query())->columns([Column::text('name'), Column::option('tags')->from('tags.missing')]));
})->throws(LogicException::class, 'The column [tags] has no value to display');

it('accepts the option without value on a to-many column', function () {
    config()->set('inertia-datatable.validate_columns', true);

    expect(resolveToMany(taggedMembersTable())['facets']['tags'])->toHaveCount(4);
});
