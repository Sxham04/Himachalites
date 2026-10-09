// The home page dashed line is drawn up to the bus by writing the reveal into the path's own
// stroke-dasharray (js/home.js revealPath). It replaced an SVG mask, which WebKit (Safari, iOS)
// re-renders in software every frame; keep masks out of the line.
const { test, expect } = require('@playwright/test');

test('the dashed line is drawn up to the bus, without an SVG mask', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tutorialLastSeen', String(Date.now())));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !document.body.classList.contains('loading-active'));
    await page.waitForTimeout(800);

    // Halfway up the district list
    const top = await page.evaluate(() => {
        const r = document.querySelector('.state-content-sections').getBoundingClientRect();
        const y = Math.round(scrollY + r.top + r.height / 2 - innerHeight / 2);
        if (typeof lenis !== 'undefined' && lenis) lenis.scrollTo(y, { immediate: true });
        else window.scrollTo({ top: y, behavior: 'instant' });
        return y;
    });
    await page.waitForFunction(top => Math.abs(scrollY - top) < 2, top);
    await page.waitForTimeout(800);

    const line = await page.evaluate(() => {
        const path = ['Line', 'tablet-line-path', 'mobile-line-path'].map(id => document.getElementById(id))
            .find(p => p.getBoundingClientRect().height > 0);
        const dashes = getComputedStyle(path).strokeDasharray.split(/[ ,]+/).map(parseFloat);
        return {
            masks: document.querySelectorAll('.dashed-line mask, .dashed-line [mask]').length,
            entries: dashes.length,
            drawn: dashes.slice(0, -1).reduce((a, b) => a + b, 0),
            finalGap: dashes[dashes.length - 1],
            length: path.getTotalLength(),
        };
    });
    expect(line.masks).toBe(0);
    expect(line.entries).toBeGreaterThan(10); // the reveal is applied, not overridden by CSS
    expect(line.finalGap).toBeGreaterThan(line.length); // everything past the bus is hidden
    expect(line.drawn).toBeGreaterThan(line.length * 0.2); // halfway up, part of the line is drawn
    expect(line.drawn).toBeLessThan(line.length * 0.8);
});
