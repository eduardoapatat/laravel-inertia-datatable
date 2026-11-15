<?php

declare(strict_types=1);

namespace InertiaDataTable\Query;

use Carbon\CarbonImmutable;

/**
 * A date range relative to today (`rel.<token>`): `today`, `-7d`, `+2w`,
 * `this-month`, `last-year`… Every range is inclusive and made of whole days.
 */
final readonly class RelativeDate
{
    /**
     * Largest N of each unit (about ten years).
     */
    private const array MAX_COUNT = ['d' => 3660, 'w' => 522, 'm' => 120, 'y' => 10];

    private const array DAYS = ['today' => 0, 'yesterday' => -1, 'tomorrow' => 1];

    private function __construct(public string $token) {}

    /**
     * The token in its canonical form (`-07D` → `-7d`, N clamped), or null when
     * it is not a relative date.
     */
    public static function parse(string $value): ?self
    {
        $token = strtolower(trim($value));

        if (array_key_exists($token, self::DAYS) || preg_match('/^(this|last|next)-(week|month|quarter|year)$/', $token) === 1) {
            return new self($token);
        }

        if (preg_match('/^([+-])(\d{1,6})([dwmy])$/', $token, $matches) !== 1) {
            return null;
        }

        [, $sign, $count, $unit] = $matches;
        $count = max(1, min(self::MAX_COUNT[$unit], (int) $count));

        return new self($sign.$count.$unit);
    }

    /**
     * First and last day of the range, as `YYYY-MM-DD`.
     *
     * @param  int  $weekStartsOn  0 = Sunday … 6 = Saturday
     * @return array{string, string}
     */
    public function range(CarbonImmutable $today, int $weekStartsOn = 1): array
    {
        $today = $today->startOfDay();

        if (array_key_exists($this->token, self::DAYS)) {
            $day = $today->addDays(self::DAYS[$this->token]);

            return [$day->toDateString(), $day->toDateString()];
        }

        if (preg_match('/^(this|last|next)-(week|month|quarter|year)$/', $this->token, $matches) === 1) {
            return $this->period($today, $matches[1], $matches[2], $weekStartsOn);
        }

        preg_match('/^([+-])(\d+)([dwmy])$/', $this->token, $matches);
        [, $sign, $count, $unit] = $matches;
        $count = (int) $count;

        $shift = fn (CarbonImmutable $date, int $amount): CarbonImmutable => match ($unit) {
            'd' => $date->addDays($amount),
            'w' => $date->addWeeks($amount),
            'm' => $date->addMonthsNoOverflow($amount),
            default => $date->addYearsNoOverflow($amount),
        };

        // Today counts as the first of the N: `-7d` is today and the 6 days before.
        return $sign === '-'
            ? [$shift($today, -$count)->addDay()->toDateString(), $today->toDateString()]
            : [$today->toDateString(), $shift($today, $count)->subDay()->toDateString()];
    }

    /**
     * @return array{string, string}
     */
    private function period(CarbonImmutable $today, string $which, string $unit, int $weekStartsOn): array
    {
        $offset = match ($which) {
            'last' => -1,
            'next' => 1,
            default => 0,
        };

        $start = match ($unit) {
            'week' => $today->subDays(($today->dayOfWeek - $weekStartsOn + 7) % 7)->addWeeks($offset),
            'month' => $today->startOfMonth()->addMonthsNoOverflow($offset),
            'quarter' => $today->firstOfQuarter()->addMonthsNoOverflow(3 * $offset),
            default => $today->startOfYear()->addYears($offset),
        };

        $end = match ($unit) {
            'week' => $start->addDays(6),
            'month' => $start->endOfMonth(),
            'quarter' => $start->lastOfQuarter(),
            default => $start->endOfYear(),
        };

        return [$start->toDateString(), $end->toDateString()];
    }
}
