// post.html: shows one story (?d=<district>&p=<post>) or all stories for a district (?d=<district>).
// Story bodies are Markdown, converted with marked and cleaned with DOMPurify before display,
// so an author can't put scripts or unsafe HTML on the site.
(function () {
    const api = window.HimachalitesContent;
    const root = document.getElementById('blog-post');
    const params = new URLSearchParams(location.search);
    const slug = params.get('d');
    const postSlug = params.get('p');

    // District slug -> page, in the same order as dist/d1.html ... d12.html
    const pages = ['lahaul-spiti', 'kinnaur', 'chamba', 'kullu', 'shimla', 'kangra',
        'sirmaur', 'mandi', 'solan', 'bilaspur', 'hamirpur', 'una'];
    const districtPage = pages.includes(slug) ? `d${pages.indexOf(slug) + 1}.html` : '../index.html';
    const esc = api.escapeHtml;

    function message(text) {
        root.innerHTML = `<p class="blog-post-empty">${esc(text)}</p>
            <div class="blog-post-nav"><a href="${districtPage}">Back to the district</a></div>`;
    }

    function postUrl(post) {
        return `post.html?d=${encodeURIComponent(slug)}&p=${encodeURIComponent(post.slug)}`;
    }

    async function showPost(district) {
        const [post, all] = await Promise.all([api.post(slug, postSlug), api.posts(slug)]);
        if (!post) return message('This story is not available. It may have been unpublished.');

        document.title = `${post.title} - Himachalites`;
        const next = all[all.findIndex(p => p.slug === post.slug) + 1];
        const body = DOMPurify.sanitize(marked.parse(post.body_md || ''));
        root.innerHTML = `
            <div class="blog-post-crumb"><a href="${districtPage}">${esc(district.name)}</a> › <a href="post.html?d=${encodeURIComponent(slug)}">Stories</a></div>
            ${post.tag ? `<span class="blog-spot-tag">${esc(post.tag)}</span>` : ''}
            <h1>${esc(post.title)}</h1>
            <span class="blog-spot-meta">${post.author_name ? `By ${esc(post.author_name)} · ` : ''}${api.formatDate(post.published_at)} · ${api.readMinutes(post.body_md)} min read</span>
            ${post.cover_url ? `<img class="blog-post-cover" src="${esc(post.cover_url)}" alt="">` : ''}
            <div class="blog-post-body">${body}</div>
            <div class="blog-post-nav">
                <a href="${districtPage}">Back to ${esc(district.name)}</a>
                ${next ? `<a href="${postUrl(next)}">Next story: ${esc(next.title)}</a>` : ''}
            </div>`;
    }

    async function showList(district) {
        const posts = await api.posts(slug);
        document.title = `Stories from ${district.name} - Himachalites`;
        root.innerHTML = `
            <div class="blog-post-crumb"><a href="${districtPage}">${esc(district.name)}</a> › Stories</div>
            <h1>Stories from ${esc(district.name)}</h1>
            ${posts.length ? `<div>${posts.map(post => `
                <article class="blog-spot-item">
                    <a href="${postUrl(post)}">${post.cover_url ? `<img src="${esc(post.cover_url)}" alt="" loading="lazy">` : ''}</a>
                    <div>
                        ${post.tag ? `<span class="blog-spot-tag">${esc(post.tag)}</span>` : ''}
                        <h4><a href="${postUrl(post)}">${esc(post.title)}</a></h4>
                        <span class="blog-spot-meta">${api.formatDate(post.published_at)} · ${api.readMinutes(post.body_md)} min read</span>
                    </div>
                </article>`).join('')}</div>` : '<p class="blog-post-empty">No stories yet.</p>'}
            <div class="blog-post-nav"><a href="${districtPage}">Back to ${esc(district.name)}</a></div>`;
    }

    if (!api.enabled) return message('Stories are not available yet.');
    if (!pages.includes(slug)) return message('This story could not be found.');

    api.district(slug)
        .then(district => postSlug ? showPost(district) : showList(district))
        .catch(() => message('Stories could not be loaded. Check your connection and try again.'));
})();
