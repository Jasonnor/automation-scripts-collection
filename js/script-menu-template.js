(function() {
    'use strict';
    const scriptBody = document.createElement('div')
    scriptBody.id = 'script-body'
    scriptBody.style.zIndex = '999999'
    scriptBody.style.position = 'fixed'
    scriptBody.style.top = 0
    scriptBody.style.right = 0
    scriptBody.style.padding = '2px'
    scriptBody.style.margin = '2px'
    scriptBody.style.fontSize = '1em'
    scriptBody.style.textAlign = 'right'
    const scriptDisplay = document.createElement('div')
    scriptDisplay.id = 'script-display'
    scriptDisplay.onclick = toggleScriptMenuDisplay
    scriptDisplay.style.cursor = 'pointer'
    scriptDisplay.style.display = 'block'
    scriptDisplay.innerText = '🐳'
    const scriptForm = document.createElement('div')
    scriptForm.id = 'script-form'
    scriptForm.style.display = 'none'
    const scriptInputLabel = document.createElement('label')
    scriptInputLabel.setAttribute('for', 'script-input')
    scriptInputLabel.innerText = 'Input'
    const scriptInput = document.createElement('input')
    scriptInput.id = 'script-input'
    scriptInput.type = 'text'
    const scriptButton = document.createElement('button')
    scriptButton.onclick = runScript
    scriptButton.innerText = 'Run'
    scriptForm.append(scriptInputLabel)
    scriptForm.append(scriptInput)
    scriptForm.append(scriptButton)
    scriptBody.append(scriptDisplay)
    scriptBody.append(scriptForm)
    document.body.append(scriptBody)

    function toggleScriptMenuDisplay() {
        const targetElement = document.getElementById('script-form')
        targetElement.style.display = targetElement.style.display === 'block' ? 'none' : 'block'
    }

    function runScript() {
        const scriptInputValue = document.getElementById('script-input').value
        // Put your code here
    }
})();
