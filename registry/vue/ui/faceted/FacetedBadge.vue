<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Selected value in the trigger: the project's Badge, `secondary`.
 */
const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
    <Badge
        data-slot="faceted-badge"
        variant="secondary"
        :class="
            cn(
                'max-w-full min-w-0 shrink rounded-sm px-1 font-normal',
                props.class,
            )
        "
    >
        <slot />
    </Badge>
</template>
