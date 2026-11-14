<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

/** Count of rows of an item, at the end. */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
    <span
        data-slot="faceted-item-count"
        :class="
            cn(
                'ml-auto font-mono text-xs text-muted-foreground tabular-nums',
                props.class,
            )
        "
    >
        <slot />
    </span>
</template>
