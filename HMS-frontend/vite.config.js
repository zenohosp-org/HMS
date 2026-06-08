import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
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
            // Labs service (radiology + health-checkups). Same-origin proxy
            // so the SSO cookie is sent without an extra CORS handshake in
            // dev. Production uses the absolute https://api-labs.zenohosp.com.
            '/labs-api': {
                target: 'http://localhost:8086',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/labs-api/, '/api'),
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
