import { defineConfig } from 'vite-plus';

const fromRoot = (path: string) =>
    decodeURIComponent(new URL(path, import.meta.url).pathname);

export default defineConfig({
    resolve: {
        // The `@/lib/...` imports of the registry, as shadcn installs them. The
        // shared libs are tested with the React bridge to TanStack Table.
        alias: [
            {
                find: /^@\/lib\/data-table-tanstack$/,
                replacement: fromRoot(
                    './registry/react/lib/data-table-tanstack.ts',
                ),
            },
            {
                find: /^@\/lib\/(.*)$/,
                replacement: `${fromRoot('./registry/shared/lib/')}$1`,
            },
        ],
    },
    test: {
        include: ['registry/**/*.test.ts'],
    },
    lint: {
        // The React and Vue code is type-checked by the starter kit CI jobs,
        // where its dependencies (shadcn, TanStack, Inertia) are installed.
        ignorePatterns: [
            'vendor/**',
            'node_modules/**',
            'r/**',
            'registry/react/**',
            'registry/vue/**',
        ],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        ignorePatterns: ['vendor/**', 'r/**', 'composer.json', '*.md'],
    },
});
