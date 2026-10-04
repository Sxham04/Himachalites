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

    function renderPosts(posts) {
        if (!posts.length) return;
        const body = section.querySelector('.blog-spot-body');
        body.classList.toggle('blog-spot-single', posts.length === 1);
        body.innerHTML = api.blogSpotHtml(slug, posts);
        section.hidden = false;
    }

    Promise.all([api.district(slug), api.spots(slug), api.posts(slug, 4)])
        .then(([district, spots, posts]) => {
            applyDistrict(district, spots);
            renderPosts(posts);
        })
        .catch(() => { /* keep the built-in text; the blog spot stays hidden */ });
})();
