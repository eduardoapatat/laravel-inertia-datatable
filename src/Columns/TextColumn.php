<?php

declare(strict_types=1);

namespace InertiaDataTable\Columns;

use InertiaDataTable\Column;
use InertiaDataTable\Enums\FilterVariant;
use InvalidArgumentException;

/**
 * Plain text: `Column::text('name')->limit(40)->filterInput('Search name…')`.
 */
final class TextColumn extends Column
{
    private ?int $limit = null;

    /** @var 'url'|'email'|null */
    private ?string $link = null;

    private ?string $placeholder = null;

    /**
     * Cuts long texts to the given characters; the full text stays in the tooltip.
     */
    public function limit(int $characters): self
    {
        if ($characters < 1) {
            throw new InvalidArgumentException('The text limit must be at least 1 character.');
        }

        $this->limit = $characters;

        return $this;
    }

    /**
     * Shows the value as a link (only http and https URLs).
     */
    public function url(): self
    {
        $this->link = 'url';

        return $this;
    }

    /**
     * Shows the value as a mailto link.
     */
    public function email(): self
    {
        $this->link = 'email';

        return $this;
    }

    /**
     * Text input in the toolbar that keeps the rows containing the text. The
     * URL also accepts other operators (`neq.`, `is.empty`…, docs/contract.md §1.4).
     */
    public function filterInput(?string $placeholder = null): self
    {
        $this->placeholder = $placeholder;

        return $this->withFilter(FilterVariant::Text);
    }

    public function display(): array
    {
        return array_filter(
            ['type' => 'text', 'limit' => $this->limit, 'link' => $this->link],
            fn (mixed $value): bool => $value !== null,
        );
    }

    protected function filterOptions(): array
    {
        return $this->placeholder === null ? [] : ['placeholder' => $this->placeholder];
    }
}
