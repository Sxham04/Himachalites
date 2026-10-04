// Shared by the district pages, post.html and the admin preview:
// - read-only access to the Supabase REST API (plain fetch; visitors only ever read)
// - the HTML for the blog spot and the story page, so the admin preview matches the live site exactly
// Also loadable from Node (module.exports) for the unit tests.
(function (root) {
    const config = root.HIMACHALITES_SUPABASE || {};

    // District slug -> page, in the same order as dist/d1.html ... d12.html
    const DISTRICTS = ['lahaul-spiti', 'kinnaur', 'chamba', 'kullu', 'shimla', 'kangra',
        'sirmaur', 'mandi', 'solan', 'bilaspur', 'hamirpur', 'una'];

    async function get(path) {
        // apikey alone works for both key types (legacy anon JWT and the newer sb_publishable_ keys);
        // a publishable key must not be sent as a Bearer token
        const response = await fetch(`${config.url}/rest/v1/${path}`, {
            headers: { apikey: config.anonKey },
        });
        if (!response.ok) throw new Error(`Supabase ${response.status}`);
        return response.json();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    }

    function readMinutes(markdown) {
        const words = (markdown || '').trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.round(words / 200));
    }

    function districtPage(slug) {
        return DISTRICTS.includes(slug) ? `d${DISTRICTS.indexOf(slug) + 1}.html` : '../index.html';
    }

    function postUrl(slug, post) {
        return `post.html?d=${encodeURIComponent(slug)}&p=${encodeURIComponent(post.slug)}`;
    }

    function postMeta(post) {
        return `${formatDate(post.published_at)} · ${readMinutes(post.body_md)} min read`;
    }

    // Inner HTML of .blog-spot-body: newest post featured, up to three more listed beside it
    function blogSpotHtml(slug, posts) {
        const esc = escapeHtml;
        const [lead, ...rest] = posts;
        if (!lead) return '';
        const cover = (post, alt) => post.cover_url ? `<img src="${esc(post.cover_url)}" alt="${esc(alt)}" loading="lazy">` : '';
        return `
            <article class="blog-spot-feature">
                <a href="${postUrl(slug, lead)}" class="blog-spot-cover">${cover(lead, lead.title)}</a>
                <span class="blog-spot-tag">Featured${lead.tag ? ` · ${esc(lead.tag)}` : ''}</span>
                <h3><a href="${postUrl(slug, lead)}">${esc(lead.title)}</a></h3>
                ${lead.excerpt ? `<p>${esc(lead.excerpt)}</p>` : ''}
                <span class="blog-spot-meta">${postMeta(lead)}</span>
                <div><a class="blog-spot-link" href="${postUrl(slug, lead)}">Read the story</a></div>
            </article>
            ${rest.length ? `<div class="blog-spot-list">
                ${rest.map(post => `
                    <article class="blog-spot-item">
                        <a href="${postUrl(slug, post)}" class="blog-spot-thumb">${cover(post, '')}</a>
                        <div>
                            ${post.tag ? `<span class="blog-spot-tag">${esc(post.tag)}</span>` : ''}
                            <h4><a href="${postUrl(slug, post)}">${esc(post.title)}</a></h4>
                            <span class="blog-spot-meta">${postMeta(post)}</span>
                        </div>
                    </article>`).join('')}
                <div class="blog-spot-more"><a class="blog-spot-button" href="post.html?d=${encodeURIComponent(slug)}">All stories</a></div>
            </div>` : ''}`;
    }

    // Inner HTML of .blog-post for one story. bodyHtml must already be sanitised (DOMPurify).
    function storyHtml({ slug, districtName, post, bodyHtml, next }) {
        const esc = escapeHtml;
        const page = districtPage(slug);
        return `
            <div class="blog-post-crumb"><a href="${page}">${esc(districtName)}</a> › <a href="post.html?d=${encodeURIComponent(slug)}">Stories</a></div>
            ${post.tag ? `<span class="blog-spot-tag">${esc(post.tag)}</span>` : ''}
            <h1>${esc(post.title)}</h1>
            <span class="blog-spot-meta">${post.author_name ? `By ${esc(post.author_name)} · ` : ''}${postMeta(post)}</span>
            ${post.cover_url ? `<img class="blog-post-cover" src="${esc(post.cover_url)}" alt="">` : ''}
            <div class="blog-post-body">${bodyHtml}</div>
            <div class="blog-post-nav">
                <a href="${page}">Back to ${esc(districtName)}</a>
                ${next ? `<a href="${postUrl(slug, next)}">Next story: ${esc(next.title)}</a>` : ''}
            </div>`;
    }

    const api = {
        enabled: Boolean(config.url && config.anonKey),
        DISTRICTS,
        get,
        escapeHtml,
        formatDate,
        readMinutes,
        districtPage,
        postUrl,
        blogSpotHtml,
        storyHtml,
        district: slug => get(`districts?slug=eq.${encodeURIComponent(slug)}&select=name,headline,description`).then(rows => rows[0] || null),
        spots: slug => get(`recommended_spots?district_slug=eq.${encodeURIComponent(slug)}&select=name,body&order=position`),
        posts: (slug, limit) => get(
            `posts?district_slug=eq.${encodeURIComponent(slug)}&status=eq.published` +
            '&select=slug,title,tag,excerpt,body_md,cover_url,author_name,published_at' +
            `&order=published_at.desc${limit ? `&limit=${limit}` : ''}`
        ),
        post: (slug, postSlug) => get(
            `posts?district_slug=eq.${encodeURIComponent(slug)}&slug=eq.${encodeURIComponent(postSlug)}&status=eq.published` +
            '&select=slug,title,tag,excerpt,body_md,cover_url,author_name,published_at'
        ).then(rows => rows[0] || null),
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.HimachalitesContent = api;
})(typeof window !== 'undefined' ? window : globalThis);
