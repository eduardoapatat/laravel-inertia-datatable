<script setup lang="ts">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    computed,
    type HTMLAttributes,
    onBeforeUnmount,
    onMounted,
    ref,
} from 'vue';

import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { getSkeletonShape } from '@/lib/data-table-loading';
import { DEFAULT_MESSAGES } from '@/lib/data-table-messages';
import type { ServerTableConfig } from '@/lib/data-table-server';
import { cn } from '@/lib/utils';

const props = withDefaults(
    defineProps<{
        /**
         * Config of the table (`->config()` in PHP, which runs no query): the
         * skeleton takes its visible columns with their labels, the page size,
         * the search and the filters. The props below win over it.
         */
        config?: ServerTableConfig;
        /**
         * Width in px of the columns whose `size` the page sets, by id (the
         * same `size` of the table component), so the table does not jump on
         * load.
         */
        sizes?: Record<string, number>;
        /** Needed without `config`. */
        columnCount?: number;
        rowCount?: number;
        filterCount?: number;
        /** Search placeholder in the toolbar (`searchable` with `config`). */
        withSearch?: boolean;
        cellWidths?: string[];
        withViewOptions?: boolean;
        withPagination?: boolean;
        shrinkZero?: boolean;
        /** Text for screen readers; it has no table to read the texts from. */
        label?: string;
        /**
         * Wait before showing it (ms), so a fast load does not flash it; it
         * keeps its space meanwhile. `0` shows it at once.
         */
        delay?: number;
        class?: HTMLAttributes['class'];
    }>(),
    {
        withSearch: undefined,
        withViewOptions: true,
        withPagination: true,
        shrinkZero: false,
        delay: 150,
    },
);

// Empty on the server render, so it agrees with the first client one.
const search = ref('');
const visible = ref(props.delay <= 0);
let timer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
    search.value = window.location.search;

    if (props.delay > 0) {
        timer = setTimeout(() => {
            visible.value = true;
        }, props.delay);
    }
});

onBeforeUnmount(() => clearTimeout(timer));

const view = computed(() => {
    const shape = props.config
        ? getSkeletonShape(props.config, search.value)
        : undefined;
    const headers =
        props.columnCount === undefined ? shape?.columns : undefined;
    const columnCount = props.columnCount ?? shape?.columns.length ?? 1;
    // With the columns of the table, its layout: fixed, 150px by default.
    const cellWidths = props.cellWidths ?? [headers ? '150px' : 'auto'];

    return {
        headers,
        columnCount,
        rowCount: props.rowCount ?? shape?.rowCount ?? 10,
        filters: Array.from(
            { length: props.filterCount ?? shape?.filterCount ?? 0 },
            (_, index) =>
                props.filterCount === undefined
                    ? shape?.filters[index]
                    : undefined,
        ),
        withSearch: props.withSearch ?? shape?.searchable ?? false,
        label: props.label ?? shape?.label ?? DEFAULT_MESSAGES.loading,
        widths: Array.from({ length: columnCount }, (_, index) => {
            const size = props.sizes?.[headers?.[index]?.id ?? ''];
            const width =
                size === undefined
                    ? (cellWidths[index % cellWidths.length] ?? 'auto')
                    : `${size}px`;

            return {
                width,
                minWidth: props.shrinkZero ? width : 'auto',
            };
        }),
    };
});
</script>

<template>
    <div
        data-slot="data-table-skeleton"
        role="status"
        :class="
            cn(
                'flex w-full flex-col gap-2.5 overflow-auto',
                !visible && 'invisible',
                props.class,
            )
        "
    >
        <span class="sr-only">{{ view.label }}</span>
        <div
            aria-hidden="true"
            class="flex w-full items-center justify-between gap-2 overflow-auto p-1"
        >
            <div class="flex flex-1 flex-wrap items-center gap-2">
                <Skeleton
                    v-if="view.withSearch"
                    class="h-9 w-40 rounded-lg lg:w-64"
                />
                <template v-for="(filter, index) in view.filters" :key="index">
                    <!-- As wide as the button: icon and label, hidden. -->
                    <Skeleton
                        v-if="filter?.kind === 'button'"
                        class="flex h-9 items-center gap-2 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap"
                    >
                        <span class="size-4" />
                        <span class="invisible">{{ filter.label }}</span>
                    </Skeleton>
                    <Skeleton
                        v-else
                        :class="
                            cn(
                                'rounded-lg',
                                filter?.kind === 'text'
                                    ? 'h-9 w-40 lg:w-56'
                                    : filter
                                      ? 'h-9 w-40'
                                      : 'h-8 w-24',
                            )
                        "
                    />
                </template>
            </div>
            <Skeleton
                v-if="withViewOptions"
                class="ms-auto hidden h-8 w-18 rounded-lg lg:flex"
            />
        </div>
        <div aria-hidden="true" class="rounded-md border">
            <Table :class="view.headers ? 'table-fixed' : undefined">
                <TableHeader>
                    <TableRow class="hover:bg-transparent">
                        <TableHead
                            v-for="(width, j) in view.widths"
                            :key="j"
                            :class="
                                view.headers?.[j]?.align === 'end'
                                    ? 'pe-8 text-end'
                                    : 'text-start'
                            "
                            :style="width"
                        >
                            <span v-if="view.headers" class="block truncate">{{
                                view.headers[j]?.label
                            }}</span>
                            <Skeleton v-else class="h-6 w-full" />
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow
                        v-for="i in view.rowCount"
                        :key="i"
                        class="hover:bg-transparent"
                    >
                        <TableCell
                            v-for="(width, j) in view.widths"
                            :key="j"
                            :style="width"
                        >
                            <Skeleton
                                :class="
                                    cn(
                                        'w-full',
                                        view.headers?.[j]?.badge
                                            ? 'h-5.5'
                                            : 'h-5',
                                    )
                                "
                            />
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
        <div
            v-if="withPagination"
            aria-hidden="true"
            :class="
                cn(
                    'flex w-full items-center gap-4 overflow-auto p-1 sm:gap-8',
                    view.headers ? 'justify-end' : 'justify-between',
                )
            "
        >
            <!-- Selected rows: only tables with a selection column. -->
            <Skeleton
                v-if="!view.headers"
                class="h-8 w-40 shrink-0 rounded-lg"
            />
            <div class="flex items-center gap-4 sm:gap-6 lg:gap-8">
                <div class="flex items-center gap-2">
                    <Skeleton class="h-9 w-24 rounded-lg" />
                    <Skeleton class="h-9 w-18 rounded-lg" />
                </div>
                <div
                    class="flex items-center justify-center text-sm font-medium"
                >
                    <Skeleton class="h-9 w-20 rounded-lg" />
                </div>
                <div class="flex items-center gap-2">
                    <Skeleton class="hidden size-9 rounded-lg lg:block" />
                    <Skeleton class="size-9 rounded-lg" />
                    <Skeleton class="size-9 rounded-lg" />
                    <Skeleton class="hidden size-9 rounded-lg lg:block" />
                </div>
            </div>
        </div>
    </div>
</template>
