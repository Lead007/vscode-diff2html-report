import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss/vite';
import { fileURLToPath } from 'node:url';

const webviewRoot = fileURLToPath(new URL('./webview-vue', import.meta.url));

export default defineConfig(({ mode }) => ({
	root: webviewRoot,
	base: './',
	plugins: [UnoCSS(), vue()],
	build: {
		sourcemap: mode === 'development',
		minify: mode !== 'development',
		outDir: '../webview/vue-dist',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				changeItemsPage: fileURLToPath(new URL('./webview-vue/change-items-page.html', import.meta.url)),
				legacyDiffPreview: fileURLToPath(new URL('./webview-vue/legacy-diff-preview.html', import.meta.url)),
			},
			output: {
				entryFileNames: 'assets/[name].js',
				assetFileNames: 'assets/[name][extname]',
			},
		},
	},
}));
