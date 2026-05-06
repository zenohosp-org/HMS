// vite.config.js
import { defineConfig } from "file:///C:/Users/cheen/OneDrive/Documents/GitHub/Zenohosp/HMS/HMS-frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/cheen/OneDrive/Documents/GitHub/Zenohosp/HMS/HMS-frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import tailwindcss from "file:///C:/Users/cheen/OneDrive/Documents/GitHub/Zenohosp/HMS/HMS-frontend/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///C:/Users/cheen/OneDrive/Documents/GitHub/Zenohosp/HMS/HMS-frontend/node_modules/autoprefixer/lib/autoprefixer.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve("./src")
    }
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: "./tailwind.config.cjs" }),
        autoprefixer()
      ]
    }
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:9001",
        changeOrigin: true
      },
      "/oauth2": {
        target: "http://localhost:9001",
        changeOrigin: true
      },
      "/login/oauth2": {
        target: "http://localhost:9001",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxjaGVlblxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudHNcXFxcR2l0SHViXFxcXFplbm9ob3NwXFxcXEhNU1xcXFxITVMtZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGNoZWVuXFxcXE9uZURyaXZlXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcWmVub2hvc3BcXFxcSE1TXFxcXEhNUy1mcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvY2hlZW4vT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9aZW5vaG9zcC9ITVMvSE1TLWZyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAndGFpbHdpbmRjc3MnXHJcbmltcG9ydCBhdXRvcHJlZml4ZXIgZnJvbSAnYXV0b3ByZWZpeGVyJ1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAgIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgICBhbGlhczoge1xyXG4gICAgICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZSgnLi9zcmMnKSxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxuICAgIGNzczoge1xyXG4gICAgICAgIHBvc3Rjc3M6IHtcclxuICAgICAgICAgICAgcGx1Z2luczogW1xyXG4gICAgICAgICAgICAgICAgdGFpbHdpbmRjc3MoeyBjb25maWc6ICcuL3RhaWx3aW5kLmNvbmZpZy5janMnIH0pLFxyXG4gICAgICAgICAgICAgICAgYXV0b3ByZWZpeGVyKCksXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgICBwb3J0OiA1MTc0LFxyXG4gICAgICAgIHByb3h5OiB7XHJcbiAgICAgICAgICAgICcvYXBpJzoge1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo5MDAxJyxcclxuICAgICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgJy9vYXV0aDInOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjkwMDEnLFxyXG4gICAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAnL2xvZ2luL29hdXRoMic6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6OTAwMScsXHJcbiAgICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFksU0FBUyxvQkFBb0I7QUFDdmEsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixPQUFPLGlCQUFpQjtBQUN4QixPQUFPLGtCQUFrQjtBQUV6QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsU0FBUztBQUFBLElBQ0wsT0FBTztBQUFBLE1BQ0gsS0FBSyxLQUFLLFFBQVEsT0FBTztBQUFBLElBQzdCO0FBQUEsRUFDSjtBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0QsU0FBUztBQUFBLE1BQ0wsU0FBUztBQUFBLFFBQ0wsWUFBWSxFQUFFLFFBQVEsd0JBQXdCLENBQUM7QUFBQSxRQUMvQyxhQUFhO0FBQUEsTUFDakI7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0gsUUFBUTtBQUFBLFFBQ0osUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ2xCO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDUCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsTUFDbEI7QUFBQSxNQUNBLGlCQUFpQjtBQUFBLFFBQ2IsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLE1BQ2xCO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFDSixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
