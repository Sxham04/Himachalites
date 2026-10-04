const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../../admin/admin-lib.js');

test('slugify makes a clean link from a title', () => {
    assert.equal(lib.slugify('Mushrooms, Mist & the Road to Chail!'), 'mushrooms-mist-and-the-road-to-chail');
    assert.equal(lib.slugify('  Barog   station  '), 'barog-station');
    assert.equal(lib.slugify('Café Dhābā'), 'cafe-dhaba');
    assert.equal(lib.slugify(''), '');
    assert.equal(lib.slugify(null), '');
});

test('slugify never ends with a hyphen after truncating to 80 characters', () => {
    const slug = lib.slugify(`${'a'.repeat(79)} bcd`);
    assert.ok(slug.length <= 80);
    assert.ok(!slug.endsWith('-'));
});

test('isValidSlug accepts only lowercase words joined by single hyphens', () => {
    assert.ok(lib.isValidSlug('barog-station-at-dusk'));
    assert.ok(lib.isValidSlug('day2'));
    for (const bad of ['', 'Barog', 'two--hyphens', '-start', 'end-', 'has space', 'ü']) {
        assert.equal(lib.isValidSlug(bad), false, bad);
    }
});

test('initials uses two words when there are two, else the first two letters', () => {
    assert.equal(lib.initials('Himachalites team'), 'HT');
    assert.equal(lib.initials('soham.sharma@gmail.com'), 'SS');
    assert.equal(lib.initials('editor@example.com'), 'ED');
    assert.equal(lib.initials(''), '?');
});

test('moveItem moves within bounds and ignores moves past either end', () => {
    assert.deepEqual(lib.moveItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
    assert.deepEqual(lib.moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
    assert.deepEqual(lib.moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
    assert.deepEqual(lib.moveItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
    const original = ['a', 'b'];
    lib.moveItem(original, 0, 1);
    assert.deepEqual(original, ['a', 'b'], 'does not mutate the input');
});

test('cleanSpots trims, drops unnamed spots and renumbers positions', () => {
    const rows = lib.cleanSpots([
        { name: '  Karol ka Tibba ', body: ' A steady climb. ' },
        { name: '   ', body: 'orphan text' },
        { name: 'Barog', body: '' },
    ], 'solan');
    assert.deepEqual(rows, [
        { district_slug: 'solan', name: 'Karol ka Tibba', body: 'A steady climb.', position: 0 },
        { district_slug: 'solan', name: 'Barog', body: '', position: 1 },
    ]);
});

test('statusCounts counts published and drafts', () => {
    assert.deepEqual(lib.statusCounts([{ status: 'published' }, { status: 'draft' }, { status: 'draft' }]), { all: 3, published: 1, draft: 2 });
    assert.deepEqual(lib.statusCounts([]), { all: 0, published: 0, draft: 0 });
});

test('previewPosts puts the draft first and keeps at most 3 others, without duplicating it', () => {
    const published = ['a', 'b', 'c', 'd'].map(slug => ({ slug }));
    assert.deepEqual(lib.previewPosts({ slug: 'new' }, published).map(p => p.slug), ['new', 'a', 'b', 'c']);
    assert.deepEqual(lib.previewPosts({ slug: 'b' }, published).map(p => p.slug), ['b', 'a', 'c', 'd']);
});
