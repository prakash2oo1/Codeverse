// API Configuration
const API_BASE_URL = 'http://localhost:8000';

// Function to translate code
async function translateCode(sourceCode, sourceLang, targetLang) {
    try {
        console.log('Sending translation request:', {
            source_code: sourceCode,
            source_language: sourceLang,
            target_language: targetLang
        });

        const response = await fetch(`${API_BASE_URL}/api/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                source_code: sourceCode,
                source_language: sourceLang,
                target_language: targetLang
            })
        });

        const data = await response.json();
        console.log('Translation response:', data);

        if (!response.ok) {
            throw new Error(data.detail || data.error || 'Failed to translate code');
        }

        if (!data.translated_code) {
            throw new Error('No translated code received from server');
        }

        return data.translated_code;
    } catch (error) {
        console.error('Translation error:', error);
        throw new Error(`Translation failed: ${error.message}`);
    }
}

// Function to run code
async function runCode(code, language, outputId) {
    clearTerminal(outputId);
    appendToTerminal(outputId, '> Running code...\n');

    const terminal = document.getElementById(outputId);
    const terminalInterface = makeTerminalInteractive(outputId);
    
    // Create a stateful input manager
    const inputState = {
        buffer: [],
        lastOutput: new Set(),
        isWaitingForInput: false,
        isProcessing: false
    };

    // Function to handle code execution with input
    async function executeWithInput() {
        try {
            const response = await fetch(`${API_BASE_URL}/compile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    source_code: code,
                    language: language,
                    stdin: inputState.buffer.join('\n')
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.error || 'Failed to execute code');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Execution error:', error);
            throw error;
        }
    }

    // Function to process output and handle input
    async function processOutput(outputLines, startIndex = 0) {
        for (let i = startIndex; i < outputLines.length; i++) {
            const line = outputLines[i].trim();
            if (!line || inputState.lastOutput.has(line)) continue;
            
            // Add to output history
            inputState.lastOutput.add(line);
            appendToTerminal(outputId, line + '\n');

            // Check if line is asking for input
            const isInputPrompt = /^.*(?:(?:enter|input|choose).*:|\?|\>|\:)$/i.test(line);
            
            if (isInputPrompt && !inputState.isWaitingForInput && !inputState.isProcessing) {
                inputState.isWaitingForInput = true;
                
                try {
                    const input = await terminalInterface.waitForInput();
                    
                    if (!input || !input.trim()) {
                        appendToTerminal(outputId, 'Error: Input cannot be empty\n', true);
                        inputState.isWaitingForInput = false;
                        return false;
                    }

                    inputState.buffer.push(input.trim());
                    inputState.isWaitingForInput = false;
                    inputState.isProcessing = true;

                    // Execute with new input
                    const result = await executeWithInput();
                    inputState.isProcessing = false;
                    
                    if (!result.success) {
                        appendToTerminal(outputId, `Error: ${result.error}\n`, true);
                        return false;
                    }

                    const newLines = result.output.split(/\r?\n/);
                    const newStartIndex = newLines.findIndex(l => 
                        l.trim() && !inputState.lastOutput.has(l.trim())
                    );

                    if (newStartIndex !== -1) {
                        const success = await processOutput(newLines, newStartIndex);
                        if (!success) return false;
                    }
                } catch (error) {
                    console.error('Input error:', error);
                    appendToTerminal(outputId, `Error: ${error.message}\n`, true);
                    inputState.isWaitingForInput = false;
                    inputState.isProcessing = false;
                    return false;
                }
            }
        }
        return true;
    }

    try {
        // Initial execution
        inputState.isProcessing = true;
        const initialResult = await executeWithInput();
        inputState.isProcessing = false;
        
        if (!initialResult.success) {
            appendToTerminal(outputId, `Error: ${initialResult.error}\n`, true);
            return;
        }

        const outputLines = initialResult.output.split(/\r?\n/);
        await processOutput(outputLines);
        
    } catch (error) {
        console.error('Execution error:', error);
        appendToTerminal(outputId, `Error: ${error.message}\n`, true);
    }
}

// Function to make terminal interactive
function makeTerminalInteractive(outputId) {
    const terminal = document.getElementById(outputId);
    const inputLine = document.createElement('div');
    inputLine.className = 'input-line';
    
    return {
        waitForInput: () => {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'terminal-input';
                
                const handleInput = (e) => {
                    if (e.key === 'Enter') {
                        const value = input.value;
                        input.remove();
                        appendToTerminal(outputId, value + '\n');
                        resolve(value);
                    }
                };
                
                input.addEventListener('keydown', handleInput);
                inputLine.appendChild(input);
                terminal.appendChild(inputLine);
                input.focus();
            });
        }
    };
}

// Helper function to run code with input
async function runCodeWithInput(code, language, outputId, inputLines) {
    try {
        const response = await fetch(`${API_BASE_URL}/compile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                source_code: code,
                language: language,
                stdin: inputLines.join('\\n')
            })
        });

        const data = await response.json();
        
        if (data.success) {
            const outputLines = data.output.split(/\\r?\\n/);
            for (const line of outputLines) {
                if (line.trim()) {
                    appendToTerminal(outputId, line + '\n');
                }
            }
        } else {
            appendToTerminal(outputId, `Error: ${data.error}\n`, true);
        }
    } catch (error) {
        console.error('Execution error:', error);
        appendToTerminal(outputId, `Error: ${error.message}\n`, true);
    }
}

// Helper function to check if backend is available
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        return response.ok;
    } catch (error) {
        console.error('Backend connection error:', error);
        return false;
    }
}
