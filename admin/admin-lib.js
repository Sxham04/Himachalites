// Pure helpers for the admin area (no DOM, no network), shared by admin.js and the unit tests.
(function (root) {
    // "Mushrooms, Mist & the Road!" -> "mushrooms-mist-and-the-road"
    function slugify(text) {
        return String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
            .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
            .replace(/-+$/, '');
    }

    function isValidSlug(slug) {
        return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '');
    }

    // Avatar letters: "Himachalites team" -> "HT", "soham@x.com" -> "SO"
    function initials(nameOrEmail) {
        const text = String(nameOrEmail || '').split('@')[0].trim();
        if (!text) return '?';
        const words = text.split(/[\s._-]+/).filter(Boolean);
        const letters = words.length > 1 ? words[0][0] + words[1][0] : text.slice(0, 2);
        return letters.toUpperCase();
    }

    // Returns a new array with the item at index moved by delta (-1 up, +1 down); out-of-range moves are no-ops
    function moveItem(list, index, delta) {
        const target = index + delta;
        if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list.slice();
        const copy = list.slice();
        const [item] = copy.splice(index, 1);
        copy.splice(target, 0, item);
        return copy;
    }

    // Spots ready to save: trimmed, blank names dropped, positions renumbered from 0
    function cleanSpots(spots, districtSlug) {
        return spots
            .map(s => ({ name: String(s.name || '').trim(), body: String(s.body || '').trim() }))
            .filter(s => s.name)
            .map((s, position) => ({ district_slug: districtSlug, name: s.name, body: s.body, position }));
    }

    // Counts for the stories filter: { all, published, draft }
    function statusCounts(posts) {
        return posts.reduce((counts, post) => {
            counts.all += 1;
            counts[post.status === 'published' ? 'published' : 'draft'] += 1;
            return counts;
        }, { all: 0, published: 0, draft: 0 });
    }

    // Posts for the district-page preview: the draft featured first, then up to 3 other published posts
    function previewPosts(draft, published) {
        const others = published.filter(p => p.slug !== draft.slug).slice(0, 3);
        return [draft, ...others];
    }

    const lib = { slugify, isValidSlug, initials, moveItem, cleanSpots, statusCounts, previewPosts };
    if (typeof module !== 'undefined' && module.exports) module.exports = lib;
    else root.AdminLib = lib;
})(typeof window !== 'undefined' ? window : globalThis);
