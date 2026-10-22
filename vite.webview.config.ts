import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
	root: fileURLToPath(new URL('./webview-vue', import.meta.url)),
	base: './',
	plugins: [UnoCSS(), vue()],
	build: {
		sourcemap: mode === 'development',
		minify: mode !== 'development',
		outDir: '../webview/vue-dist',
		emptyOutDir: true,
		rollupOptions: {
			output: {
				entryFileNames: 'assets/app.js',
				assetFileNames: 'assets/[name][extname]',
			},
		},
	},
}));
