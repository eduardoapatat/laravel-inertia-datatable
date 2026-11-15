import { describe, vi } from 'vite-plus/test';
import { type EffectScope, effectScope, nextTick, shallowRef } from 'vue';

import { type Product, serverTable } from '../../shared/test/server-data-table';
import {
    defineUseServerDataTableTests,
    type MountOptions,
    type TestTable,
} from '../../shared/test/use-server-data-table.cases';

import type { DataTableColumns } from '@/lib/data-table-columns';

import { useServerDataTable } from './useServerDataTable';

vi.mock('@inertiajs/vue3', async () => ({
    router: (await import('../../shared/test/server-data-table')).router,
}));

// The default header and cell use the ui/ components of shadcn-vue, which only
// an app has; these tests do not render cells.
vi.mock('@/components/data-table/DataTableCell.vue', () => ({ default: {} }));
vi.mock('@/components/data-table/DataTableDefaultHeader.vue', () => ({
    default: {},
}));

describe('useServerDataTable (Vue)', () => {
    const server = shallowRef(serverTable());
    let scope: EffectScope | undefined;

    defineUseServerDataTableTests({
        mount(mountOptions: MountOptions) {
            const { table, columns, ...rest } = mountOptions;
            server.value = table;
            scope = effectScope();
            const hook = scope.run(() =>
                useServerDataTable<Product>({
                    ...rest,
                    prop: 'products',
                    table: () => server.value,
                    columns: (columns ?? []) as DataTableColumns<Product>,
                }),
            );

            if (!hook) {
                throw new Error('The composable was not run.');
            }

            return {
                table: () => hook.table as unknown as TestTable,
                isLoading: () => hook.isLoading.value,
                loading: () => hook.loading.value,
                failed: () => hook.failed.value,
                retry: () => hook.retry(),
            };
        },
        async respond(table) {
            server.value = table;
            await nextTick();
        },
        async act(action) {
            action();
            await nextTick();
        },
        unmount() {
            scope?.stop();
            scope = undefined;
        },
    });
});
