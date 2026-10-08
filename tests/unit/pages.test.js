// Every page's shared header and footer must match partials/ (see scripts/build-pages.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { pages, build } = require('../../scripts/build-pages.js');

const ROOT = path.join(__dirname, '..', '..');

test('every page with a header and footer uses the partials', () => {
    const html = ['index.html', 'about.html', 'contact.html', ...fs.readdirSync(path.join(ROOT, 'dist'))
        .filter(f => f.endsWith('.html')).map(f => `dist/${f}`)];
    const withFooter = html.filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('class="footer-main-content"'));
    assert.deepStrictEqual(withFooter.sort(), pages().sort());
});

test('pages are up to date with partials/ (run npm run build:pages)', () => {
    for (const file of pages()) {
        const current = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r/g, '');
        assert.strictEqual(current, build(file), `${file} is out of date`);
    }
});
