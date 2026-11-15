<script setup lang="ts">
import { computed, type VNodeChild } from 'vue';

import { Badge } from '@/components/ui/badge';
import {
    getOption,
    getOwn,
    splitVisible,
    toPrimitive,
} from '@/lib/data-table-format';
import type { ColumnSelectOption } from '@/lib/data-table-types';

import {
    type DataTableBadgeProps,
    type DataTableBadgeVariant,
    type DataTableCellProps,
    DataTableRender,
    getCellSetup,
} from './cells';
import DataTableEmptyCell from './DataTableEmptyCell.vue';
import DataTableOptionBadge from './DataTableOptionBadge.vue';

type OptionValue = string | number | boolean;

/**
 * Option labels (select / multi-select) with the icons of the page
 * `meta.options`: as badges with `->badge()` or the `badge` prop, or drawn by
 * the `option` slot or `renderOption`.
 */
const props = defineProps<
    DataTableCellProps & {
        /**
         * Badge props per value, over the variants declared in PHP; shows
         * badges even without `->badge()`.
         */
        badge?: (
            option: ColumnSelectOption | undefined,
            value: OptionValue,
        ) => DataTableBadgeProps;
        /**
         * Draws each value with anything else (a dot, a tooltip, a link…);
         * the cell still splits multiple values and skips empty ones. The
         * `option` slot does the same from a template.
         */
        renderOption?: (
            option: ColumnSelectOption | undefined,
            value: OptionValue,
        ) => VNodeChild;
    }
>();

defineSlots<{
    option?: (props: {
        option: ColumnSelectOption | undefined;
        value: OptionValue;
    }) => VNodeChild;
}>();

const view = computed(() => {
    const { meta } = getCellSetup(props.cell);
    const value = props.cell.getValue();
    const display = meta?.display?.type === 'option' ? meta.display : undefined;
    const asBadge = Boolean(display?.badge) || props.badge !== undefined;
    const values = (Array.isArray(value) ? value : [value])
        .map(toPrimitive)
        .filter((item): item is OptionValue => item !== null && item !== '');
    const { shown, hidden } = splitVisible(values, meta);

    return {
        asBadge,
        hidden: hidden.length,
        rest: hidden
            .map((item) => getOption(meta, item)?.label ?? String(item))
            .join(', '),
        items: shown.map((item) => {
            const option = getOption(meta, item);

            return {
                key: String(item),
                value: item,
                option,
                asBadge,
                badge: {
                    variant: (getOwn(display?.variants, String(item)) ??
                        display?.variant ??
                        'outline') as DataTableBadgeVariant,
                    ...props.badge?.(option, item),
                },
            };
        }),
    };
});
</script>

<template>
    <DataTableEmptyCell v-if="view.items.length === 0" :cell="cell" />
    <!-- `max-w-full` and the `truncate` label keep the "…" of the cell: an
         inline-flex box is clipped without it. -->
    <span v-else class="inline-flex max-w-full flex-wrap items-center gap-1.5">
        <template v-for="item in view.items" :key="item.key">
            <slot
                v-if="$slots.option"
                name="option"
                :option="item.option"
                :value="item.value"
            />
            <DataTableRender
                v-else-if="renderOption"
                :node="renderOption(item.option, item.value)"
            />
            <DataTableOptionBadge
                v-else-if="item.asBadge"
                :option="item.option"
                :value="item.value"
                v-bind="item.badge"
            />
            <span
                v-else
                class="inline-flex max-w-full min-w-0 items-center gap-1.5"
            >
                <component
                    :is="item.option.icon"
                    v-if="item.option?.icon"
                    aria-hidden="true"
                    class="size-3.5 shrink-0 text-muted-foreground"
                />
                <span class="truncate">{{
                    item.option?.label ?? String(item.value)
                }}</span>
            </span>
        </template>
        <template v-if="view.hidden > 0">
            <Badge
                v-if="view.asBadge"
                data-slot="data-table-more"
                variant="secondary"
                :title="view.rest"
            >
                +{{ view.hidden }}
            </Badge>
            <span
                v-else
                data-slot="data-table-more"
                class="text-muted-foreground"
                :title="view.rest"
            >
                +{{ view.hidden }}
            </span>
        </template>
    </span>
</template>
