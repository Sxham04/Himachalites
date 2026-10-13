// Home page buttons and the start of the dashed line, on desktop (Lenis), tablet and phone.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tutorialLastSeen', String(Date.now())));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !document.body.classList.contains('loading-active'));
    await page.waitForTimeout(800);
});

// One screen above the landing image: the first district (Una)
const firstDistrictTop = page => page.evaluate(() =>
    document.getElementById('landing-page-container').offsetTop - window.innerHeight);

async function expectToStayAt(page, target) {
    await page.waitForTimeout(2500); // smooth scroll
    const first = await page.evaluate(() => scrollY);
    await page.waitForTimeout(1000);
    const later = await page.evaluate(() => scrollY);
    expect(Math.abs(first - target), `scrolled to ${first}, expected about ${target}`).toBeLessThan(40);
    expect(Math.abs(later - first), 'the page moved back after scrolling').toBeLessThan(5);
}

test('"Take the Road Home" goes up to the first district straight after loading', async ({ page }) => {
    const target = await firstDistrictTop(page);
    await page.locator('.overlay-button').click();
    await expectToStayAt(page, target);
});

test('"Take the Road Home" still works after the visitor has scrolled a little', async ({ page }) => {
    // Clicked while the page is still gliding from a wheel scroll (Lenis on desktop)
    await page.mouse.move(200, 200);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);
    const target = await firstDistrictTop(page);
    await page.locator('.overlay-button').click();
    await expectToStayAt(page, target);
});

test('the down-arrow button returns to the landing image', async ({ page }) => {
    // The button shows in the top half of the page
    const up = await page.evaluate(() => Math.round((document.documentElement.scrollHeight - innerHeight) * 0.3));
    await page.evaluate(y => (typeof lenis !== 'undefined' && lenis) ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo({ top: y, behavior: 'instant' }), up);
    await page.waitForTimeout(1500);
    const landing = await page.evaluate(() => document.getElementById('landing-page-container').offsetTop);
    await page.locator('#scrollToBottomBtn').click();
    await expectToStayAt(page, Math.min(landing, await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)));
});

test('no part of the dashed line shows without the bus', async ({ page }) => {
    // Walk up from the landing image, where the line starts being drawn
    const start = await page.evaluate(() => document.getElementById('landing-page-container').offsetTop);
    for (let step = 0; step < 40; step++) {
        const y = start - step * 15;
        await page.evaluate(y => (typeof lenis !== 'undefined' && lenis) ? lenis.scrollTo(y, { immediate: true }) : window.scrollTo({ top: y, behavior: 'instant' }), y);
        await page.waitForTimeout(80);
        const state = await page.evaluate(() => {
            const path = ['Line', 'tablet-line-path', 'mobile-line-path'].map(id => document.getElementById(id))
                .find(p => p.getBoundingClientRect().height > 0);
            const dashes = getComputedStyle(path).strokeDasharray.split(/[ ,]+/).map(parseFloat);
            const drawn = dashes.length > 2 ? dashes.slice(0, -1).reduce((a, b) => a + b, 0) : 0;
            return { drawn: Math.round(drawn), busShown: document.getElementById('svg-tip-counter').style.opacity === '1' };
        });
        expect(state.drawn > 0 && !state.busShown, `${state.drawn} units of line drawn with the bus hidden, ${step * 15}px above the landing image`).toBe(false);
    }
});
