import { createApp } from 'vue';
import 'diff2html/bundles/css/diff2html.min.css';
import './legacy-diff-preview.css';
import App from './App.vue';

createApp(App, { ...window.__LEGACY_DIFF_PREVIEW_DATA__ }).mount('#legacy-diff-preview');
