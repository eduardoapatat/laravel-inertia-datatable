import { defineConfig } from 'vite-plus';

const fromRoot = (path: string) =>
    decodeURIComponent(new URL(path, import.meta.url).pathname);

export default defineConfig({
    resolve: {
        // The `@/lib/...` imports of the registry, as shadcn installs them.
        alias: [
            {
                find: /^@\/lib\/data-table-server$/,
                replacement: fromRoot(
                    './registry/shared/lib/data-table-server.ts',
                ),
            },
            {
                find: /^@\/lib\/(.*)$/,
                replacement: `${fromRoot('./registry/react/lib/')}$1`,
            },
        ],
    },
    test: {
        include: ['registry/**/*.test.ts'],
    },
    lint: {
        // The React code is type-checked by the starter kit CI job, where its
        // dependencies (shadcn, TanStack, Inertia) are installed.
        ignorePatterns: [
            'vendor/**',
            'node_modules/**',
            'r/**',
            'registry/react/**',
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
