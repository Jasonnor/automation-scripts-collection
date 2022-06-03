/* 
https://static.loop54.com/ship-investor.html
Just for fun :)
*/
function delay(n) {
    return new Promise(function (resolve) {
        setTimeout(resolve, n);
    });
}

for (let t = 0; t <= 100; t++) {
    let p = document.querySelector("#app > main > div:nth-child(1) > p:nth-child(2) > strong:nth-child(3)").innerHTML / 100;
    p = p >= 1 ? 0.99 : p;
    let w = parseInt(document.querySelector("#app > main > p").innerHTML.match(/\d+/)[0]);
    let min = Infinity;
    let bestChoice = 1;
    let totalChoice = document.querySelector("#app > main > ul").childElementCount;
    for (let i = 1; i <= totalChoice; i++) {
        let principal = parseInt(document.querySelector(`#app > main > ul > li:nth-child(${i}) > input[type=button]`).value.match(/\d+/)[0]);
        let revenue = parseInt(document.querySelector(`#app > main > ul > li:nth-child(${i})`).innerHTML.split('>')[1].match(/\d+/)[0]);
        let b = (revenue - principal) / principal;
        let f = (p * (b + 1) - 1) / b;
        let investValue = w * f;
        let diff = Math.abs(investValue - principal);
        console.log(`investValue: ${investValue}, diff: ${diff}`);
        if (investValue > 0 && diff < min) {
            min = diff;
            bestChoice = i;
        }
    }
    console.log(`bestChoice: ${bestChoice}`);
    document.querySelector(`#app > main > ul > li:nth-child(${bestChoice}) > input[type=button]`).click();
    await delay(100);
}
