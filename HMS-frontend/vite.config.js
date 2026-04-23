import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve('./src'),
        },
    },
    css: {
        postcss: {
            plugins: [
                tailwindcss({ config: './tailwind.config.cjs' }),
                autoprefixer(),
            ],
        },
    },
    server: {
        port: 5174,
        proxy: {
            '/api': {
                target: 'http://localhost:9001',
                changeOrigin: true,
            },
            '/oauth2': {
                target: 'http://localhost:9001',
                changeOrigin: true,
            },
            '/login/oauth2': {
                target: 'http://localhost:9001',
                changeOrigin: true,
            },
        },
    },
})
