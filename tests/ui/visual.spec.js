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

const SHOT = { animations: 'disabled', maxDiffPixelRatio: 0.001 };

for (const [name, url] of PAGES) {
    test(`${name} looks unchanged`, async ({ page }) => {
        await page.goto(url);
        await settle(page);
        await expect(page).toHaveScreenshot(`${name}.png`, { ...SHOT, fullPage: true });
    });
}

// States a full-page capture misses: the open phone menu, the navbar anchored after scrolling, link hover
for (const [name, url] of [['home', '/'], ['about', '/about'], ['Kullu', '/dist/Kullu']]) {
    test(`${name} menu and navbar states look unchanged`, async ({ page }) => {
        await page.goto(url);
        await settle(page);
        const toggle = page.locator('#mobile-menu-toggle');
        if (await toggle.isVisible()) {
            await toggle.click();
            await page.waitForTimeout(700);
            await expect(page).toHaveScreenshot(`${name}-menu-open.png`, SHOT);
            return;
        }
        if (name === 'home') return; // opens at the bottom, away from its navbar
        await page.evaluate(() => window.scrollTo(0, 1200));
        await page.waitForTimeout(700);
        await expect(page).toHaveScreenshot(`${name}-anchored.png`, SHOT);
        await page.locator('.navbar .main-nav a').filter({ hasText: /About|Home/ }).first().hover();
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot(`${name}-hover.png`, SHOT);
    });
}
