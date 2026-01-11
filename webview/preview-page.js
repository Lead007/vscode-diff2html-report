const vscode = acquireVsCodeApi();
const saveBtn = document.getElementById('saveBtn');
const optionForm = document.getElementById('optionForm');
const diffOutput = document.getElementById('diffOutput');

optionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(optionForm);
    const generateFileList = formData.get('generateFileList') === 'on';
    const html = diffOutput ? diffOutput.innerHTML : document.documentElement.outerHTML;
    vscode.postMessage({ type: 'saveHtml', html, options: { generateFileList } });
});