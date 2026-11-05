<?php

declare(strict_types=1);

namespace InertiaDataTable;

/**
 * An item of TanStack's `SortingState`.
 */
final readonly class SortItem
{
    public function __construct(public string $id, public bool $desc) {}

    /**
     * Interpreta `-created_at,name`.
     *
     * @return list<self>
     */
    public static function parseList(string $sort): array
    {
        $items = [];

        foreach (explode(',', $sort) as $part) {
            $part = trim($part);
            $desc = str_starts_with($part, '-');
            $id = $desc ? substr($part, 1) : $part;

            if ($id !== '') {
                $items[] = new self($id, $desc);
            }
        }

        return $items;
    }

    /**
     * @return array{id: string, desc: bool}
     */
    public function toArray(): array
    {
        return ['id' => $this->id, 'desc' => $this->desc];
    }
}
