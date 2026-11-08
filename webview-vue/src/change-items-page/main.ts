import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'diff2html/bundles/css/diff2html.min.css';
import '../shared';
import App from './App.vue';
import './style.css';

function syncElementPlusTheme() {
	document.documentElement.classList.toggle('dark', document.body.classList.contains('vscode-dark'));
}

syncElementPlusTheme();
new MutationObserver(syncElementPlusTheme).observe(document.body, {
	attributes: true,
	attributeFilter: ['class'],
});

createApp(App, { ...window.__DIFF_REVIEW_DATA__ }).use(ElementPlus).mount('#app');
