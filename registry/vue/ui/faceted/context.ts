// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    type ComputedRef,
    inject,
    type InjectionKey,
    onScopeDispose,
    provide,
    reactive,
    type Ref,
} from 'vue';

export interface FacetedOption {
    value: string;
    label: string;
}

export type FacetedValue = string | string[] | undefined;

/** Items of the list that match the search, to hide empty groups. */
export interface FacetedVisibility {
    register: (id: symbol, visible: ComputedRef<boolean>) => void;
    unregister: (id: symbol) => void;
    hasVisible: ComputedRef<boolean>;
}

export interface FacetedContext extends FacetedVisibility {
    value: Ref<FacetedValue>;
    items: ComputedRef<FacetedOption[]>;
    multiple: ComputedRef<boolean>;
    /** Text of the search box; the items that do not match it are hidden. */
    search: Ref<string>;
    selectItem: (value: string) => void;
    clear: () => void;
    setOpen: (open: boolean) => void;
    matches: (value: string, label?: string) => boolean;
}

const FacetedKey: InjectionKey<FacetedContext> = Symbol('Faceted');
const FacetedGroupKey: InjectionKey<FacetedVisibility> = Symbol('FacetedGroup');
const FacetedItemSelectedKey: InjectionKey<ComputedRef<boolean>> =
    Symbol('FacetedItemSelected');

export function provideFaceted(context: FacetedContext) {
    provide(FacetedKey, context);
}

export function useFaceted(name: string): FacetedContext {
    const context = inject(FacetedKey, null);

    if (!context) {
        throw new Error(`${name} must be used inside <Faceted>.`);
    }

    return context;
}

export function provideFacetedGroup(group: FacetedVisibility) {
    provide(FacetedGroupKey, group);
}

export function useFacetedGroup() {
    return inject(FacetedGroupKey, null);
}

export function provideFacetedItemSelected(selected: ComputedRef<boolean>) {
    provide(FacetedItemSelectedKey, selected);
}

export function useFacetedItemSelected() {
    return inject(FacetedItemSelectedKey, null);
}

/**
 * Keeps which registered items are visible, so a group (or the whole list)
 * knows whether the search left anything in it.
 */
export function createVisibility(
    computedFn: (fn: () => boolean) => ComputedRef<boolean>,
) {
    const items = reactive(new Map<symbol, ComputedRef<boolean>>());

    return {
        register: (id: symbol, visible: ComputedRef<boolean>) => {
            items.set(id, visible);
        },
        unregister: (id: symbol) => {
            items.delete(id);
        },
        hasVisible: computedFn(
            () =>
                items.size === 0 ||
                [...items.values()].some((visible) => visible.value),
        ),
    } satisfies FacetedVisibility;
}

/** Registers an item in its group and in the list while it is mounted. */
export function registerFacetedItem(
    visible: ComputedRef<boolean>,
    ...owners: (FacetedVisibility | null)[]
) {
    const id = Symbol('FacetedItem');

    for (const owner of owners) owner?.register(id, visible);
    onScopeDispose(() => {
        for (const owner of owners) owner?.unregister(id);
    });
}

export function getIsValueSelected(
    value: FacetedValue,
    multiple: boolean,
    itemValue: string,
) {
    if (multiple) {
        return Array.isArray(value) && value.includes(itemValue);
    }

    return value === itemValue;
}

export function getSelectedValues(value: FacetedValue): string[] {
    if (Array.isArray(value)) return value;
    return typeof value === 'string' ? [value] : [];
}

export function getSelectedItems(values: string[], items: FacetedOption[]) {
    return values.map(
        (value) =>
            items.find((item) => item.value === value) ?? {
                value,
                label: value,
            },
    );
}
