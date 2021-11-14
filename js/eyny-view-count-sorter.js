document.querySelectorAll('td.num>em').forEach(function(e) {
    const viewCount = parseInt(e.textContent)
    const productNode = e.parentNode.parentNode.parentNode
    productNode.setAttribute('viewCount', viewCount)
})
let categoryItemsArray = Array.from(document.querySelectorAll('[viewcount]'))
let sorted = categoryItemsArray.sort(sorter)
function sorter(a,b) {
    if(parseFloat(a.getAttribute('viewcount')) < parseFloat(b.getAttribute('viewcount'))) return 1
    if(parseFloat(a.getAttribute('viewcount')) > parseFloat(b.getAttribute('viewcount'))) return -1
    return 0
}
sorted.forEach(e => document.querySelector('#moderate>table').appendChild(e))
document.querySelectorAll('#separatorline').forEach(e => e.remove())
document.querySelectorAll('p.autopagerize_page_info').forEach(e => e.remove())
document.querySelectorAll('hr.autopagerize_page_separator').forEach(e => e.remove())
