// Monaco Editor Configuration
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

let sourceEditor, targetEditor;

// Language mappings for Monaco Editor
const monacoLanguages = {
    'python': 'python',
    'javascript': 'javascript',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'ruby': 'ruby',
    'php': 'php',
    'go': 'go',
    'rust': 'rust',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'typescript': 'typescript'
};

require(['vs/editor/editor.main'], async function () {
    // Check backend connection
    const isBackendAvailable = await checkBackendStatus();
    if (!isBackendAvailable) {
        showToast('Warning: Backend server is not available. Please start the server.');
    }

    // Initialize source editor
    sourceEditor = monaco.editor.create(document.getElementById('source-editor'), {
        value: '# Write your code here\nprint("Hello, World!")',
        language: 'python',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: {
            enabled: false
        },
        fontSize: 14,
        scrollBeyondLastLine: false,
        roundedSelection: false,
        renderLineHighlight: 'all',
        fontFamily: 'Consolas, "Courier New", monospace',
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
    });

    // Initialize target editor
    targetEditor = monaco.editor.create(document.getElementById('target-editor'), {
        value: '// Translated code will appear here',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: {
            enabled: false
        },
        fontSize: 14,
        scrollBeyondLastLine: false,
        roundedSelection: false,
        renderLineHighlight: 'all',
        readOnly: true,
        fontFamily: 'Consolas, "Courier New", monospace',
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
    });

    // Make editors accessible globally
    window.sourceEditor = sourceEditor;
    window.targetEditor = targetEditor;

    // Language change handlers
    document.getElementById('source-language').addEventListener('change', (e) => {
        const lang = e.target.value;
        const monacoLang = monacoLanguages[lang] || 'plaintext';
        monaco.editor.setModelLanguage(sourceEditor.getModel(), monacoLang);
        // Update sample code based on selected language
        const sampleCode = getSampleCode(lang);
        sourceEditor.setValue(sampleCode);
    });

    document.getElementById('target-language').addEventListener('change', (e) => {
        const lang = e.target.value;
        const monacoLang = monacoLanguages[lang] || 'plaintext';
        monaco.editor.setModelLanguage(targetEditor.getModel(), monacoLang);
    });

    // Run button handlers
    document.getElementById('run-source').addEventListener('click', async () => {
        const button = document.getElementById('run-source');
        button.disabled = true;
        button.classList.add('loading');

        try {
            const code = sourceEditor.getValue();
            const language = document.getElementById('source-language').value;
            await runCode(code, language, 'source-output');
        } finally {
            button.disabled = false;
            button.classList.remove('loading');
        }
    });

    document.getElementById('run-target').addEventListener('click', async () => {
        const button = document.getElementById('run-target');
        button.disabled = true;
        button.classList.add('loading');

        try {
            const code = targetEditor.getValue();
            const language = document.getElementById('target-language').value;
            await runCode(code, language, 'target-output');
        } finally {
            button.disabled = false;
            button.classList.remove('loading');
        }
    });

    // Translate button handler
    document.getElementById('translate-button').addEventListener('click', async () => {
        const sourceCode = sourceEditor.getValue();
        const sourceLang = document.getElementById('source-language').value;
        const targetLang = document.getElementById('target-language').value;

        if (!sourceCode.trim()) {
            showToast('Please enter some code to translate');
            return;
        }

        if (sourceLang === targetLang) {
            showToast('Source and target languages must be different');
            return;
        }

        const translateButton = document.getElementById('translate-button');
        translateButton.classList.add('loading');
        translateButton.disabled = true;

        try {
            const translatedCode = await translateCode(sourceCode, sourceLang, targetLang);
            targetEditor.setValue(translatedCode);
            showToast('Code translated successfully!');
        } catch (error) {
            console.error('Translation error:', error);
            showToast(error.message || 'Failed to translate code');
        } finally {
            translateButton.classList.remove('loading');
            translateButton.disabled = false;
        }
    });
});

// Terminal output handling
function appendToTerminal(outputId, text, isError = false) {
    const terminal = document.getElementById(outputId);
    const span = document.createElement('span');
    span.className = isError ? 'error-text' : 'output-text';
    span.textContent = text;
    terminal.appendChild(span);
    terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal(outputId) {
    const terminal = document.getElementById(outputId);
    terminal.innerHTML = '';
}

// Make terminal interactive
function makeTerminalInteractive(terminalId) {
    const terminal = document.getElementById(terminalId);
    let currentInput = '';
    let inputPromise = null;
    let inputResolve = null;

    // Add input line
    function showInputLine() {
        const inputLine = document.createElement('div');
        inputLine.className = 'input-line';
        inputLine.innerHTML = '<span class="prompt">></span> <span class="input-text"></span>';
        terminal.appendChild(inputLine);
        return inputLine.querySelector('.input-text');
    }

    // Handle terminal input
    terminal.addEventListener('keydown', (event) => {
        if (!terminal.classList.contains('active')) return;

        if (event.key === 'Enter' && inputResolve) {
            const input = currentInput;
            appendToTerminal(terminalId, '\n');
            currentInput = '';
            const resolve = inputResolve;
            inputResolve = null;
            resolve(input);
            event.preventDefault();
        } else if (event.key === 'Backspace') {
            if (currentInput.length > 0) {
                currentInput = currentInput.slice(0, -1);
                const inputSpan = terminal.querySelector('.input-line .input-text');
                if (inputSpan) {
                    inputSpan.textContent = currentInput;
                }
            }
            event.preventDefault();
        } else if (event.key.length === 1) {
            currentInput += event.key;
            const inputSpan = terminal.querySelector('.input-line .input-text');
            if (inputSpan) {
                inputSpan.textContent = currentInput;
            }
            event.preventDefault();
        }
    });

    // Make terminal focusable
    terminal.setAttribute('tabindex', '0');
    
    terminal.addEventListener('click', () => {
        terminal.focus();
    });

    // Add active class when focused
    terminal.addEventListener('focus', () => {
        terminal.classList.add('active');
    });

    terminal.addEventListener('blur', () => {
        terminal.classList.remove('active');
    });

    return {
        waitForInput: async () => {
            if (inputPromise) return inputPromise;
            
            const inputSpan = showInputLine();
            inputPromise = new Promise(resolve => {
                inputResolve = resolve;
            });
            
            return inputPromise.finally(() => {
                inputPromise = null;
                if (inputSpan) {
                    inputSpan.parentElement.remove();
                }
            });
        }
    };
}

// Initialize interactive terminals
document.addEventListener('DOMContentLoaded', () => {
    const sourceTerminal = makeTerminalInteractive('source-output');
    const targetTerminal = makeTerminalInteractive('target-output');
});

// Sample code for different languages
function getSampleCode(language) {
    const samples = {
        python: '# Write your Python code here\nprint("Hello, World!")\n\n# Example: Calculate factorial\ndef factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))',
        javascript: '// Write your JavaScript code here\nconsole.log("Hello, World!");\n\n// Example: Calculate factorial\nfunction factorial(n) {\n    if (n === 0) return 1;\n    return n * factorial(n - 1);\n}\n\nconsole.log(factorial(5));',
        java: '// Write your Java code here\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n        System.out.println(factorial(5));\n    }\n\n    public static int factorial(int n) {\n        if (n == 0) return 1;\n        return n * factorial(n - 1);\n    }\n}',
        cpp: '// Write your C++ code here\n#include <iostream>\n\nint factorial(int n) {\n    if (n == 0) return 1;\n    return n * factorial(n - 1);\n}\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    std::cout << factorial(5) << std::endl;\n    return 0;\n}',
        ruby: '# Write your Ruby code here\nputs "Hello, World!"\n\n# Example: Calculate factorial\ndef factorial(n)\n    return 1 if n == 0\n    n * factorial(n - 1)\nend\n\nputs factorial(5)',
        c: '// Write your C code here\n#include <stdio.h>\n\nint factorial(int n) {\n    if (n == 0) return 1;\n    return n * factorial(n - 1);\n}\n\nint main() {\n    printf("Hello, World!\\n");\n    printf("%d\\n", factorial(5));\n    return 0;\n}',
        php: '<?php\n// Write your PHP code here\necho "Hello, World!";\n\n// Example: Calculate factorial\nfunction factorial($n) {\n    if ($n == 0) return 1;\n    return $n * factorial($n - 1);\n}\necho factorial(5);\n?>',
        go: '// Write your Go code here\npackage main\n\nimport "fmt"\n\nfunc factorial(n int) int {\n    if n == 0 {\n        return 1\n    }\n    return n * factorial(n - 1)\n}\n\nfunc main() {\n    fmt.Println("Hello, World!")\n    fmt.Println(factorial(5))\n}',
        rust: '// Write your Rust code here\nfn factorial(n: i32) -> i32 {\n    if n == 0 {\n        1\n    } else {\n        n * factorial(n - 1)\n    }\n}\n\nfn main() {\n    println!("Hello, World!");\n    println!("{}", factorial(5));\n}',
        swift: '// Write your Swift code here\nfunc factorial(_ n: Int) -> Int {\n    if n == 0 {\n        return 1\n    }\n    return n * factorial(n - 1)\n}\n\nprint("Hello, World!")\nprint(factorial(5))',
        kotlin: '// Write your Kotlin code here\nfun factorial(n: Int): Int {\n    if (n == 0) return 1\n    return n * factorial(n - 1)\n}\n\nfun main() {\n    println("Hello, World!")\n    println(factorial(5))\n}',
        typescript: '// Write your TypeScript code here\nfunction factorial(n: number): number {\n    if (n === 0) return 1;\n    return n * factorial(n - 1);\n}\n\nconsole.log("Hello, World!");\nconsole.log(factorial(5));'
    };
    return samples[language] || '// Write your code here';
}
