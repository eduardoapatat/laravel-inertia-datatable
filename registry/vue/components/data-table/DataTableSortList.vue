<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    ArrowDownUp,
    ChevronDown,
    ChevronsUpDown,
    ChevronUp,
    Trash2,
} from '@lucide/vue';
import { useDirection } from 'reka-ui';
import { computed, type HTMLAttributes, ref } from 'vue';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Faceted,
    type FacetedSelection,
    FacetedContent,
    FacetedEmpty,
    FacetedGroup,
    FacetedInput,
    FacetedItem,
    FacetedItemIndicator,
    FacetedList,
    FacetedTrigger,
} from '@/components/ui/faceted';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { moveItem } from '@/lib/data-table-advanced';
import { getMessage } from '@/lib/data-table-messages';
import type { DataTableIcon, RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';

/**
 * Sorting by several columns: a row per column with its direction, in order
 * of priority, up to the most the server sorts by (`max_sorts`).
 */
const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        disabled?: boolean;
        /** Classes of the button. */
        class?: HTMLAttributes['class'];
        /** Classes of the popover. */
        contentClass?: HTMLAttributes['class'];
        /** Alignment of the popover with the button. */
        align?: 'start' | 'center' | 'end';
        /** Icon of the button; `null` hides it. */
        icon?: DataTableIcon | null;
    }>(),
    { align: 'start', icon: undefined },
);

const table = useDataTable(props.table, 'DataTableSortList');
const dir = useDirection();

const sorting = computed(() => table.atoms.sorting.get());
const columns = computed(() =>
    table
        .getAllColumns()
        .filter((column) => column.getCanSort())
        .map((column) => ({
            value: column.id,
            label: column.columnDef.meta?.label ?? column.id,
        })),
);
const used = computed(() => new Set(sorting.value.map((sort) => sort.id)));
const available = computed(() =>
    columns.value.filter((column) => !used.value.has(column.value)),
);
const maxSorts = computed(() => table.options.meta?.maxSorts ?? Infinity);
const addButton = ref<InstanceType<typeof Button> | null>(null);

function labelOf(id: string) {
    return columns.value.find((column) => column.value === id)?.label ?? id;
}

function choicesOf(id: string) {
    return columns.value.filter(
        (column) => column.value === id || !used.value.has(column.value),
    );
}

function addSort() {
    const [column] = available.value;

    if (column) {
        table.setSorting([...sorting.value, { id: column.value, desc: false }]);
    }
}

function changeColumn(index: number, value: FacetedSelection) {
    const current = sorting.value[index];

    if (typeof value === 'string' && current && value !== current.id) {
        table.setSorting(
            sorting.value.map((item, at) =>
                at === index ? { ...item, id: value } : item,
            ),
        );
    }
}

function changeDirection(index: number, value: unknown) {
    table.setSorting(
        sorting.value.map((item, at) =>
            at === index ? { ...item, desc: value === 'desc' } : item,
        ),
    );
}

function move(index: number, to: number) {
    table.setSorting(moveItem(sorting.value, index, to));
}

function removeSort(index: number) {
    table.setSorting(sorting.value.filter((_, at) => at !== index));
    (addButton.value?.$el as HTMLElement | undefined)?.focus();
}
</script>

<template>
    <Popover>
        <PopoverTrigger as-child>
            <Button
                data-slot="data-table-sort-list-trigger"
                variant="outline"
                :class="props.class"
                :disabled="disabled"
            >
                <component
                    :is="icon ?? ArrowDownUp"
                    v-if="icon !== null"
                    class="text-muted-foreground"
                />
                {{ getMessage(table, 'sort') }}
                <Badge
                    v-if="sorting.length > 0"
                    variant="secondary"
                    class="h-[18.24px] rounded-[3.2px] px-[5.12px] font-mono text-[10.4px] font-normal"
                >
                    {{ sorting.length }}
                </Badge>
            </Button>
        </PopoverTrigger>
        <PopoverContent
            data-slot="data-table-sort-list"
            :aria-label="getMessage(table, 'sort')"
            :dir="dir"
            :align="align"
            :class="
                cn(
                    'flex w-[calc(100vw-2rem)] max-w-[30rem] flex-col gap-3.5 p-4',
                    contentClass,
                )
            "
        >
            <div class="flex flex-col gap-1">
                <h4 class="leading-none font-medium">
                    {{
                        sorting.length > 0
                            ? getMessage(table, 'sort_by')
                            : getMessage(table, 'sort_none')
                    }}
                </h4>
                <p
                    v-if="sorting.length === 0"
                    class="text-sm text-muted-foreground"
                >
                    {{ getMessage(table, 'sort_description') }}
                </p>
            </div>
            <div
                v-if="sorting.length > 0"
                role="list"
                class="flex max-h-80 flex-col gap-2 overflow-y-auto py-0.5"
            >
                <div
                    v-for="(sort, index) in sorting"
                    :key="sort.id"
                    role="listitem"
                    data-slot="data-table-sort-item"
                    :data-column="sort.id"
                    class="flex items-center gap-2"
                >
                    <Faceted
                        :model-value="sort.id"
                        :items="choicesOf(sort.id)"
                        @update:model-value="changeColumn(index, $event)"
                    >
                        <FacetedTrigger as-child>
                            <Button
                                variant="outline"
                                :aria-label="getMessage(table, 'field')"
                                class="h-8 min-w-0 flex-1 justify-between font-normal"
                            >
                                <span class="truncate">{{
                                    labelOf(sort.id)
                                }}</span>
                                <ChevronsUpDown class="text-muted-foreground" />
                            </Button>
                        </FacetedTrigger>
                        <FacetedContent :dir="dir" align="start" class="w-48">
                            <FacetedInput
                                :placeholder="
                                    getMessage(table, 'search_fields')
                                "
                            />
                            <FacetedList>
                                <FacetedEmpty>
                                    {{ getMessage(table, 'no_fields') }}
                                </FacetedEmpty>
                                <FacetedGroup>
                                    <FacetedItem
                                        v-for="column in choicesOf(sort.id)"
                                        :key="column.value"
                                        :value="column.value"
                                    >
                                        <span class="truncate">{{
                                            column.label
                                        }}</span>
                                        <FacetedItemIndicator />
                                    </FacetedItem>
                                </FacetedGroup>
                            </FacetedList>
                        </FacetedContent>
                    </Faceted>
                    <Select
                        :model-value="sort.desc ? 'desc' : 'asc'"
                        @update:model-value="changeDirection(index, $event)"
                    >
                        <SelectTrigger
                            :aria-label="
                                getMessage(table, 'sort_direction', {
                                    label: labelOf(sort.id),
                                })
                            "
                            class="h-8 w-24 shrink-0"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asc">
                                {{ getMessage(table, 'sort_ascending') }}
                            </SelectItem>
                            <SelectItem value="desc">
                                {{ getMessage(table, 'sort_descending') }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="icon"
                        :aria-label="
                            getMessage(table, 'move_up', {
                                label: labelOf(sort.id),
                            })
                        "
                        class="size-8 shrink-0"
                        :disabled="index === 0"
                        @click="move(index, index - 1)"
                    >
                        <ChevronUp />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        :aria-label="
                            getMessage(table, 'move_down', {
                                label: labelOf(sort.id),
                            })
                        "
                        class="size-8 shrink-0"
                        :disabled="index === sorting.length - 1"
                        @click="move(index, index + 1)"
                    >
                        <ChevronDown />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        :aria-label="
                            getMessage(table, 'remove_sort', {
                                label: labelOf(sort.id),
                            })
                        "
                        class="size-8 shrink-0"
                        @click="removeSort(index)"
                    >
                        <Trash2 />
                    </Button>
                </div>
            </div>
            <div class="flex w-full items-center gap-2">
                <Button
                    ref="addButton"
                    size="sm"
                    class="rounded"
                    :disabled="
                        available.length === 0 || sorting.length >= maxSorts
                    "
                    @click="addSort"
                >
                    {{ getMessage(table, 'add_sort') }}
                </Button>
                <Button
                    v-if="sorting.length > 0"
                    variant="outline"
                    size="sm"
                    class="rounded"
                    @click="table.setSorting([])"
                >
                    {{ getMessage(table, 'reset_sorting') }}
                </Button>
            </div>
        </PopoverContent>
    </Popover>
</template>
