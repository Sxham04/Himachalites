// Admin area: sign-in, district text editor, posts and authors.
// Every write is also checked by the row level security rules in supabase/schema.sql, so hiding a
// button here is a convenience, not the protection.
(function () {
    const config = window.HIMACHALITES_SUPABASE || {};
    const $ = id => document.getElementById(id);

    if (!config.url || !config.anonKey) {
        document.body.innerHTML = '<p style="padding:40px">Add the Supabase URL and anon key to js/supabase-config.js first.</p>';
        return;
    }

    const db = supabase.createClient(config.url, config.anonKey);
    const DISTRICT_PAGES = ['lahaul-spiti', 'kinnaur', 'chamba', 'kullu', 'shimla', 'kangra',
        'sirmaur', 'mandi', 'solan', 'bilaspur', 'hamirpur', 'una'];

    let me = null;          // { id, email, display_name, role }
    let districts = [];     // [{ slug, name }]
    let editingPost = null; // post row being edited, or null for a new post

    // ---------- Helpers ----------
    function say(el, text, ok) {
        el.textContent = text;
        el.className = `msg ${ok ? 'ok' : 'err'}`;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function slugify(text) {
        return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
            .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    }

    function districtName(slug) {
        return (districts.find(d => d.slug === slug) || {}).name || slug;
    }

    function districtPage(slug) {
        return `../dist/d${DISTRICT_PAGES.indexOf(slug) + 1}.html`;
    }

    async function busy(button, work) {
        button.disabled = true;
        try { return await work(); } finally { button.disabled = false; }
    }

    // ---------- Sign in ----------
    $('login-form').addEventListener('submit', async event => {
        event.preventDefault();
        const msg = $('login-msg');
        const password = $('login-password').value;
        if (!password) return say(msg, 'Enter your password, or use "Email me a sign-in link".', false);
        const { error } = await db.auth.signInWithPassword({ email: $('login-email').value.trim(), password });
        if (error) say(msg, 'That email and password do not match an account.', false);
    });

    $('login-link').addEventListener('click', async () => {
        const msg = $('login-msg');
        const email = $('login-email').value.trim();
        if (!email) return say(msg, 'Enter your email first.', false);
        const { error } = await db.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false, emailRedirectTo: location.href.split('#')[0] },
        });
        if (error) say(msg, 'Could not send a link to that address. Check it is the one your account uses.', false);
        else say(msg, `Sign-in link sent to ${email}. Open it on this device.`, true);
    });

    $('sign-out').addEventListener('click', () => db.auth.signOut());

    db.auth.onAuthStateChange((_event, session) => {
        // Defer: supabase-js advises against awaiting other calls inside this callback
        setTimeout(() => (session ? start(session.user) : showLogin()), 0);
    });

    function showLogin() {
        me = null;
        $('view-app').hidden = true;
        $('view-login').hidden = false;
    }

    async function start(user) {
        if (me && me.id === user.id) return;
        const { data: profile } = await db.from('profiles').select('id, email, display_name, role').eq('id', user.id).single();
        me = profile || { id: user.id, email: user.email, display_name: '', role: null };

        $('view-login').hidden = true;
        $('view-app').hidden = false;
        $('who').textContent = `${me.email} · ${me.role || 'no access'}`;
        document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = me.role !== 'admin'; });

        if (!me.role) {
            showPanel(null);
            $('no-access').hidden = false;
            return;
        }
        const { data } = await db.from('districts').select('slug, name');
        districts = DISTRICT_PAGES.map(slug => (data || []).find(d => d.slug === slug)).filter(Boolean);
        $('district-select').innerHTML = $('post-district').innerHTML =
            districts.map(d => `<option value="${d.slug}">${escapeHtml(d.name)}</option>`).join('');
        route();
    }

    // ---------- Navigation (#districts, #posts, #edit/<id>, #new, #authors) ----------
    function showPanel(name) {
        ['districts', 'posts', 'editor', 'authors'].forEach(p => { $(`panel-${p}`).hidden = p !== name; });
        $('no-access').hidden = true;
        document.querySelectorAll('.side a[data-view]').forEach(a => {
            a.classList.toggle('on', a.dataset.view === name || (name === 'editor' && a.dataset.view === 'posts'));
        });
    }

    function route() {
        if (!me || !me.role) return;
        const [view, id] = location.hash.slice(1).split('/');
        const isAdmin = me.role === 'admin';
        if (view === 'districts' && isAdmin) return openDistricts();
        if (view === 'authors' && isAdmin) return openAuthors();
        if (view === 'edit' && id) return openEditor(id);
        if (view === 'new') return openEditor(null);
        if (!view && isAdmin) return openDistricts();
        return openPosts();
    }

    window.addEventListener('hashchange', route);
    $('new-post').addEventListener('click', () => { location.hash = 'new'; });

    // ---------- Districts ----------
    function spotRow(spot) {
        const row = document.createElement('div');
        row.className = 'spot';
        row.innerHTML = `
            <div class="spot-move">
                <button type="button" data-move="-1" aria-label="Move up">↑</button>
                <button type="button" data-move="1" aria-label="Move down">↓</button>
            </div>
            <div>
                <input type="text" class="spot-name" aria-label="Place name" required>
                <textarea class="spot-body" rows="3" aria-label="What to know"></textarea>
            </div>
            <button type="button" class="del">Remove</button>`;
        row.querySelector('.spot-name').value = spot.name || '';
        row.querySelector('.spot-body').value = spot.body || '';
        return row;
    }

    function refreshSpots() {
        const rows = [...$('spots').children];
        $('spot-count').textContent = rows.length;
        rows.forEach((row, i) => {
            row.querySelector('[data-move="-1"]').disabled = i === 0;
            row.querySelector('[data-move="1"]').disabled = i === rows.length - 1;
        });
    }

    $('spots').addEventListener('click', event => {
        const row = event.target.closest('.spot');
        if (!row) return;
        if (event.target.classList.contains('del')) row.remove();
        const move = Number(event.target.dataset.move);
        if (move === -1 && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
        if (move === 1 && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
        refreshSpots();
    });

    $('add-spot').addEventListener('click', () => {
        const row = spotRow({});
        $('spots').appendChild(row);
        refreshSpots();
        row.querySelector('.spot-name').focus();
    });

    let loadedSpotIds = [];

    async function openDistricts() {
        showPanel('districts');
        await loadDistrict($('district-select').value || DISTRICT_PAGES[0]);
    }

    $('district-select').addEventListener('change', event => loadDistrict(event.target.value));

    async function loadDistrict(slug) {
        $('district-msg').textContent = '';
        const [{ data: district }, { data: spots }] = await Promise.all([
            db.from('districts').select('headline, description').eq('slug', slug).single(),
            db.from('recommended_spots').select('id, name, body').eq('district_slug', slug).order('position'),
        ]);
        $('district-headline').value = district?.headline || '';
        $('district-description').value = district?.description || '';
        $('district-view').href = districtPage(slug);
        loadedSpotIds = (spots || []).map(s => s.id);
        $('spots').replaceChildren(...(spots || []).map(spotRow));
        refreshSpots();
    }

    $('district-form').addEventListener('submit', event => {
        event.preventDefault();
        const button = event.submitter;
        busy(button, async () => {
            const slug = $('district-select').value;
            const msg = $('district-msg');
            const { error } = await db.from('districts').update({
                headline: $('district-headline').value.trim(),
                description: $('district-description').value.trim(),
                updated_at: new Date().toISOString(),
            }).eq('slug', slug);
            if (error) return say(msg, `Not saved: ${error.message}`, false);

            // Insert the new list first and only then delete the old rows, so a failure never leaves the list empty
            const rows = [...$('spots').children].map((row, position) => ({
                district_slug: slug,
                name: row.querySelector('.spot-name').value.trim(),
                body: row.querySelector('.spot-body').value.trim(),
                position,
            })).filter(s => s.name);
            if (rows.length) {
                const { error: insertError } = await db.from('recommended_spots').insert(rows);
                if (insertError) return say(msg, `Intro saved, spots not saved: ${insertError.message}`, false);
            }
            if (loadedSpotIds.length) {
                await db.from('recommended_spots').delete().in('id', loadedSpotIds);
            }
            await loadDistrict(slug);
            say(msg, `Saved. ${districtName(slug)} is updated on the live site.`, true);
        });
    });

    // ---------- Posts list ----------
    async function openPosts() {
        showPanel('posts');
        let query = db.from('posts').select('id, title, district_slug, author_name, status, updated_at').order('updated_at', { ascending: false });
        if (me.role !== 'admin') query = query.eq('author_id', me.id);
        const { data } = await query;
        const posts = data || [];
        $('posts-empty').hidden = posts.length > 0;
        $('posts-body').innerHTML = posts.map(p => `
            <tr>
                <td><a href="#edit/${p.id}">${escapeHtml(p.title)}</a></td>
                <td>${escapeHtml(districtName(p.district_slug))}</td>
                <td>${escapeHtml(p.author_name)}</td>
                <td><span class="pill ${p.status}">${p.status === 'published' ? 'Published' : 'Draft'}</span></td>
                <td>${new Date(p.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            </tr>`).join('');
    }

    // ---------- Post editor ----------
    let slugTouched = false;
    let coverUrl = null;

    function renderPreview() {
        const title = $('post-title').value.trim();
        $('post-preview').innerHTML = (title ? `<h2>${escapeHtml(title)}</h2>` : '') +
            DOMPurify.sanitize(marked.parse($('post-body').value || ''));
    }

    function setCover(url) {
        coverUrl = url;
        $('post-cover-preview').hidden = !url;
        $('post-cover-remove').hidden = !url;
        if (url) $('post-cover-preview').src = url;
        else $('post-cover-preview').removeAttribute('src');
    }

    async function openEditor(id) {
        showPanel('editor');
        $('post-msg').textContent = '';
        $('delete-post').classList.remove('confirm');
        $('delete-post').textContent = 'Delete';
        editingPost = null;
        if (id) {
            const { data } = await db.from('posts').select('*').eq('id', id).single();
            if (!data) return say($('post-msg'), 'This post could not be opened.', false);
            editingPost = data;
        }
        const p = editingPost || { district_slug: $('district-select').value || DISTRICT_PAGES[0], status: 'draft' };
        $('editor-heading').textContent = editingPost ? 'Edit post' : 'New post';
        $('post-title').value = p.title || '';
        $('post-district').value = p.district_slug;
        $('post-slug').value = p.slug || '';
        $('post-tag').value = p.tag || '';
        $('post-excerpt').value = p.excerpt || '';
        $('post-body').value = p.body_md || '';
        $('post-cover').value = '';
        setCover(p.cover_url || null);
        slugTouched = Boolean(p.slug);
        $('save-publish').textContent = p.status === 'published' ? 'Update' : 'Publish';
        $('save-draft').textContent = p.status === 'published' ? 'Unpublish' : 'Save draft';
        $('delete-post').hidden = !editingPost;
        renderPreview();
    }

    $('post-title').addEventListener('input', () => {
        if (!slugTouched) $('post-slug').value = slugify($('post-title').value);
        renderPreview();
    });
    $('post-slug').addEventListener('input', () => { slugTouched = true; });
    $('post-body').addEventListener('input', renderPreview);

    // Covers are converted to WebP and capped at 1600px wide before upload
    $('post-cover').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        const msg = $('post-msg');
        say(msg, 'Uploading cover…', true);
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, 1600 / bitmap.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
            const path = `${$('post-district').value}/${crypto.randomUUID()}.webp`;
            const { error } = await db.storage.from('blog-images').upload(path, blob, { contentType: 'image/webp' });
            if (error) throw error;
            setCover(db.storage.from('blog-images').getPublicUrl(path).data.publicUrl);
            say(msg, 'Cover uploaded. Save the post to keep it.', true);
        } catch (error) {
            say(msg, `Cover not uploaded: ${error.message || 'the file could not be read as an image'}.`, false);
        }
    });

    $('post-cover-remove').addEventListener('click', () => setCover(null));

    // Enter in a one-line field would submit with the first button, which is "Unpublish" on a live post
    $('post-form').addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.matches('input')) event.preventDefault();
    });

    $('post-form').addEventListener('submit', event => {
        event.preventDefault();
        const button = event.submitter;
        busy(button, async () => {
            const msg = $('post-msg');
            const status = button.dataset.status;
            const fields = {
                title: $('post-title').value.trim(),
                district_slug: $('post-district').value,
                slug: $('post-slug').value.trim(),
                tag: $('post-tag').value.trim(),
                excerpt: $('post-excerpt').value.trim(),
                body_md: $('post-body').value,
                cover_url: coverUrl,
                status,
                updated_at: new Date().toISOString(),
            };
            if (status === 'published' && !(editingPost && editingPost.published_at)) {
                fields.published_at = new Date().toISOString();
            }
            const result = editingPost
                ? await db.from('posts').update(fields).eq('id', editingPost.id).select().single()
                : await db.from('posts').insert({ ...fields, author_id: me.id, author_name: me.display_name || me.email }).select().single();

            if (result.error) {
                const duplicate = result.error.code === '23505';
                return say(msg, duplicate
                    ? 'Another story in this district already uses this link text. Change the link text and save again.'
                    : `Not saved: ${result.error.message}`, false);
            }
            const wasNew = !editingPost;
            editingPost = result.data;
            if (wasNew) history.replaceState(null, '', `#edit/${editingPost.id}`);
            await openEditor(editingPost.id);
            say(msg, status === 'published'
                ? 'Published. It is live on the district page.'
                : 'Saved as a draft. It is not visible on the site.', true);
        });
    });

    // Two-step delete: the first click arms the button, the second deletes
    $('delete-post').addEventListener('click', async event => {
        const button = event.currentTarget;
        if (!button.classList.contains('confirm')) {
            button.classList.add('confirm');
            button.textContent = 'Click again to delete for good';
            return;
        }
        const { error } = await db.from('posts').delete().eq('id', editingPost.id);
        if (error) return say($('post-msg'), `Not deleted: ${error.message}`, false);
        location.hash = 'posts';
    });

    // ---------- Authors (admin only) ----------
    async function openAuthors() {
        showPanel('authors');
        const { data } = await db.from('profiles').select('id, email, display_name, role').order('email');
        $('authors-body').innerHTML = (data || []).map(p => `
            <tr class="authors-row" data-id="${p.id}">
                <td>${escapeHtml(p.email)}</td>
                <td><input type="text" value="${escapeHtml(p.display_name)}" aria-label="Name shown on posts for ${escapeHtml(p.email)}"></td>
                <td><select aria-label="Role for ${escapeHtml(p.email)}" ${p.id === me.id ? 'disabled title="You cannot change your own role"' : ''}>
                    <option value="" ${!p.role ? 'selected' : ''}>No access</option>
                    <option value="author" ${p.role === 'author' ? 'selected' : ''}>Author</option>
                    <option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select></td>
                <td><button class="btn ghost" type="button">Save</button> <span class="msg"></span></td>
            </tr>`).join('');
    }

    $('authors-body').addEventListener('click', async event => {
        if (!event.target.matches('button')) return;
        const row = event.target.closest('tr');
        const fields = { display_name: row.querySelector('input').value.trim() };
        const select = row.querySelector('select');
        if (!select.disabled) fields.role = select.value || null;
        const { error } = await db.from('profiles').update(fields).eq('id', row.dataset.id);
        say(row.querySelector('.msg'), error ? 'Not saved' : 'Saved', !error);
    });
})();
