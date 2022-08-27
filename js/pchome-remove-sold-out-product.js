document.querySelectorAll('button.unblock').forEach(function(e) {
    if (e.textContent.includes('售完') || e.textContent.includes('完售') || e.textContent.includes('訂購'))
    {
        const productNode = e.parentNode.parentNode.parentNode.parentNode;
        productNode.remove();
    }
})
