const test = require('node:test');
const assert = require('node:assert/strict');
const finder = require('./foodpanda-meal-combo-finder.js');

test('restaurant code is the path segment after /restaurant/', () => {
  assert.equal(finder.restaurantCode('/restaurant/v7ab/shop-name'), 'v7ab');
  assert.equal(finder.restaurantCode('/en/restaurant/s0kw'), 's0kw');
  assert.equal(finder.restaurantCode('/restaurants'), '');
});

test('saved exclusions keep dishes missing from the page and skip name:price ids', () => {
  const products = [
    { id: '10', stableId: true },
    { id: 'Soup:80', stableId: false },
  ];
  const ids = finder.nextStoredIds(
    ['10', '99', 'Soup:80'],
    products,
    ['10', 'Soup:80'],
  );
  assert.deepEqual(ids, ['10', '99']);
});

test('including a visible dish drops it, and include-all keeps dishes that are not on the page', () => {
  const products = [{ id: '10', stableId: true }];
  assert.deepEqual(finder.nextStoredIds(['10', '99'], products, []), ['99']);
});

test('a store write replaces that restaurant and leaves the others in place', () => {
  const next = finder.fileWithStore(
    { stores: { aaa: ['1'], bbb: ['2'] } },
    'aaa',
    ['3'],
  );
  assert.deepEqual(next, { stores: { aaa: ['3'], bbb: ['2'] } });
});

test('a restaurant with no exclusions is removed from the file', () => {
  const next = finder.fileWithStore({ stores: { aaa: ['1'], bbb: ['2'] } }, 'aaa', []);
  assert.deepEqual(next, { stores: { bbb: ['2'] } });
});

test('an invalid lists file is refused before anything is written', async () => {
  let writes = 0;
  await assert.rejects(
    () =>
      finder.saveStoreFile({
        read: async () => ({ text: '{', sha: 'sha-1' }),
        write: async () => {
          writes += 1;
        },
        code: 'aaa',
        ids: ['1'],
      }),
    (err) => err.code === 'invalid',
  );
  assert.equal(writes, 0);
});

test('a stale file is reread once and the other restaurant survives that reread', async () => {
  const reads = [
    { text: JSON.stringify({ stores: { aaa: ['1'], bbb: ['9'] } }), sha: 'old' },
    { text: JSON.stringify({ stores: { aaa: ['1'], bbb: ['8'], ccc: ['7'] } }), sha: 'new' },
  ];
  const writes = [];
  await finder.saveStoreFile({
    read: async () => reads.shift(),
    write: async (payload) => {
      writes.push(payload);
      if (writes.length === 1) {
        const err = new Error('conflict');
        err.code = 'conflict';
        throw err;
      }
    },
    code: 'aaa',
    ids: ['1', '2'],
  });
  assert.equal(writes.length, 2);
  assert.equal(writes[1].sha, 'new');
  assert.deepEqual(JSON.parse(writes[1].text), {
    stores: { aaa: ['1', '2'], bbb: ['8'], ccc: ['7'] },
  });
});

test('a second conflict is not retried again', async () => {
  let writes = 0;
  await assert.rejects(
    () =>
      finder.saveStoreFile({
        read: async () => ({ text: '{"stores":{}}', sha: 'sha' }),
        write: async () => {
          writes += 1;
          const err = new Error('conflict');
          err.code = 'conflict';
          throw err;
        },
        code: 'aaa',
        ids: ['1'],
      }),
    (err) => err.code === 'conflict',
  );
  assert.equal(writes, 2);
});

test('the app is kept only when it can see exactly one repository', () => {
  const one = finder.reposFromInstallations([
    {
      total_count: 1,
      repositories: [{ name: 'combo-lists', owner: { login: 'jason' } }],
    },
  ]);
  assert.deepEqual(finder.soleRepository(one.count, one.repos), {
    owner: 'jason',
    name: 'combo-lists',
  });

  const many = finder.reposFromInstallations([
    { total_count: 1, repositories: [{ name: 'a', owner: { login: 'jason' } }] },
    { total_count: 1, repositories: [{ name: 'b', owner: { login: 'jason' } }] },
  ]);
  assert.equal(finder.soleRepository(many.count, many.repos), null);

  const hidden = finder.reposFromInstallations([
    { total_count: 5, repositories: [{ name: 'a', owner: { login: 'jason' } }] },
  ]);
  assert.equal(finder.soleRepository(hidden.count, hidden.repos), null);
});

test('while a save is running, later edits collapse into one follow-up save', async () => {
  const calls = [];
  let release;
  const enqueue = finder.createSaveSequencer(async (payload) => {
    calls.push(payload);
    if (calls.length === 1) {
      await new Promise((resolve) => {
        release = resolve;
      });
    }
  });
  const first = enqueue({ code: 'aaa', ids: ['1'] });
  enqueue({ code: 'aaa', ids: ['1', '2'] });
  const last = enqueue({ code: 'aaa', ids: ['1', '2', '3'] });
  release();
  await Promise.all([first, last]);
  assert.deepEqual(calls, [
    { code: 'aaa', ids: ['1'] },
    { code: 'aaa', ids: ['1', '2', '3'] },
  ]);
});

test('a failed save still sends a newer edit that is already waiting', async () => {
  const calls = [];
  const enqueue = finder.createSaveSequencer(async (payload) => {
    calls.push(payload.ids);
    if (calls.length === 1) throw new Error('save failed');
  });
  const done = enqueue({ ids: ['1'] });
  enqueue({ ids: ['1', '2'] });
  await done;
  assert.deepEqual(calls, [['1'], ['1', '2']]);
});

test('GitHub file content round-trips as UTF-8, including wrapped base64', () => {
  const text = '{"stores":{"v7ab":["10"]}}\n';
  const wrapped = finder.encodeBase64Utf8(text).replace(/(.{10})/g, '$1\n');
  assert.equal(finder.decodeBase64Utf8(wrapped), text);
});

test('without a remote list, exclusions that are not on the page are dropped', () => {
  assert.deepEqual(finder.visibleExclusions(['10', '99'], ['10'], false), ['10']);
  assert.deepEqual(finder.visibleExclusions(['10', '99'], ['10'], true), ['10', '99']);
});
