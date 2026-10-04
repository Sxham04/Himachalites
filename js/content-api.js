// Read-only access to the Supabase REST API for public pages (district pages, post page).
// Plain fetch instead of supabase-js: visitors only ever read, so the library isn't needed here.
(function () {
    const config = window.HIMACHALITES_SUPABASE || {};

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
        return String(value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function readMinutes(markdown) {
        const words = (markdown || '').trim().split(/\s+/).filter(Boolean).length;
        return Math.max(1, Math.round(words / 200));
    }

    window.HimachalitesContent = {
        enabled: Boolean(config.url && config.anonKey),
        get,
        escapeHtml,
        formatDate,
        readMinutes,
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
})();
