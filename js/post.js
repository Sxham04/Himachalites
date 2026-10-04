// post.html: shows one story (?d=<district>&p=<post>) or all stories for a district (?d=<district>).
// Story bodies are Markdown, converted with marked and cleaned with DOMPurify before display,
// so an author can't put scripts or unsafe HTML on the site.
(function () {
    const api = window.HimachalitesContent;
    const root = document.getElementById('blog-post');
    const params = new URLSearchParams(location.search);
    const slug = params.get('d');
    const postSlug = params.get('p');
    const page = api.districtPage(slug);
    const esc = api.escapeHtml;

    function message(text) {
        root.innerHTML = `<p class="blog-post-empty">${esc(text)}</p>
            <div class="blog-post-nav"><a href="${page}">Back to the district</a></div>`;
    }

    async function showPost(district) {
        const [post, all] = await Promise.all([api.post(slug, postSlug), api.posts(slug)]);
        if (!post) return message('This story is not available. It may have been unpublished.');

        document.title = `${post.title} - Himachalites`;
        root.innerHTML = api.storyHtml({
            slug,
            districtName: district.name,
            post,
            bodyHtml: DOMPurify.sanitize(marked.parse(post.body_md || '')),
            next: all[all.findIndex(p => p.slug === post.slug) + 1],
        });
    }

    async function showList(district) {
        const posts = await api.posts(slug);
        document.title = `Stories from ${district.name} - Himachalites`;
        root.innerHTML = `
            <div class="blog-post-crumb"><a href="${page}">${esc(district.name)}</a> › Stories</div>
            <h1>Stories from ${esc(district.name)}</h1>
            ${posts.length ? `<div>${posts.map(post => `
                <article class="blog-spot-item">
                    <a href="${api.postUrl(slug, post)}">${post.cover_url ? `<img src="${esc(post.cover_url)}" alt="" loading="lazy">` : ''}</a>
                    <div>
                        ${post.tag ? `<span class="blog-spot-tag">${esc(post.tag)}</span>` : ''}
                        <h4><a href="${api.postUrl(slug, post)}">${esc(post.title)}</a></h4>
                        <span class="blog-spot-meta">${api.formatDate(post.published_at)} · ${api.readMinutes(post.body_md)} min read</span>
                    </div>
                </article>`).join('')}</div>` : '<p class="blog-post-empty">No stories yet.</p>'}
            <div class="blog-post-nav"><a href="${page}">Back to ${esc(district.name)}</a></div>`;
    }

    if (!api.enabled) return message('Stories are not available yet.');
    if (!api.DISTRICTS.includes(slug)) return message('This story could not be found.');

    api.district(slug)
        .then(district => postSlug ? showPost(district) : showList(district))
        .catch(() => message('Stories could not be loaded. Check your connection and try again.'));
})();
