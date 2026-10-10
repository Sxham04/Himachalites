// Phone layout checks on every public page at 360px and 390px wide (runs in the "mobile" project only):
// no sideways overflow, nothing sticking out past the screen, images not cut by their boxes,
// and touch targets of at least 44x44px for the header, menu and footer links.
const { test, expect } = require('@playwright/test');

const DISTRICTS = ['Lahaul-Spiti', 'Kinnaur', 'Chamba', 'Kullu', 'Shimla', 'Kangra',
    'Sirmaur', 'Mandi', 'Solan', 'Bilaspur', 'Hamirpur', 'Una'];
const PAGES = ['/', '/about', '/contact', ...DISTRICTS.map(d => `/dist/${d}`), '/dist/post?d=solan'];
const WIDTHS = [360, 390];

// Runs in the page; returns a list of problems
function findProblems() {
    const vw = innerWidth, problems = [];
    const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
        (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '') +
        (el.tagName === 'IMG' ? ` [${(el.currentSrc || el.src).split('/').pop()}]` : '');
    const shown = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.05; };
    // Decorative layers that are meant to reach past the edges
    const decorative = el => el.closest('.parallax-backgrounds, .dashed-line, .cloud-layer, .decorative-svg-wrapper, .rugged-edge');
    const clipper = el => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a); if (/(hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY)) return a; } return null; };

    if (document.documentElement.scrollWidth > vw + 1) problems.push(`page is ${document.documentElement.scrollWidth}px wide`);

    document.querySelectorAll('body *').forEach(el => {
        if (!shown(el) || decorative(el)) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || (r.right <= vw + 2 && r.left >= -2)) return;
        const c = clipper(el);
        if (c) { const cr = c.getBoundingClientRect(); if (cr.right <= vw + 2 && cr.left >= -2) return; }
        problems.push(`${name(el)} sticks out: x ${Math.round(r.left)}..${Math.round(r.right)}`);
    });

    document.querySelectorAll('img').forEach(img => {
        if (!shown(img) || decorative(img) || img.closest('#svg-tip-counter, .navbar, .social-links, .blog-spot, .blog-post')) return;
        const r = img.getBoundingClientRect();
        if (r.width < 30 || r.bottom < 0 || r.top > innerHeight) return;
        const c = clipper(img);
        if (c) {
            const cr = c.getBoundingClientRect();
            const cut = Math.max(cr.top - r.top, r.bottom - cr.bottom, cr.left - r.left, r.right - cr.right);
            if (cut > 3) problems.push(`${name(img)} cut ${Math.round(cut)}px by ${name(c)}`);
        }
    });

    document.querySelectorAll('.top-bar .social-links a, .mobile-menu-button, .footer-column a[href]').forEach(el => {
        if (!shown(el) || el.closest('.parallax-backgrounds')) return;
        const r = el.getBoundingClientRect();
        if (r.width && (r.width < 44 || r.height < 44)) problems.push(`${name(el)} "${el.textContent.trim()}" is ${Math.round(r.width)}x${Math.round(r.height)}px to tap`);
    });
    // District pages: the columns of the dark "Hidden Favourites" section sit centred
    document.querySelectorAll('.split-col').forEach(col => {
        const r = col.getBoundingClientRect();
        if (r.width && Math.abs(r.left - (vw - r.right)) > 4) problems.push(`${name(col)} is off-centre: ${Math.round(r.left)}px left, ${Math.round(vw - r.right)}px right`);
    });
    // District pages: the big district title does not run into the description above it
    const title = document.querySelector('.blended-h1-wrapper h1'), text = document.querySelector('[data-field="description"]');
    if (title && text) {
        const overlap = text.getBoundingClientRect().bottom - title.getBoundingClientRect().top;
        if (overlap > 0) problems.push(`district title overlaps the description by ${Math.round(overlap)}px`);
    }
    return problems;
}

for (const width of WIDTHS) {
    for (const url of PAGES) {
        test(`${url} fits a ${width}px phone`, async ({ browser }, testInfo) => {
            test.skip(testInfo.project.name !== 'mobile', 'phone sizes only');
            const context = await browser.newContext({ ...testInfo.project.use, viewport: { width, height: 800 } });
            await context.addInitScript(() => localStorage.setItem('tutorialLastSeen', String(Date.now())));
            await context.route(/instagram\.com/, route => route.abort());
            const page = await context.newPage();
            await page.goto(url);
            await page.waitForLoadState('networkidle');
            if (url === '/') await page.waitForFunction(() => !document.body.classList.contains('loading-active'));
            await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; }));
            await page.waitForTimeout(600);

            const problems = new Set();
            // The home page is checked with each district in view (it opens at the bottom)
            const stops = url === '/' ? await page.evaluate(() => [...document.querySelectorAll('.state-container')]
                .map(el => Math.round(el.getBoundingClientRect().top + scrollY - 60))) : [0];
            for (const top of stops) {
                await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), top);
                await page.waitForTimeout(url === '/' ? 500 : 0);
                (await page.evaluate(findProblems)).forEach(p => problems.add(p));
            }
            await context.close();
            expect([...problems]).toEqual([]);
        });
    }
}
