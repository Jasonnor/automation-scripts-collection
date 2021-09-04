let keepRules = ['享5折', '點5折', '45折', '65折', '$50', '買一送一']
document.querySelectorAll('.vendor-list>li').forEach(function (vender) {
    const venderTag = vender.querySelector('[data-testid=multi-tag__text]').textContent;
    const categories = Array.apply(null, vender.querySelectorAll('.categories.summary>li>span'));
    const notContainBeverage = categories.every(span => span.textContent !== '飲料');
    if (notContainBeverage && new RegExp(keepRules.join('|')).test(venderTag)) {
        return;
    }
    vender.remove();
})
