import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import '../shared';
import App from './App.vue';

function syncElementPlusTheme() {
	document.documentElement.classList.toggle('dark', document.body.classList.contains('vscode-dark'));
}

syncElementPlusTheme();
new MutationObserver(syncElementPlusTheme).observe(document.body, {
	attributes: true,
	attributeFilter: ['class'],
});

createApp(App, { ...window.__LEGACY_DIFF_PREVIEW_DATA__ }).use(ElementPlus).mount('#app');
