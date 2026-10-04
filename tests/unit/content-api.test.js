const test = require('node:test');
const assert = require('node:assert/strict');
const site = require('../../js/content-api.js');

const post = (extra = {}) => ({
    slug: 'barog-station-at-dusk',
    title: 'Barog station at dusk',
    tag: 'Rail',
    excerpt: 'Chai and pine air.',
    body_md: 'word '.repeat(450),
    cover_url: 'https://example.com/cover.webp',
    author_name: 'Himachalites team',
    published_at: '2026-07-09T06:00:00Z',
    ...extra,
});

test('is disabled when no Supabase config is present', () => {
    assert.equal(site.enabled, false);
});

test('escapeHtml escapes every HTML-significant character', () => {
    assert.equal(site.escapeHtml(`<img src=x onerror="alert('1')">&`), '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;&amp;');
    assert.equal(site.escapeHtml(null), '');
});

test('readMinutes rounds at 200 words per minute with a 1 minute floor', () => {
    assert.equal(site.readMinutes(''), 1);
    assert.equal(site.readMinutes('one two three'), 1);
    assert.equal(site.readMinutes('w '.repeat(450)), 2);
    assert.equal(site.readMinutes('w '.repeat(1000)), 5);
});

test('formatDate uses Indian time, so late-evening UTC posts get the next day', () => {
    assert.equal(site.formatDate('2026-07-09T06:00:00Z'), '9 Jul 2026');
    assert.equal(site.formatDate('2026-07-09T20:00:00Z'), '10 Jul 2026');
});

test('districtPage maps slugs to d1..d12 in page order', () => {
    assert.equal(site.districtPage('lahaul-spiti'), 'd1.html');
    assert.equal(site.districtPage('solan'), 'd9.html');
    assert.equal(site.districtPage('una'), 'd12.html');
    assert.equal(site.districtPage('nowhere'), '../index.html');
    assert.equal(site.DISTRICTS.length, 12);
});

test('blogSpotHtml features the first post and lists the rest', () => {
    const html = site.blogSpotHtml('solan', [post(), post({ slug: 'second', title: 'Second' })]);
    assert.match(html, /class="blog-spot-feature"/);
    assert.match(html, /Featured · Rail/);
    assert.match(html, /<h3><a href="post\.html\?d=solan&p=barog-station-at-dusk">Barog station at dusk<\/a><\/h3>/);
    assert.match(html, /class="blog-spot-list"/);
    assert.match(html, /9 Jul 2026 · 2 min read/);
    assert.match(html, /href="post\.html\?d=solan">All stories/);
});

test('blogSpotHtml with one post has no list column, and with none returns nothing', () => {
    assert.doesNotMatch(site.blogSpotHtml('solan', [post()]), /blog-spot-list/);
    assert.equal(site.blogSpotHtml('solan', []), '');
});

test('blogSpotHtml escapes titles, tags and cover URLs', () => {
    const html = site.blogSpotHtml('solan', [post({ title: '<script>x</script>', tag: '<b>', cover_url: '"><img onerror=1>' })]);
    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /<b>/);
    assert.doesNotMatch(html, /"><img onerror/);
});

test('storyHtml shows author, meta, cover, the given body and the next story link', () => {
    const html = site.storyHtml({
        slug: 'solan',
        districtName: 'Solan',
        post: post(),
        bodyHtml: '<p>Body</p>',
        next: post({ slug: 'next-one', title: 'Next one' }),
    });
    assert.match(html, /<h1>Barog station at dusk<\/h1>/);
    assert.match(html, /By Himachalites team · 9 Jul 2026 · 2 min read/);
    assert.match(html, /<div class="blog-post-body"><p>Body<\/p><\/div>/);
    assert.match(html, /href="d9\.html">Back to Solan/);
    assert.match(html, /Next story: Next one/);
});
