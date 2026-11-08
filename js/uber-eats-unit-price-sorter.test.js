const test = require('node:test');
const assert = require('node:assert/strict');
const sorter = require('./uber-eats-unit-price-sorter.js');

test('product names parse to the total size of the pack', () => {
  const cases = [
    ['光泉無加糖鮮豆漿1857ml', { amount: 1857, unit: 'ml' }],
    ['光泉豆漿-無加糖200ml*6入', { amount: 1200, unit: 'ml' }],
    ['義美豆奶250mlx6入', { amount: 1500, unit: 'ml' }],
    ['福樂保久乳-堅果牛乳200毫升x6包', { amount: 1200, unit: 'ml' }],
    ['So Good高蛋白杏仁奶(無糖)1L', { amount: 1000, unit: 'ml' }],
    ['桂格免浸泡10超纖穀豆飯(含種籽類)1kg', { amount: 1000, unit: 'g' }],
    ['達正優-冰糖糖包6gx50支', { amount: 300, unit: 'g' }],
    ['6入x200ml', { amount: 1200, unit: 'ml' }],
    ['舒立效潤喉糖-柑橘風味20.8g(8粒)', { amount: 20.8, unit: 'g' }],
    ['雀巢美祿2.5X極濃黑巧風味減糖版33g*10入', { amount: 330, unit: 'g' }],
    ['鱷王強力粘鼠板麥芽糖-超大2片', null],
  ];
  for (const [name, expected] of cases) {
    assert.deepEqual(sorter.parseSize(name), expected, name);
  }
});

test('the size label is used only when the name has no weight or volume', () => {
  const PRICE = 99;
  const fromName = sorter.unitPrice(PRICE, '光泉鮮豆漿200ml*6入', '0.2 L');
  assert.equal(fromName.size.amount, 1200);

  const fromLabel = sorter.unitPrice(PRICE, '鱷王強力粘鼠板麥芽糖-超大2片', '600 g');
  assert.deepEqual({ amount: fromLabel.size.amount, unit: fromLabel.unit }, { amount: 600, unit: 'g' });

  const fromCount = sorter.unitPrice(PRICE, '鱷王強力粘鼠板麥芽糖-超大2片', '');
  assert.deepEqual({ value: fromCount.value, unit: fromCount.unit }, { value: 49.5, unit: 'pc' });
});

test('unit price is per 100 g or ml, and per piece for counts', () => {
  assert.equal(sorter.unitPrice(42, '悅氏日式綠茶(無糖)2000ml', '').value, 2.1);
  assert.equal(sorter.unitPrice(60, '餅乾3入', '').value, 20);
  assert.equal(sorter.unitPrice(null, '悅氏日式綠茶(無糖)2000ml', ''), null);
  assert.equal(sorter.unitPrice(42, '神秘商品', ''), null);
});

test('prices keep thousands separators and ignore trailing text', () => {
  assert.equal(sorter.parsePrice('$1,299'), 1299);
  assert.equal(sorter.parsePrice('$74 • 熱門'), 74);
  assert.equal(sorter.parsePrice('售完'), null);
});

test('g and ml sort together, then per-piece prices, then items without a size', () => {
  const items = [
    { name: 'none', info: null },
    { name: 'pc', info: { value: 1, unit: 'pc' } },
    { name: 'ml', info: { value: 5, unit: 'ml' } },
    { name: 'g', info: { value: 3, unit: 'g' } },
  ];
  items.sort((a, b) => sorter.compareUnitPrice(a.info, b.info));
  assert.deepEqual(items.map((i) => i.name), ['g', 'ml', 'pc', 'none']);
});
