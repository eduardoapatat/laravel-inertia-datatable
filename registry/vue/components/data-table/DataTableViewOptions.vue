<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { Settings2 } from '@lucide/vue';
import { useDirection } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { Button } from '@/components/ui/button';
import {
    Faceted,
    FacetedContent,
    FacetedEmpty,
    FacetedGroup,
    FacetedInput,
    FacetedItem,
    FacetedItemIndicator,
    FacetedList,
    FacetedTrigger,
} from '@/components/ui/faceted';
import { getMessage } from '@/lib/data-table-messages';
import type { DataTableIcon, RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';

/**
 * Column menu: shows and hides the columns the PHP class allows to hide.
 */
const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        disabled?: boolean;
        /** Classes of the button (the toolbar adds `ms-auto hidden lg:flex`). */
        class?: HTMLAttributes['class'];
        /** Classes of the popover. */
        contentClass?: HTMLAttributes['class'];
        /** Alignment of the popover with the button. */
        align?: 'start' | 'center' | 'end';
        /** Icon of the button; `null` hides it. */
        icon?: DataTableIcon | null;
    }>(),
    { align: 'center', icon: undefined },
);

const table = useDataTable(props.table, 'DataTableViewOptions');
const dir = useDirection();

const columns = computed(() =>
    table
        .getAllColumns()
        .filter(
            (column) => column.accessorFn !== undefined && column.getCanHide(),
        ),
);
const items = computed(() =>
    columns.value.map((column) => ({
        value: column.id,
        label: column.columnDef.meta?.label ?? column.id,
    })),
);
const visible = computed(() => {
    const visibility = table.atoms.columnVisibility.get();

    return columns.value
        .filter((column) => visibility[column.id] !== false)
        .map((column) => column.id);
});

function toggle(id: string) {
    table.getColumn(id)?.toggleVisibility();
}
</script>

<template>
    <Faceted multiple :model-value="visible" :items="items">
        <FacetedTrigger as-child>
            <Button
                :aria-label="getMessage(table, 'view_columns')"
                variant="outline"
                :class="props.class"
                :disabled="disabled"
            >
                <component
                    :is="icon ?? Settings2"
                    v-if="icon !== null"
                    class="text-muted-foreground"
                />
                {{ getMessage(table, 'view') }}
            </Button>
        </FacetedTrigger>
        <FacetedContent
            :aria-label="getMessage(table, 'columns')"
            :dir="dir"
            :align="align"
            :class="cn('w-44', contentClass)"
        >
            <FacetedInput :placeholder="getMessage(table, 'search_columns')" />
            <FacetedList>
                <FacetedEmpty>
                    {{ getMessage(table, 'no_columns') }}
                </FacetedEmpty>
                <FacetedGroup>
                    <FacetedItem
                        v-for="item in items"
                        :key="item.value"
                        :value="item.value"
                        @select="toggle"
                    >
                        <span class="truncate">{{ item.label }}</span>
                        <FacetedItemIndicator />
                    </FacetedItem>
                </FacetedGroup>
            </FacetedList>
        </FacetedContent>
    </Faceted>
</template>
