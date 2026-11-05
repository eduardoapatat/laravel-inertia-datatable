import { defineConfig } from 'vite-plus';

export default defineConfig({
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
