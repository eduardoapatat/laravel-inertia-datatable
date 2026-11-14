<script setup lang="ts">
import { ListboxContent } from 'reka-ui';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
    <ListboxContent
        data-slot="faceted-list"
        :class="
            cn(
                'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
                props.class,
            )
        "
    >
        <slot />
    </ListboxContent>
</template>
