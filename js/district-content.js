// District pages: swaps in the admin-edited headline, description and recommended spots, and fills
// the blog spot with published posts. The text already in the HTML is the fallback, so if Supabase
// is unconfigured or unreachable the page looks exactly as before and the blog spot stays hidden.
(function () {
    const api = window.HimachalitesContent;
    const section = document.querySelector('.blog-spot');
    if (!api || !api.enabled || !section) return;

    const slug = section.dataset.district;
    const esc = api.escapeHtml;

    function applyDistrict(district, spots) {
        if (district) {
            const headline = document.querySelector('[data-field="headline"]');
            const description = document.querySelector('[data-field="description"]');
            if (headline && district.headline) headline.textContent = district.headline;
            // Newlines become <br>, like the original markup; everything else is escaped text
            if (description && district.description) {
                description.innerHTML = district.description.split('\n').map(esc).join('<br>');
            }
        }
        const list = document.querySelector('[data-field="recommended"]');
        if (list && spots.length) {
            list.innerHTML = spots.map(s => `<li><strong>${esc(s.name)}</strong>: ${esc(s.body)}</li>`).join('');
        }
    }

    function postUrl(post) {
        return `post.html?d=${encodeURIComponent(slug)}&p=${encodeURIComponent(post.slug)}`;
    }

    function meta(post) {
        return `${api.formatDate(post.published_at)} · ${api.readMinutes(post.body_md)} min read`;
    }

    function cover(post, alt) {
        return post.cover_url ? `<img src="${esc(post.cover_url)}" alt="${esc(alt)}" loading="lazy">` : '';
    }

    function renderPosts(posts) {
        if (!posts.length) return;
        const [lead, ...rest] = posts;
        const body = section.querySelector('.blog-spot-body');
        body.classList.toggle('blog-spot-single', rest.length === 0);
        body.innerHTML = `
            <article class="blog-spot-feature">
                <a href="${postUrl(lead)}" class="blog-spot-cover">${cover(lead, lead.title)}</a>
                ${lead.tag ? `<span class="blog-spot-tag">Featured · ${esc(lead.tag)}</span>` : '<span class="blog-spot-tag">Featured</span>'}
                <h3><a href="${postUrl(lead)}">${esc(lead.title)}</a></h3>
                ${lead.excerpt ? `<p>${esc(lead.excerpt)}</p>` : ''}
                <span class="blog-spot-meta">${meta(lead)}</span>
                <div><a class="blog-spot-link" href="${postUrl(lead)}">Read the story</a></div>
            </article>
            ${rest.length ? `<div class="blog-spot-list">
                ${rest.map(post => `
                    <article class="blog-spot-item">
                        <a href="${postUrl(post)}" class="blog-spot-thumb">${cover(post, '')}</a>
                        <div>
                            ${post.tag ? `<span class="blog-spot-tag">${esc(post.tag)}</span>` : ''}
                            <h4><a href="${postUrl(post)}">${esc(post.title)}</a></h4>
                            <span class="blog-spot-meta">${meta(post)}</span>
                        </div>
                    </article>`).join('')}
                <div class="blog-spot-more"><a class="blog-spot-button" href="post.html?d=${encodeURIComponent(slug)}">All stories</a></div>
            </div>` : ''}`;
        section.hidden = false;
    }

    Promise.all([api.district(slug), api.spots(slug), api.posts(slug, 4)])
        .then(([district, spots, posts]) => {
            applyDistrict(district, spots);
            renderPosts(posts);
        })
        .catch(() => { /* keep the built-in text; the blog spot stays hidden */ });
})();
