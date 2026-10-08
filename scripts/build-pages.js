// Copies the shared header and footer (partials/*.html) into every page, between
// <!-- partial:NAME --> and <!-- /partial:NAME --> markers. Everything else in a page is edited
// in the page itself; only the marked regions are rewritten.
//
//   npm run build:pages     after editing a partial
//   npm run check:pages     fails if any page is out of date (part of npm test)
//
// Placeholders: {{root}} is '' at the top level and '../' in dist/; the rest are filled per page
// below so each page keeps its current behaviour (active nav item, new-tab social links, etc).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NEW_TAB = ' target="_blank" rel="noopener noreferrer"';

function pages() {
    const top = ['index.html', 'about.html', 'contact.html'];
    const dist = fs.readdirSync(path.join(ROOT, 'dist')).filter(f => f.endsWith('.html')).map(f => `dist/${f}`);
    return [...top, ...dist].filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('<!-- partial:'));
}

function values(file) {
    const inDist = file.startsWith('dist/');
    const current = path.basename(file, '.html'); // index | about | contact | <District> | post
    const root = inDist ? '../' : '';
    const home = inDist ? '../' : './';
    return {
        root,
        home,
        newTab: inDist ? '' : NEW_TAB,
        instagramTop: inDist ? 'http://instagram.com/himachalites/' : 'https://www.instagram.com/himachalites/',
        lazy: current === 'index' ? '' : ' loading="lazy"', // the home page opens at its footer
        navHome: current === 'index' ? '<a class="active">Home</a>' : `<a href="${home}">Home</a>`,
        navAbout: current === 'about' ? '<a href="#" class="active">About</a>' : `<a href="${root}about">About</a>`,
        navContact: current === 'contact' ? '<a href="contact" class="active">Contact Us</a>' : `<a href="${root}contact">Contact Us</a>`,
        logoOpen: current === 'index' ? '' : `<a href="${home}">`,
        logoClose: current === 'index' ? '' : '</a>',
    };
}

function render(name, file, indent) {
    const vars = values(file);
    const text = fs.readFileSync(path.join(ROOT, 'partials', `${name}.html`), 'utf8').replace(/\r/g, '').trimEnd();
    return text.replace(/\{\{(\w+)\}\}/g, (m, key) => {
        if (!(key in vars)) throw new Error(`partials/${name}.html: unknown placeholder ${m}`);
        return vars[key];
    }).split('\n')
        .filter(line => line.trim()) // a placeholder that renders empty leaves no blank line
        .map(line => indent + line).join('\n');
}

// Returns the page with every marked region refreshed
function build(file) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r/g, '');
    return html.replace(/^([ \t]*)<!-- partial:(\w+) -->\n(?:[\s\S]*?\n)?[ \t]*<!-- \/partial:\2 -->$/gm,
        (m, indent, name) => `${indent}<!-- partial:${name} -->\n${render(name, file, indent)}\n${indent}<!-- /partial:${name} -->`);
}

if (require.main === module) {
    const check = process.argv.includes('--check');
    const stale = [];
    for (const file of pages()) {
        const current = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r/g, '');
        const next = build(file);
        if (next === current) continue;
        stale.push(file);
        if (!check) fs.writeFileSync(path.join(ROOT, file), next);
    }
    if (check && stale.length) {
        console.error(`Out of date with partials/: ${stale.join(', ')}\nRun: npm run build:pages`);
        process.exit(1);
    }
    console.log(check ? `${pages().length} pages up to date` : `updated ${stale.length} of ${pages().length} pages`);
}

module.exports = { pages, build };
