<script setup lang="ts" generic="TData extends RowData">
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from '@lucide/vue';
import { computed, type HTMLAttributes } from 'vue';

import { Button } from '@/components/ui/button';
import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';

/**
 * Buttons to go to the first, previous, next and last page.
 */
const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        /**
         * First and last page buttons: always, never, or from the `lg`
         * breakpoint (the default).
         */
        firstLast?: boolean | 'lg';
        class?: HTMLAttributes['class'];
    }>(),
    { firstLast: 'lg' },
);

const table = useDataTable(props.table, 'DataTablePageNav');
const edgeClass = computed(() =>
    props.firstLast === 'lg' ? 'hidden lg:flex' : undefined,
);
// The page count comes from the server response (rowCount), not the state.
const pageIndex = computed(() => table.atoms.pagination.get().pageIndex);
const pageCount = computed(() => table.getPageCount());
const canPreviousPage = computed(() => pageIndex.value > 0);
const canNextPage = computed(() => pageIndex.value < pageCount.value - 1);
</script>

<template>
    <div
        data-slot="data-table-page-nav"
        :class="cn('flex items-center gap-2', props.class)"
    >
        <Button
            v-if="firstLast !== false"
            :aria-label="getMessage(table, 'first_page')"
            variant="outline"
            size="icon"
            :class="edgeClass"
            :disabled="!canPreviousPage"
            @click="table.setPageIndex(0)"
        >
            <ChevronsLeft class="rtl:rotate-180" />
        </Button>
        <Button
            :aria-label="getMessage(table, 'previous_page')"
            variant="outline"
            size="icon"
            :disabled="!canPreviousPage"
            @click="table.previousPage()"
        >
            <ChevronLeft class="rtl:rotate-180" />
        </Button>
        <Button
            :aria-label="getMessage(table, 'next_page')"
            variant="outline"
            size="icon"
            :disabled="!canNextPage"
            @click="table.nextPage()"
        >
            <ChevronRight class="rtl:rotate-180" />
        </Button>
        <Button
            v-if="firstLast !== false"
            :aria-label="getMessage(table, 'last_page')"
            variant="outline"
            size="icon"
            :class="edgeClass"
            :disabled="!canNextPage"
            @click="table.setPageIndex(pageCount - 1)"
        >
            <ChevronsRight class="rtl:rotate-180" />
        </Button>
    </div>
</template>
