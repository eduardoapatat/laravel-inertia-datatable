import { act, renderHook } from '@testing-library/react';
import { describe, vi } from 'vite-plus/test';

import type { DataTableColumns } from '@/lib/data-table-columns';

import type { Product } from '../../shared/test/server-data-table';
import {
    defineUseServerDataTableTests,
    type MountOptions,
    type TestTable,
} from '../../shared/test/use-server-data-table.cases';

import {
    useServerDataTable,
    type UseServerDataTableOptions,
} from './use-server-data-table';

vi.mock('@inertiajs/react', async () => ({
    router: (await import('../../shared/test/server-data-table')).router,
}));

// The default header and cell use the ui/ components of shadcn, which only an
// app has; these tests do not render cells.
vi.mock('@/components/data-table/data-table-default-column', () => ({
    DataTableDefaultCell: () => null,
    DataTableDefaultHeader: () => null,
    getOptionLabel: () => '',
}));

type Options = UseServerDataTableOptions<Product>;
type Hook = ReturnType<typeof useServerDataTable<Product>>;

describe('useServerDataTable (React)', () => {
    let rendered:
        | ReturnType<typeof renderHook<Hook, { options: Options }>>
        | undefined;
    let options: Options;

    defineUseServerDataTableTests({
        mount(mountOptions: MountOptions) {
            options = {
                prop: 'products',
                ...mountOptions,
                columns: (mountOptions.columns ??
                    []) as DataTableColumns<Product>,
            };
            const current = renderHook(
                (props: { options: Options }) =>
                    useServerDataTable(props.options),
                { initialProps: { options } },
            );
            rendered = current;
            const hook = () => current.result.current;

            return {
                table: () => hook().table as unknown as TestTable,
                isLoading: () => hook().isLoading,
                loading: () => hook().loading,
                failed: () => hook().failed,
                retry: () => hook().retry(),
            };
        },
        async respond(table) {
            options = { ...options, table };
            const current = rendered;
            await act(async () => current?.rerender({ options }));
        },
        async act(action) {
            await act(async () => action());
        },
        unmount() {
            rendered?.unmount();
            rendered = undefined;
        },
    });
});
