// Admin dashboard and public blog pages, run on desktop, tablet and mobile (see playwright.config.js).
const { test, expect } = require('@playwright/test');

const ADMIN = { email: 'admin@test.local', password: 'admin-pass' };
const AUTHOR = { email: 'author@test.local', password: 'author-pass' };

test.beforeEach(async ({ request }) => {
    await request.post('/__reset');
});

async function signIn(page, who = ADMIN) {
    await page.goto('/admin/index.html');
    await page.getByLabel('Email').fill(who.email);
    await page.getByLabel('Password').fill(who.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.locator('#view-app')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
}

async function openSection(page, name) {
    await page.locator('.rail-nav').getByRole('link', { name }).click();
}

async function expectNoSidewaysScroll(page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
}

async function fillStory(page, { title, district, body }) {
    await page.getByLabel('Title').fill(title);
    await page.locator('#post-district label', { hasText: new RegExp(`^${district}$`) }).click();
    await page.getByLabel('Story', { exact: true }).fill(body);
}

// ---------------------------------------------------------------------------
test.describe('sign in', () => {
    test('asks for an email and password before calling Supabase', async ({ page }) => {
        await page.goto('/admin/index.html');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page.locator('#login-msg')).toHaveText('Enter the email address your account uses.');
        await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');

        await page.getByLabel('Email').fill(ADMIN.email);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page.locator('#login-msg')).toHaveText('Enter your password, or use the sign-in link below.');
    });

    test('rejects a wrong password with a clear message', async ({ page }) => {
        await signInExpectingError(page);
        await expect(page.locator('#login-msg')).toHaveText('That email and password do not match an account.');
    });

    test('admin lands on Districts with every section in the nav', async ({ page }) => {
        await signIn(page);
        await expect(page.locator('#panel-districts')).toBeVisible();
        for (const name of ['Districts', 'Stories', 'Authors']) {
            await expect(page.locator('.rail-nav').getByRole('link', { name })).toBeVisible();
        }
        await expectNoSidewaysScroll(page);
    });

    test('sign out lives in the account menu and returns to the sign-in screen', async ({ page }) => {
        await signIn(page);
        await expect(page.getByRole('button', { name: 'Sign out' })).toBeHidden();
        await page.locator('#account-toggle').click();
        await expect(page.locator('#account-email')).toHaveText(ADMIN.email);
        await page.getByRole('button', { name: 'Sign out' }).click();
        await expect(page.locator('#view-login')).toBeVisible();
    });

    test('the account menu closes with Escape and on an outside click', async ({ page }) => {
        await signIn(page);
        await page.locator('#account-toggle').click();
        await expect(page.locator('#account-toggle')).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(page.locator('#account-toggle')).toHaveAttribute('aria-expanded', 'false');
        await page.locator('#account-toggle').click();
        const { height } = page.viewportSize();
        await page.mouse.click(8, Math.round(height / 2)); // empty page area, clear of the menu on every layout
        await expect(page.locator('#account-toggle')).toHaveAttribute('aria-expanded', 'false');
    });

    test('an author sees only Stories, and only their own', async ({ page }) => {
        await signIn(page, AUTHOR);
        await expect(page.locator('#panel-posts')).toBeVisible();
        await expect(page.locator('.rail-nav').getByRole('link', { name: 'Districts' })).toBeHidden();
        await expect(page.locator('.rail-nav').getByRole('link', { name: 'Authors' })).toBeHidden();
        await expect(page.locator('.post-row')).toHaveCount(1);
        await expect(page.locator('.post-row')).toContainText('A guest draft from Kangra');
    });

    test('an account without a role sees the no-access message', async ({ page }) => {
        await signIn(page, { email: 'pending@test.local', password: 'pending-pass' });
        await expect(page.getByRole('heading', { name: 'Your account doesn\'t have access yet' })).toBeVisible();
    });
});

async function signInExpectingError(page) {
    await page.goto('/admin/index.html');
    await page.getByLabel('Email').fill(ADMIN.email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

// ---------------------------------------------------------------------------
test.describe('districts', () => {
    test('lists all 12 districts and switches between them', async ({ page }) => {
        await signIn(page);
        const list = page.locator('#district-list button');
        await expect(list).toHaveCount(12);
        await page.locator('#district-list button[data-slug="solan"]').click();
        await expect(page.locator('#district-title')).toHaveText('Solan');
        await expect(page.getByLabel('Headline')).toHaveValue('Not a stop. The district that builds Himachal.');
        await expect(page.locator('#spots .spot')).toHaveCount(8);
        await expect(page.locator('#district-list button[data-slug="solan"]')).toHaveAttribute('aria-current', 'true');
        await expectNoSidewaysScroll(page);
    });

    test('the save bar appears only with changes, and Discard restores the saved text', async ({ page }) => {
        await signIn(page);
        await expect(page.locator('#district-bar')).toBeHidden();
        const headline = page.getByLabel('Headline');
        const original = await headline.inputValue();
        await headline.fill('Something new');
        await expect(page.locator('#district-bar')).toBeVisible();
        await page.getByRole('button', { name: 'Discard' }).click();
        await expect(headline).toHaveValue(original);
        await expect(page.locator('#district-bar')).toBeHidden();
    });

    test('unsaved changes block leaving the page until saved or discarded', async ({ page }) => {
        await signIn(page);
        await page.getByLabel('Headline').fill('Half-finished edit');
        await openSection(page, 'Stories');
        await expect(page.locator('#panel-districts')).toBeVisible();
        await expect(page.locator('#toast')).toContainText('unsaved changes');
        await page.locator('#district-list button[data-slug="kinnaur"]').click();
        await expect(page.locator('#district-title')).toHaveText('Lahaul & Spiti');
    });

    test('saves the headline and spots and the live district page shows them', async ({ page }) => {
        await signIn(page);
        await page.locator('#district-list button[data-slug="solan"]').click();
        await expect(page.locator('#spots .spot')).toHaveCount(8);
        await page.getByLabel('Headline').fill('Solan, rewritten by the admin');

        // remove the first spot, move the new first one down, add one at the end
        await page.locator('#spots .spot').first().getByRole('button', { name: 'Remove spot' }).click();
        await page.locator('#spots .spot').first().getByRole('button', { name: 'Move down' }).click();
        await page.getByRole('button', { name: 'Add a spot' }).click();
        await page.locator('#spots .spot').last().getByLabel('Place name').fill('Kasauli Christ Church');
        await page.locator('#spots .spot').last().getByLabel('What to know').fill('Go on a weekday morning.');
        await expect(page.locator('#spot-count')).toHaveText('8 spots');

        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.locator('#toast')).toContainText('Solan is updated on the live site');
        await expect(page.locator('#district-bar')).toBeHidden();
        await expect(page.locator('#district-list button[data-slug="solan"] small')).toHaveText('8');

        await page.goto('/dist/Solan');
        await expect(page.locator('[data-field="headline"]')).toHaveText('Solan, rewritten by the admin');
        const items = page.locator('[data-field="recommended"] li');
        await expect(items).toHaveCount(8);
        await expect(items.last()).toContainText('Kasauli Christ Church');
        await expect(items.first()).toContainText('Phantom Hill');
        await expect(items.nth(1)).toContainText('Jatoli Shiv Temple');
    });

    test('an empty headline is not saved', async ({ page }) => {
        await signIn(page);
        await page.getByLabel('Headline').fill('');
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByLabel('Headline')).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#toast')).toContainText('headline can\'t be empty');
    });
});

// ---------------------------------------------------------------------------
test.describe('stories', () => {
    test('lists stories with status and filters by status', async ({ page }) => {
        await signIn(page);
        await openSection(page, 'Stories');
        await expect(page.locator('.post-row')).toHaveCount(2);
        await page.locator('#post-filter label', { hasText: 'Drafts' }).click();
        await expect(page.locator('.post-row')).toHaveCount(1);
        await expect(page.locator('.post-row .pill')).toHaveText('Draft');
        await page.locator('#post-filter label', { hasText: 'Published' }).click();
        await expect(page.locator('.post-row')).toHaveText(/Barog station at dusk/);
        await expectNoSidewaysScroll(page);
    });

    test('the link text follows the title until edited, and bad link text is flagged', async ({ page }) => {
        await signIn(page);
        await page.goto('/admin/index.html#new');
        await page.getByLabel('Title').fill('Renuka Lake & the monsoon');
        await expect(page.getByLabel('Link text')).toHaveValue('renuka-lake-and-the-monsoon');
        await page.getByLabel('Link text').fill('Bad Link');
        await expect(page.getByLabel('Link text')).toHaveAttribute('aria-invalid', 'true');
        await page.getByLabel('Title').fill('Something else');
        await expect(page.getByLabel('Link text')).toHaveValue('Bad Link');
    });

    test('a story needs a title before it can be saved', async ({ page }) => {
        await signIn(page);
        await page.goto('/admin/index.html#new');
        await page.getByRole('button', { name: 'Save draft' }).click();
        await expect(page.locator('#toast')).toContainText('Give the story a title');
        await expect(page.getByLabel('Title')).toHaveAttribute('aria-invalid', 'true');
    });

    test('the preview shows the draft on the district page and the story page', async ({ page }) => {
        await signIn(page);
        await page.goto('/admin/index.html#new');
        await fillStory(page, { title: 'Mushrooms, mist and the road to Chail', district: 'Solan', body: '## The sheds\n\n> Come at six.\n\n<script>window.hacked = 1</script>' });

        const tab = page.getByRole('tab', { name: 'Preview' });
        if (await tab.isVisible()) await tab.click();
        const frame = page.frameLocator('#preview-frame');
        await expect(frame.locator('.blog-spot-title')).toHaveText('From the Solan journal');
        await expect(frame.locator('.blog-spot-feature h3')).toHaveText('Mushrooms, mist and the road to Chail');
        await expect(frame.locator('.blog-spot-item h4')).toHaveText('Barog station at dusk');

        await page.locator('.preview-bar label', { hasText: 'Story page' }).click();
        await expect(frame.locator('.blog-post h1')).toHaveText('Mushrooms, mist and the road to Chail');
        await expect(frame.locator('.blog-post-body h2')).toHaveText('The sheds');
        await expect(frame.locator('.blog-post-body blockquote')).toContainText('Come at six.');
        await expect(frame.locator('.blog-post-body script')).toHaveCount(0);

        await page.locator('.preview-bar label[title="Phone"]').click();
        await expect(page.locator('#preview-stage')).toHaveClass(/is-phone/);
        await expect(page.locator('#preview-frame')).toHaveCSS('width', '390px');
    });

    test('save a draft, publish it, see it on the district page, then delete it', async ({ page }) => {
        await signIn(page);
        await page.goto('/admin/index.html#new');
        await fillStory(page, { title: 'Dagshai before the town wakes up', district: 'Solan', body: 'Stone lanes and old barracks.' });
        await page.getByLabel('Short summary').fill('A quiet morning walk.');

        await page.getByRole('button', { name: 'Save draft' }).click();
        await expect(page.locator('#toast')).toContainText('Saved as a draft');
        await expect(page.locator('#editor-status')).toHaveText('Draft');
        await expect(page).toHaveURL(/#edit\//);

        await page.goto('/dist/Solan');
        await expect(page.locator('.blog-spot-feature h3')).toHaveText('Barog station at dusk');

        await page.goBack();
        await expect(page.locator('#editor-status')).toHaveText('Draft');
        await page.getByRole('button', { name: 'Publish' }).click();
        await expect(page.locator('#toast')).toContainText('live on the Solan page');
        await expect(page.locator('#editor-status')).toHaveText('Published');
        await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

        await page.goto('/dist/Solan');
        await expect(page.locator('.blog-spot')).toBeVisible();
        await expect(page.locator('.blog-spot-feature h3')).toHaveText('Dagshai before the town wakes up');
        await page.locator('.blog-spot-feature h3 a').click();
        await expect(page.locator('.blog-post h1')).toHaveText('Dagshai before the town wakes up');

        await page.goto('/admin/index.html#posts');
        await page.locator('.post-row', { hasText: 'Dagshai' }).click();
        const del = page.getByRole('button', { name: 'Delete story' });
        await del.click();
        await expect(page.getByRole('button', { name: 'Click again to delete' })).toBeVisible();
        await page.getByRole('button', { name: 'Click again to delete' }).click();
        await expect(page.locator('#panel-posts')).toBeVisible();
        await expect(page.locator('.post-row', { hasText: 'Dagshai' })).toHaveCount(0);
    });

    test('a duplicate link text in the same district is explained', async ({ page }) => {
        await signIn(page);
        await page.goto('/admin/index.html#new');
        await fillStory(page, { title: 'Barog station at dusk', district: 'Solan', body: 'Again.' });
        await page.getByRole('button', { name: 'Save draft' }).click();
        await expect(page.locator('#toast')).toContainText('already uses this link text');
    });

    test('pressing Enter in a field does not submit the form', async ({ page }) => {
        await signIn(page);
        await page.goto('/admin/index.html#new');
        await page.getByLabel('Title').fill('Enter should not save');
        await page.getByLabel('Title').press('Enter');
        await expect(page.locator('#editor-heading')).toHaveText('New story');
        await expect(page.locator('#post-bar-text')).toHaveText('Not saved yet');
    });
});

// ---------------------------------------------------------------------------
test.describe('authors', () => {
    test('admin can rename an author; the Save button appears only after a change', async ({ page }) => {
        await signIn(page);
        await openSection(page, 'Authors');
        const row = page.locator('.author-row', { hasText: 'author@test.local' });
        await expect(row.getByRole('button', { name: 'Save' })).toBeHidden();
        await row.getByRole('textbox').fill('Guest writer from Kangra');
        await row.getByRole('button', { name: 'Save' }).click();
        await expect(page.locator('#toast')).toHaveText('Saved.');
        await expect(row.locator('.author-who b')).toHaveText('Guest writer from Kangra');
    });

    test('admin cannot change their own role', async ({ page }) => {
        await signIn(page);
        await openSection(page, 'Authors');
        const own = page.locator('.author-row', { hasText: 'admin@test.local' });
        for (const radio of await own.locator('input[type="radio"]').all()) {
            await expect(radio).toBeDisabled();
        }
    });

    test('admin can give a pending account the Author role', async ({ page }) => {
        await signIn(page);
        await openSection(page, 'Authors');
        const row = page.locator('.author-row', { hasText: 'pending@test.local' });
        await row.locator('label', { hasText: /^Author$/ }).click();
        await row.getByRole('button', { name: 'Save' }).click();
        await expect(page.locator('#toast')).toHaveText('Saved.');
        await expect(row).not.toHaveClass(/no-role/);
    });
});

// ---------------------------------------------------------------------------
test.describe('layout', () => {
    test('every view fits the screen without sideways scrolling', async ({ page }) => {
        await signIn(page);
        for (const hash of ['#districts', '#posts', '#new', '#authors']) {
            await page.goto(`/admin/index.html?view=${hash.slice(1)}${hash}`);
            await expect(page.locator('.panel-view:not([hidden])')).toBeVisible();
            await expectNoSidewaysScroll(page);
        }
    });

    test('every form control has an accessible name', async ({ page }) => {
        await signIn(page);
        for (const hash of ['#districts', '#new', '#authors']) {
            await page.goto(`/admin/index.html?view=${hash.slice(1)}${hash}`);
            await expect(page.locator('.panel-view:not([hidden])')).toBeVisible();
            const unnamed = await page.evaluate(() => [...document.querySelectorAll('.panel-view:not([hidden]) input:not([type="radio"]):not([type="file"]), .panel-view:not([hidden]) textarea')]
                .filter(el => el.offsetParent !== null)
                .filter(el => !(el.labels && el.labels.length) && !el.getAttribute('aria-label'))
                .map(el => el.id || el.className));
            expect(unnamed).toEqual([]);
        }
    });

    test('on phones the sections sit in a bottom tab bar and the editor uses Write/Preview tabs', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile', 'phone layout only');
        await signIn(page);
        const nav = await page.locator('.rail-nav').boundingBox();
        const viewport = page.viewportSize();
        expect(Math.round(nav.y + nav.height)).toBeGreaterThanOrEqual(viewport.height - 1);
        const header = await page.locator('.rail').boundingBox();
        expect(header.height).toBeLessThan(90);

        await page.goto('/admin/index.html?view=new#new');
        await expect(page.getByRole('tab', { name: 'Write' })).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('.preview')).toBeHidden();
        await page.getByRole('tab', { name: 'Preview' }).click();
        await expect(page.locator('.preview')).toBeVisible();
        await expect(page.getByLabel('Title')).toBeHidden();
    });

    test('on desktop the preview sits beside the editor', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'desktop', 'wide layout only');
        await signIn(page);
        await page.goto('/admin/index.html?view=new#new');
        await expect(page.getByRole('tab', { name: 'Preview' })).toBeHidden();
        const form = await page.locator('.story-form').boundingBox();
        const preview = await page.locator('.preview').boundingBox();
        expect(preview.x).toBeGreaterThan(form.x + form.width - 1);
    });
});

// ---------------------------------------------------------------------------
test.describe('public pages', () => {
    test('the district page shows the blog spot with published stories only', async ({ page }) => {
        await page.goto('/dist/Solan');
        await expect(page.locator('.blog-spot')).toBeVisible();
        await expect(page.locator('.blog-spot-feature h3')).toHaveText('Barog station at dusk');
        await page.goto('/dist/Kangra');
        await expect(page.locator('.blog-spot')).toBeHidden(); // Kangra only has a draft
        await expectNoSidewaysScroll(page);
    });

    test('district pages have clean addresses like /dist/Solan', async ({ page }) => {
        await page.goto('/index.html');
        const href = await page.locator('a.info-button[href="dist/Solan"]').getAttribute('href');
        expect(href).toBe('dist/Solan');
        await page.goto('/dist/Solan');
        await expect(page).toHaveTitle('Solan - Himachalites');
        await expect(page.locator('.blog-spot-feature h3')).toHaveText('Barog station at dusk');
        await page.locator('.blog-spot-feature h3 a').click();
        await expect(page).toHaveURL(/\/dist\/post\?d=solan&p=barog-station-at-dusk$/);
        await page.locator('.blog-post-nav a', { hasText: 'Back to Solan' }).click();
        await expect(page).toHaveURL(/\/dist\/Solan$/);
    });

    test('old district addresses redirect to the new ones', async ({ page }) => {
        await page.goto('/dist/d9.html');
        await expect(page).toHaveURL(/\/dist\/Solan$/);
        await page.goto('/dist/d1.html');
        await expect(page).toHaveURL(/\/dist\/Lahaul-Spiti$/);
    });

    test('about and contact links have no .html', async ({ page }) => {
        await page.goto('/dist/Kangra');
        const links = await page.locator('a[href]').evaluateAll(as => as.map(a => a.getAttribute('href')));
        expect(links.filter(h => /\.html(\?|#|$)/.test(h) && !h.startsWith('http'))).toEqual([]);
        await page.goto('/about');
        await expect(page).toHaveTitle(/About/);
    });

    test('a draft cannot be opened on the public story page', async ({ page }) => {
        await page.goto('/dist/post?d=kangra&p=guest-draft');
        await expect(page.locator('.blog-post-empty')).toContainText('not available');
    });
});
