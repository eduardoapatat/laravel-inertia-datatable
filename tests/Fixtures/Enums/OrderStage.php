<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Enums;

enum OrderStage: string
{
    case Open = 'open';
    case Won = 'won';
    case Lost = 'lost';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Abierta',
            self::Won => 'Ganada',
            self::Lost => 'Perdida',
        };
    }

    public function badgeVariant(): string
    {
        return match ($this) {
            self::Lost => 'destructive',
            default => 'secondary',
        };
    }
}
