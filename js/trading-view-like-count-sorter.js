document.querySelectorAll('div>span.tv-card-social-item>span.tv-card-social-item__count').forEach(function(e) {
    const likeCount = parseInt(e.textContent)
    const productNode = e.parentNode.parentNode.parentNode.parentNode.parentNode
    productNode.setAttribute('likeCount', likeCount)
})
let categoryItemsArray = Array.from(document.querySelectorAll('[likecount]'))
let sorted = categoryItemsArray.sort(sorter)
function sorter(a,b) {
    if(parseFloat(a.getAttribute('likecount')) < parseFloat(b.getAttribute('likecount'))) return 1
    if(parseFloat(a.getAttribute('likecount')) > parseFloat(b.getAttribute('likecount'))) return -1
    return 0
}
sorted.forEach(e => document.querySelector('div.tv-card-container__ideas').appendChild(e))
