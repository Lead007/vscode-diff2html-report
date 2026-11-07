import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'diff2html/bundles/css/diff2html.min.css';
import 'virtual:uno.css';
import App from './App.vue';
import './style.css';
import './report.css';

function syncElementPlusTheme() {
	document.documentElement.classList.toggle('dark', document.body.classList.contains('vscode-dark'));
}

syncElementPlusTheme();
new MutationObserver(syncElementPlusTheme).observe(document.body, {
	attributes: true,
	attributeFilter: ['class'],
});

createApp(App, { ...window.__DIFF_REVIEW_DATA__ }).use(ElementPlus).mount('#app');
