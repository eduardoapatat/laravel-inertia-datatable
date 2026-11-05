<?php

declare(strict_types=1);

namespace InertiaDataTable\Concerns;

use InvalidArgumentException;

/**
 * Labels inside the project's shadcn Badge (and the icons declared in React,
 * if any). Any variant of the project's badge.tsx works.
 */
trait HasBadge
{
    /** @var array{badge: bool, variant?: string, variants?: array<string, string>}|null */
    private ?array $badge = null;

    /**
     * `badge('secondary', ['archived' => 'destructive'])` gives the variant of
     * the column and the variant of some values; `false` shows plain labels.
     *
     * @param  array<array-key, string>  $variants  Variant per value.
     */
    public function badge(string|false $variant = 'outline', array $variants = []): static
    {
        if ($variant === false) {
            $this->badge = ['badge' => false];

            return $this;
        }

        foreach ([$variant, ...array_values($variants)] as $name) {
            if (trim($name) === '') {
                throw new InvalidArgumentException('A badge variant must be a non-empty string, such as outline or secondary.');
            }
        }

        $this->badge = ['badge' => true, 'variant' => $variant];

        if ($variants !== []) {
            $keys = array_map($this->badgeKey(...), array_keys($variants));
            $this->badge['variants'] = array_combine($keys, array_values($variants));
        }

        return $this;
    }

    /**
     * Key of a value in `variants`.
     */
    protected function badgeKey(int|string $value): string
    {
        return (string) $value;
    }

    /**
     * @return array{badge?: bool, variant?: string, variants?: array<string, string>}
     */
    private function badgeDisplay(): array
    {
        return $this->badge ?? [];
    }
}
