const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue');

module.exports = defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('node_modules/naive-ui')) return 'naive-ui';
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/codemirror')) return 'codemirror';
          if (id.includes('node_modules/@lezer')) return 'codemirror';
          if (id.includes('node_modules/vue')) return 'vue';
          if (id.includes('node_modules/lucide-vue-next')) return 'icons';
        }
      }
    }
  }
});
