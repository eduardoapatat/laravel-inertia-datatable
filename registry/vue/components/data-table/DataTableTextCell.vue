<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import {
    isEmail,
    isEmptyValue,
    isSafeUrl,
    toText,
    truncate,
} from '@/lib/data-table-format';
import type { RowData } from '@/lib/data-table-tanstack';

import { type DataTableCellProps, getCellSetup } from './cells';
import DataTableEmptyCell from './DataTableEmptyCell.vue';

/**
 * Text, cut with `->limit()` (the full text in the tooltip) and shown as a
 * link with `->url()` or `->email()`.
 */
const props = defineProps<DataTableCellProps<TData>>();

const view = computed(() => {
    const meta = getCellSetup(props.cell).meta;
    const display = meta?.display?.type === 'text' ? meta.display : undefined;
    const value = props.cell.getValue();

    if (isEmptyValue(value)) {
        return null;
    }

    const text = toText(value);
    const shown = truncate(text, display?.limit);
    const title = shown === text ? undefined : text;
    const href =
        display?.link === 'url' && isSafeUrl(text)
            ? text
            : display?.link === 'email' && isEmail(text)
              ? `mailto:${text}`
              : undefined;

    return { shown, title, href, external: display?.link === 'url' };
});
</script>

<template>
    <DataTableEmptyCell v-if="view === null" :cell="cell" />
    <a
        v-else-if="view.href && view.external"
        :href="view.href"
        target="_blank"
        rel="noopener noreferrer"
        :title="view.title"
        class="underline-offset-4 hover:underline"
        >{{ view.shown }}</a
    >
    <a
        v-else-if="view.href"
        :href="view.href"
        :title="view.title"
        class="underline-offset-4 hover:underline"
        >{{ view.shown }}</a
    >
    <span v-else-if="view.title !== undefined" :title="view.title">{{
        view.shown
    }}</span>
    <template v-else>{{ view.shown }}</template>
</template>
