document.querySelectorAll('.nick>a').forEach(function (e) {
    const regexResult = /(\d+)[G|公]/i.exec(e.textContent)
    if (regexResult !== null) {
        const weight = parseInt(regexResult[1])
        const productNode = e.parentNode.parentNode.parentNode
        const price = parseInt(productNode.querySelector('.price_box>li>.price>.value').textContent)
        const costPerformance = (weight / price).toFixed(2)
        let costPerformanceNode = document.createElement('span')
        costPerformanceNode.innerText = `${costPerformance} g/NTD`
        costPerformanceNode.className = 'slogan'
        costPerformanceNode.style.color = 'red'
        productNode.setAttribute('performance', costPerformance)
        e.parentNode.parentNode.append(costPerformanceNode)
    }
})
const categoryItemsArray = Array.from(document.querySelectorAll('[performance]'))
const sorted = categoryItemsArray.sort(sorter)

function sorter(a, b) {
    if (parseFloat(a.getAttribute('performance')) < parseFloat(b.getAttribute('performance'))) return 1
    if (parseFloat(a.getAttribute('performance')) > parseFloat(b.getAttribute('performance'))) return -1
    return 0
}

sorted.forEach(e => document.querySelector("#ProdListContainer").appendChild(e))
