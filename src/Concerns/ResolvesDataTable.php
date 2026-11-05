<?php

declare(strict_types=1);

namespace InertiaDataTable\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InertiaDataTable\DataTableEngine;
use InertiaDataTable\TableDefinition;

/**
 * Hace que una tabla funcione como prop de Inertia (Arrayable) y como respuesta JSON (Responsable).
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
        // Arrayable::toArray() no admite inyección: se resuelve el motor desde el contenedor
        // para que una aplicación o un test puedan reemplazarlo.
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
