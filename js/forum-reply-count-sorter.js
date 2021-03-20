document.querySelectorAll('td.nums>strong').forEach(function(e) {
    const countReply = parseInt(e.textContent)
    const productNode = e.parentNode.parentNode.parentNode
    productNode.setAttribute('countReply', countReply)
})
let categoryItemsArray = Array.from(document.querySelectorAll('[countreply]'))
let sorted = categoryItemsArray.sort(sorter)
function sorter(a,b) {
    if(parseFloat(a.getAttribute('countreply')) < parseFloat(b.getAttribute('countreply'))) return 1
    if(parseFloat(a.getAttribute('countreply')) > parseFloat(b.getAttribute('countreply'))) return -1
    return 0
}
sorted.forEach(e => document.querySelector("#forum_500").appendChild(e))
