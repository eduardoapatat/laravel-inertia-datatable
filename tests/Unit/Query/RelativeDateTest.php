<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use InertiaDataTable\Query\RelativeDate;

it('resolves each token to its days, today included', function (string $token, string $today, array $range, int $weekStartsOn = 1) {
    expect(RelativeDate::parse($token)?->range(CarbonImmutable::parse($today), $weekStartsOn))->toBe($range);
})->with([
    'today' => ['today', '2026-11-15', ['2026-11-15', '2026-11-15']],
    'yesterday across a year' => ['yesterday', '2026-01-01', ['2025-12-31', '2025-12-31']],
    'tomorrow' => ['tomorrow', '2026-11-15', ['2026-11-16', '2026-11-16']],
    'last 7 days' => ['-7d', '2026-11-15', ['2026-11-09', '2026-11-15']],
    'next 7 days' => ['+7d', '2026-11-15', ['2026-11-15', '2026-11-21']],
    'last day is today' => ['-1d', '2026-11-15', ['2026-11-15', '2026-11-15']],
    'last 2 weeks' => ['-2w', '2026-11-15', ['2026-11-02', '2026-11-15']],
    'last month from the end of March' => ['-1m', '2026-03-31', ['2026-03-01', '2026-03-31']],
    'next month from the end of January' => ['+1m', '2026-01-31', ['2026-01-31', '2026-02-27']],
    'last year from a leap day' => ['-1y', '2028-02-29', ['2027-03-01', '2028-02-29']],
    'week from Monday' => ['this-week', '2026-11-15', ['2026-11-09', '2026-11-15']],
    'week from Sunday' => ['this-week', '2026-11-15', ['2026-11-15', '2026-11-21'], 0],
    'last week' => ['last-week', '2026-11-15', ['2026-11-02', '2026-11-08']],
    'next week' => ['next-week', '2026-11-15', ['2026-11-16', '2026-11-22']],
    'this month' => ['this-month', '2026-02-10', ['2026-02-01', '2026-02-28']],
    'last month across a year' => ['last-month', '2026-01-31', ['2025-12-01', '2025-12-31']],
    'next month' => ['next-month', '2026-01-31', ['2026-02-01', '2026-02-28']],
    'this quarter' => ['this-quarter', '2026-11-15', ['2026-10-01', '2026-12-31']],
    'last quarter' => ['last-quarter', '2026-02-15', ['2025-10-01', '2025-12-31']],
    'next quarter' => ['next-quarter', '2026-11-15', ['2027-01-01', '2027-03-31']],
    'this year' => ['this-year', '2026-11-15', ['2026-01-01', '2026-12-31']],
    'last year' => ['last-year', '2026-11-15', ['2025-01-01', '2025-12-31']],
    'the time of today is ignored' => ['today', '2026-11-15 23:59:59', ['2026-11-15', '2026-11-15']],
]);

it('normalizes the token', function (string $value, string $token) {
    expect(RelativeDate::parse($value)?->token)->toBe($token);
})->with([
    'upper case and spaces' => [' This-Month ', 'this-month'],
    'leading zeros' => ['-07D', '-7d'],
    'zero is one' => ['-0d', '-1d'],
    'days clamped' => ['-99999d', '-3660d'],
    'weeks clamped' => ['+1000w', '+522w'],
    'months clamped' => ['-500m', '-120m'],
    'years clamped' => ['+50y', '+10y'],
]);

it('rejects what is not a relative date', function (string $value) {
    expect(RelativeDate::parse($value))->toBeNull();
})->with(['', 'now', '7d', '-7', '-7h', '--7d', '-1234567d', 'this-day', 'this_week', '2026-11-15', '-7d,+7d']);
