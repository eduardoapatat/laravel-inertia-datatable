<script setup lang="ts">
import { Check } from '@lucide/vue';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

/** A check at the end of an item while it is selected. */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
    <span
        data-slot="faceted-item-indicator"
        :class="
            cn(
                'ml-auto grid place-items-center *:col-start-1 *:row-start-1',
                props.class,
            )
        "
    >
        <span
            v-if="$slots.default"
            class="font-mono text-xs group-data-checked/command-item:invisible"
        >
            <slot />
        </span>
        <Check class="invisible group-data-checked/command-item:visible" />
    </span>
</template>
