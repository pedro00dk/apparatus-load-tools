import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
    build: {
        lib: { entry: ['./src/index.ts', './src/solid.tsx'], formats: ['es'] },
        rollupOptions: { external: ['solid-js', 'solid-js/web'] },
        minify: false,
    },
    plugins: [solid()],
})
