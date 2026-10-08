// The home page footer sits at the top of the page, with the district list overlapping its bottom
// edge (css/home.css). Every footer link must stay visible and clickable on every screen size.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tutorialLastSeen', String(Date.now())));
});

// The page opens with a splash screen, then jumps to the bottom (the landing image)
async function openHome(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !document.body.classList.contains('loading-active'));
    await page.waitForTimeout(800);
}

async function scrollToCenter(page, locator) {
    const top = await locator.evaluate(el => {
        const top = Math.round(Math.max(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2));
        // Desktop scrolls through Lenis (js/home.js), which would undo a native scroll; smaller
        // screens use CSS smooth scrolling, so jump instantly
        if (typeof lenis !== 'undefined' && lenis) lenis.scrollTo(top, { immediate: true });
        else window.scrollTo({ top, behavior: 'instant' });
        return top;
    });
    await page.waitForFunction(top => Math.abs(window.scrollY - top) < 2, top);
    await page.waitForTimeout(600); // scroll-linked animations settle
}

test('every home page footer link is on top and clickable', async ({ page }) => {
    await openHome(page);
    const links = page.locator('.footer-column a[href]');
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
        await scrollToCenter(page, link);
        const box = await link.boundingBox();
        const onTop = await page.evaluate(({ x, y, href }) => {
            const hit = document.elementFromPoint(x, y);
            const ok = Boolean(hit && hit.closest(`a[href="${href}"]`));
            return ok || `${x},${y} hit ${hit && hit.outerHTML.slice(0, 120)} (viewport ${innerHeight}, scrollY ${scrollY})`;
        },{ x: box.x + box.width / 2, y: box.y + box.height / 2, href: await link.getAttribute('href') });
        expect(onTop, `${await link.textContent()} is covered`).toBe(true);
    }
});

test('the forest starts right above the first district, with no wide blank band', async ({ page }) => {
    await openHome(page);
    // Gap between the bottom of the footer scene and the top of the Lahaul & Spiti section
    const gap = await page.evaluate(() => {
        const footer = document.querySelector('.footer').getBoundingClientRect();
        const lahaul = document.querySelector('.state-container-1').getBoundingClientRect();
        return lahaul.top - footer.bottom;
    });
    expect(gap).toBeLessThan(0);
});
