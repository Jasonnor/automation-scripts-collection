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
    scriptBody.append(scriptDisplay)
    const scriptForm = document.createElement('div')
    scriptForm.id = 'script-form'
    scriptForm.style.display = 'none'
    scriptBody.append(scriptForm)
    const scriptInputLabel = document.createElement('label')
    scriptInputLabel.setAttribute('for', 'script-input')
    scriptInputLabel.innerText = 'Input'
    scriptForm.append(scriptInputLabel)
    const scriptInput = document.createElement('input')
    scriptInput.id = 'script-input'
    scriptInput.type = 'text'
    scriptForm.append(scriptInput)
    const scriptButton = document.createElement('button')
    scriptButton.onclick = runScript
    scriptButton.innerText = 'Run'
    scriptForm.append(scriptButton)
    document.body.append(scriptBody)

    const addCSS = s => (document.head.appendChild(document.createElement('style')).innerHTML = s)
    addCSS('#script-form > * { margin: 5px; display: block; }')

    function toggleScriptMenuDisplay() {
        const targetElement = document.getElementById('script-form')
        targetElement.style.display = targetElement.style.display === 'block' ? 'none' : 'block'
    }

    function runScript() {
        const scriptInputValue = document.getElementById('script-input').value
        // Put your code here
    }
})();
