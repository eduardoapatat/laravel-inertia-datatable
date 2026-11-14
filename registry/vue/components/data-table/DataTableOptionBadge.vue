<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { toText } from '@/lib/data-table-format';
import type { ColumnSelectOption } from '@/lib/data-table-types';

import type { DataTableBadgeVariant } from './cells';

/**
 * The project's shadcn Badge with the icon and label of an option: the badge
 * of `->badge()`, exported to reuse it in a custom `cell` with any Badge prop
 * (`variant`, `class`) and its own content in the default slot.
 */
defineProps<{
    /** Option of `meta.options`: its icon and label are shown. */
    option?: ColumnSelectOption;
    /** Raw value, shown when there is no option. */
    value?: unknown;
    variant?: DataTableBadgeVariant;
}>();
</script>

<template>
    <Badge :variant="variant">
        <component :is="option.icon" v-if="option?.icon" aria-hidden="true" />
        <slot>{{ option?.label ?? toText(value) }}</slot>
    </Badge>
</template>
