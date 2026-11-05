<?php

declare(strict_types=1);

namespace InertiaDataTable\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InertiaDataTable\DataTableEngine;
use InertiaDataTable\TableDefinition;

/**
 * Lets a table work as an Inertia prop (Arrayable) and as a JSON response (Responsable).
 *
 * @phpstan-import-type DataTableResponse from DataTableEngine
 */
trait ResolvesDataTable
{
    private ?Request $request = null;

    abstract public function toDefinition(): TableDefinition;

    public function withRequest(Request $request): static
    {
        $this->request = $request;

        return $this;
    }

    /**
     * @return DataTableResponse
     */
    public function toArray(): array
    {
        // Arrayable::toArray() cannot receive injected arguments: the engine is resolved from
        // the container so an application or a test can replace it.
        return app(DataTableEngine::class)->resolve($this->toDefinition(), $this->request ?? request());
    }

    /**
     * @return DataTableResponse
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }

    /**
     * @param  Request  $request
     */
    public function toResponse($request): JsonResponse
    {
        return new JsonResponse($this->withRequest($request)->toArray());
    }
}
