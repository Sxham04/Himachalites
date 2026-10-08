// Screenshot comparison for every public page, on desktop, tablet and mobile (see playwright.config.js).
// Guards refactors of the shared CSS and page markup: the pages must look exactly the same.
// After an intended visual change, refresh the baselines with: npm run test:update-screenshots
const { test, expect } = require('@playwright/test');

const DISTRICTS = ['Lahaul-Spiti', 'Kinnaur', 'Chamba', 'Kullu', 'Shimla', 'Kangra',
    'Sirmaur', 'Mandi', 'Solan', 'Bilaspur', 'Hamirpur', 'Una'];

const PAGES = [
    ['home', '/'],
    ['about', '/about'],
    ['contact', '/contact'],
    ...DISTRICTS.map(name => [name, `/dist/${name}`]),
    ['stories', '/dist/post?d=solan'],
    ['story', '/dist/post?d=solan&p=barog-station-at-dusk'],
];

test.beforeEach(async ({ page, request }) => {
    await request.post('/__reset');
    // The Instagram embed changes on its own; everything else is served locally or from pinned CDNs
    await page.route(/instagram\.com/, route => route.abort());
    // The home page shows a timed scroll tutorial unless it was seen recently
    await page.addInitScript(() => localStorage.setItem('tutorialLastSeen', String(Date.now())));
});

// Lazy images below the fold would otherwise be blank in a full-page capture
async function settle(page) {
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
        document.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
        await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
        await document.fonts.ready;
    });
    await page.waitForTimeout(1500); // splash fade and scroll-linked layout
}

for (const [name, url] of PAGES) {
    test(`${name} looks unchanged`, async ({ page }) => {
        await page.goto(url);
        await settle(page);
        await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.001 });
    });
}
