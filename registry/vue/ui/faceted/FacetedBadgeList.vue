<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
    <div
        data-slot="faceted-badge-list"
        :class="
            cn(
                'flex w-max max-w-full flex-wrap items-center gap-1',
                props.class,
            )
        "
    >
        <slot />
    </div>
</template>
