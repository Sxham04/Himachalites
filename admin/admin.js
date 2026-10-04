// Admin area: sign-in, district text editor, stories (with live preview) and authors.
// Every write is also checked by the row level security rules in supabase/schema.sql, so hiding a
// control here is a convenience, not the protection.
(function () {
    const config = window.HIMACHALITES_SUPABASE || {};
    const lib = window.AdminLib;
    const site = window.HimachalitesContent;
    const $ = id => document.getElementById(id);
    const esc = site.escapeHtml;

    if (!config.url || !config.anonKey) {
        document.body.innerHTML = '<p style="padding:40px;font-family:Helvetica,Arial,sans-serif">Add the Supabase URL and key to js/supabase-config.js first.</p>';
        return;
    }

    const db = supabase.createClient(config.url, config.anonKey);

    const state = {
        me: null,                 // { id, email, display_name, role }
        districts: [],            // [{ slug, name }] in page order
        spotCounts: {},           // slug -> number of recommended spots
        district: null,           // slug open in the district editor
        districtSaved: null,      // { headline, description, spots: [{ id, name, body }] }
        post: null,               // post row open in the story editor (null for a new story)
        postSnapshot: '',         // serialised form at last load/save, for the unsaved-changes check
        cover: null,              // cover URL in the editor
        slugTouched: false,
        publishedCache: {},       // district slug -> published posts, for the preview
        currentView: null,
        startedFor: null,         // user id whose setup has started (setup must run once per sign-in)
        ready: false,             // setup finished; routing is allowed
    };

    // ============ Small helpers ============
    let toastTimer;
    function toast(text, isError) {
        const el = $('toast');
        el.textContent = text;
        el.classList.toggle('is-error', Boolean(isError));
        el.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('is-visible'), isError ? 6000 : 3200);
    }

    async function busy(button, label, work) {
        const original = button.innerHTML;
        button.disabled = true;
        button.classList.add('is-busy');
        if (label) button.textContent = label;
        try { return await work(); } finally {
            button.disabled = false;
            button.classList.remove('is-busy');
            button.innerHTML = original;
        }
    }

    function autosize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight + 2}px`;
    }
    document.addEventListener('input', event => {
        if (event.target.matches('textarea[data-autosize]')) autosize(event.target);
    });

    function districtName(slug) {
        return (state.districts.find(d => d.slug === slug) || {}).name || slug;
    }

    function shortDate(iso) {
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // ============ Sign in ============
    $('login-form').addEventListener('submit', async event => {
        event.preventDefault();
        const msg = $('login-msg');
        const email = $('login-email');
        const password = $('login-password');
        msg.className = 'form-msg';
        email.removeAttribute('aria-invalid');
        password.removeAttribute('aria-invalid');
        if (!email.value.trim()) {
            email.setAttribute('aria-invalid', 'true');
            msg.textContent = 'Enter the email address your account uses.';
            return email.focus();
        }
        if (!password.value) {
            password.setAttribute('aria-invalid', 'true');
            msg.textContent = 'Enter your password, or use the sign-in link below.';
            return password.focus();
        }
        await busy($('login-submit'), 'Signing in…', async () => {
            const { error } = await db.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
            if (error) {
                msg.textContent = error.message === 'Invalid login credentials'
                    ? 'That email and password do not match an account.'
                    : `Could not sign in: ${error.message}`;
            }
        });
    });

    $('login-link').addEventListener('click', async () => {
        const msg = $('login-msg');
        const email = $('login-email').value.trim();
        msg.className = 'form-msg';
        if (!email) {
            $('login-email').setAttribute('aria-invalid', 'true');
            msg.textContent = 'Enter your email first, then ask for a link.';
            return $('login-email').focus();
        }
        const { error } = await db.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false, emailRedirectTo: location.href.split('#')[0] },
        });
        if (error) {
            msg.textContent = 'Could not send a link to that address. Check it is the one your account uses.';
        } else {
            msg.className = 'form-msg ok';
            msg.textContent = `Sign-in link sent to ${email}. Open it on this device.`;
        }
    });

    db.auth.onAuthStateChange((_event, session) => {
        // Deferred: supabase-js advises against awaiting other calls inside this callback
        setTimeout(() => (session ? start(session.user) : showLogin()), 0);
    });

    function showLogin() {
        state.me = null;
        state.startedFor = null;
        state.ready = false;
        delete document.body.dataset.ready;
        $('view-app').hidden = true;
        $('view-login').hidden = false;
    }

    // ============ Account menu ============
    function setMenu(open) {
        $('account-menu').classList.toggle('is-open', open);
        $('account-toggle').setAttribute('aria-expanded', String(open));
    }
    $('account-toggle').addEventListener('click', event => {
        event.stopPropagation();
        setMenu($('account-toggle').getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('click', event => {
        if (!event.target.closest('.account')) setMenu(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setMenu(false);
    });
    $('sign-out').addEventListener('click', async () => {
        if (!confirmLeave()) return;
        setMenu(false);
        await db.auth.signOut();
    });

    // ============ Start ============
    async function start(user) {
        // Supabase can report the same session twice (initial session + sign-in); claim setup before any await
        if (state.startedFor === user.id) return;
        state.startedFor = user.id;
        const { data: profile } = await db.from('profiles').select('id, email, display_name, role').eq('id', user.id).maybeSingle();
        state.me = profile || { id: user.id, email: user.email, display_name: '', role: null };
        const me = state.me;

        $('view-login').hidden = true;
        $('view-app').hidden = false;
        $('account-avatar').textContent = lib.initials(me.display_name || me.email);
        $('account-name').textContent = me.display_name || me.email.split('@')[0];
        $('account-role').textContent = me.role || 'No access';
        $('account-email').textContent = me.email;
        document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = me.role !== 'admin'; });

        if (!me.role) {
            state.ready = true;
            document.body.dataset.ready = 'true';
            return showView('no-access');
        }

        const { data } = await db.from('districts').select('slug, name');
        state.districts = site.DISTRICTS.map(slug => (data || []).find(d => d.slug === slug)).filter(Boolean);
        renderDistrictChips();
        if (me.role === 'admin') await loadSpotCounts();
        state.ready = true;
        document.body.dataset.ready = 'true';
        route();
    }

    // ============ Routing (#districts, #posts, #new, #edit/<id>, #authors) ============
    function showView(name) {
        state.currentView = name;
        ['districts', 'posts', 'editor', 'authors', 'no-access'].forEach(view => {
            $(`panel-${view}`).hidden = view !== name;
        });
        document.querySelectorAll('.rail-nav a').forEach(a => {
            const current = a.dataset.view === name || (name === 'editor' && a.dataset.view === 'posts');
            if (current) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
    }

    function isDirty() {
        if (state.currentView === 'districts') return districtDirty();
        if (state.currentView === 'editor') return postDirty();
        return false;
    }

    function confirmLeave() {
        if (!isDirty()) return true;
        toast('You have unsaved changes. Save or discard them first.', true);
        const bar = state.currentView === 'districts' ? $('district-bar') : $('post-bar');
        bar.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
        return false;
    }

    let lastHash = location.hash;
    let ignoreHash = false;
    window.addEventListener('hashchange', () => {
        if (ignoreHash) { ignoreHash = false; return; }
        if (!confirmLeave()) {
            ignoreHash = true;
            location.hash = lastHash;
            return;
        }
        route();
    });

    window.addEventListener('beforeunload', event => {
        if (isDirty()) event.preventDefault();
    });

    function route() {
        lastHash = location.hash;
        const me = state.me;
        if (!state.ready || !me || !me.role) return; // start() routes once setup is done
        const [view, id] = location.hash.slice(1).split('/');
        const isAdmin = me.role === 'admin';
        if (view === 'districts' && isAdmin) return openDistricts();
        if (view === 'authors' && isAdmin) return openAuthors();
        if (view === 'edit' && id) return openEditor(id);
        if (view === 'new') return openEditor(null);
        if (!view && isAdmin) return openDistricts();
        return openPosts();
    }

    // ============ Districts ============
    async function loadSpotCounts() {
        const { data } = await db.from('recommended_spots').select('district_slug');
        state.spotCounts = {};
        (data || []).forEach(row => { state.spotCounts[row.district_slug] = (state.spotCounts[row.district_slug] || 0) + 1; });
    }

    function renderDistrictList() {
        $('district-list').innerHTML = state.districts.map(d => `
            <button type="button" data-slug="${d.slug}" ${d.slug === state.district ? 'aria-current="true"' : ''}>
                <span>${esc(d.name)}</span><small>${state.spotCounts[d.slug] || 0}</small>
            </button>`).join('');
    }

    $('district-list').addEventListener('click', event => {
        const button = event.target.closest('button[data-slug]');
        if (!button || button.dataset.slug === state.district) return;
        if (!confirmLeave()) return;
        loadDistrict(button.dataset.slug);
    });

    async function openDistricts() {
        showView('districts');
        await loadDistrict(state.district || site.DISTRICTS[0]);
    }

    function spotItem(spot) {
        const li = document.createElement('li');
        li.className = 'spot';
        li.innerHTML = `
            <div class="spot-fields">
                <input type="text" class="spot-name" aria-label="Place name" placeholder="Place name" maxlength="120">
                <textarea class="spot-body" rows="2" aria-label="What to know" placeholder="What to know, in a sentence or two" data-autosize></textarea>
            </div>
            <div class="spot-actions">
                <button type="button" class="icon-btn" data-move="-1" aria-label="Move up"><svg><use href="#i-up"/></svg></button>
                <button type="button" class="icon-btn" data-move="1" aria-label="Move down"><svg><use href="#i-down"/></svg></button>
                <button type="button" class="icon-btn danger" data-remove aria-label="Remove spot"><svg><use href="#i-trash"/></svg></button>
            </div>`;
        li.querySelector('.spot-name').value = spot.name || '';
        li.querySelector('.spot-body').value = spot.body || '';
        return li;
    }

    function readSpots() {
        return [...$('spots').children].map(li => ({
            name: li.querySelector('.spot-name').value,
            body: li.querySelector('.spot-body').value,
        }));
    }

    function districtFormValue() {
        return JSON.stringify({
            headline: $('district-headline').value.trim(),
            description: $('district-description').value.trim(),
            spots: lib.cleanSpots(readSpots(), state.district).map(s => [s.name, s.body]),
        });
    }

    let districtSnapshot = '';
    function districtDirty() {
        return Boolean(state.district) && districtFormValue() !== districtSnapshot;
    }

    function refreshDistrictState() {
        const rows = [...$('spots').children];
        $('spot-count').textContent = `${rows.length} ${rows.length === 1 ? 'spot' : 'spots'}`;
        rows.forEach((row, i) => {
            row.querySelector('[data-move="-1"]').disabled = i === 0;
            row.querySelector('[data-move="1"]').disabled = i === rows.length - 1;
        });
        const bar = $('district-bar');
        bar.hidden = !districtDirty();
        bar.classList.remove('is-error');
        $('district-bar-text').textContent = 'Unsaved changes';
    }

    function fillDistrict(saved) {
        $('district-headline').value = saved.headline;
        $('district-headline').removeAttribute('aria-invalid');
        $('district-description').value = saved.description;
        $('spots').replaceChildren(...saved.spots.map(spotItem));
        districtSnapshot = districtFormValue();
        refreshDistrictState();
        requestAnimationFrame(() => document.querySelectorAll('#panel-districts textarea[data-autosize]').forEach(autosize));
    }

    async function loadDistrict(slug) {
        state.district = slug;
        renderDistrictList();
        $('district-title').textContent = districtName(slug);
        $('district-view').href = `../dist/${site.districtPage(slug)}`;
        $('spots').innerHTML = '<li class="skeleton" style="height:120px"></li>';
        const [{ data: district }, { data: spots }] = await Promise.all([
            db.from('districts').select('headline, description').eq('slug', slug).single(),
            db.from('recommended_spots').select('id, name, body').eq('district_slug', slug).order('position'),
        ]);
        if (state.district !== slug) return; // another district was picked while this one loaded
        state.districtSaved = { headline: district?.headline || '', description: district?.description || '', spots: spots || [] };
        fillDistrict(state.districtSaved);
    }

    $('district-form').addEventListener('input', refreshDistrictState);

    $('spots').addEventListener('click', event => {
        const button = event.target.closest('button');
        const row = event.target.closest('.spot');
        if (!button || !row) return;
        if (button.hasAttribute('data-remove')) {
            const next = row.nextElementSibling || row.previousElementSibling;
            row.remove();
            (next ? next.querySelector('.spot-name') : $('add-spot')).focus();
        } else {
            const move = Number(button.dataset.move);
            if (move === -1 && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
            if (move === 1 && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
            if (!button.disabled) button.focus();
        }
        refreshDistrictState();
    });

    $('add-spot').addEventListener('click', () => {
        const row = spotItem({});
        row.classList.add('is-new');
        $('spots').appendChild(row);
        refreshDistrictState();
        row.querySelector('.spot-name').focus();
    });

    $('district-discard').addEventListener('click', () => fillDistrict(state.districtSaved));

    $('district-form').addEventListener('submit', event => {
        event.preventDefault();
        const headline = $('district-headline');
        if (!headline.value.trim()) {
            headline.setAttribute('aria-invalid', 'true');
            headline.focus();
            return toast('The headline can\'t be empty.', true);
        }
        busy($('district-save'), 'Saving…', async () => {
            const slug = state.district;
            const bar = $('district-bar');
            const fail = text => { bar.classList.add('is-error'); $('district-bar-text').textContent = text; toast(text, true); };

            const { error } = await db.from('districts').update({
                headline: headline.value.trim(),
                description: $('district-description').value.trim(),
                updated_at: new Date().toISOString(),
            }).eq('slug', slug);
            if (error) return fail(`Not saved: ${error.message}`);

            // Insert the new list first and only then delete the old rows, so a failure never leaves the list empty
            const rows = lib.cleanSpots(readSpots(), slug);
            if (rows.length) {
                const { error: insertError } = await db.from('recommended_spots').insert(rows);
                if (insertError) return fail(`Intro saved, but the spots were not: ${insertError.message}`);
            }
            const oldIds = state.districtSaved.spots.map(s => s.id).filter(Boolean);
            if (oldIds.length) await db.from('recommended_spots').delete().in('id', oldIds);

            state.spotCounts[slug] = rows.length;
            await loadDistrict(slug);
            toast(`Saved. ${districtName(slug)} is updated on the live site.`);
        });
    });

    // ============ Stories list ============
    let allPosts = [];

    async function openPosts() {
        showView('posts');
        $('post-list').innerHTML = '<li class="skeleton skeleton-row"></li><li class="skeleton skeleton-row"></li><li class="skeleton skeleton-row"></li>';
        $('posts-empty').hidden = true;
        let query = db.from('posts')
            .select('id, title, district_slug, author_name, status, updated_at, cover_url')
            .order('updated_at', { ascending: false });
        if (state.me.role !== 'admin') query = query.eq('author_id', state.me.id);
        const { data, error } = await query;
        if (error) {
            $('post-list').innerHTML = '';
            return toast(`Stories could not be loaded: ${error.message}`, true);
        }
        allPosts = data || [];
        $('posts-sub').textContent = state.me.role === 'admin'
            ? 'Every story across all districts.'
            : 'Your stories. Published ones appear under the reels on their district page.';
        const counts = lib.statusCounts(allPosts);
        document.querySelectorAll('#post-filter [data-count]').forEach(el => { el.textContent = counts[el.dataset.count]; });
        renderPostList();
    }

    function renderPostList() {
        const filter = document.querySelector('input[name="post-filter"]:checked').value;
        const posts = allPosts.filter(p => filter === 'all' || p.status === filter);
        $('posts-empty').hidden = allPosts.length > 0;
        $('post-filter').hidden = allPosts.length === 0;
        if (!allPosts.length) { $('post-list').innerHTML = ''; return; }
        if (!posts.length) {
            $('post-list').innerHTML = `<li class="help" style="padding:16px 4px">No ${filter === 'draft' ? 'drafts' : 'published stories'} yet.</li>`;
            return;
        }
        $('post-list').innerHTML = posts.map(p => `
            <li class="post-row">
                <a href="#edit/${p.id}">
                    <span class="post-thumb">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">` : '<svg><use href="#i-image"/></svg>'}</span>
                    <span class="post-main">
                        <b>${esc(p.title)}</b>
                        <span>${esc(districtName(p.district_slug))}${p.author_name ? ` · ${esc(p.author_name)}` : ''}</span>
                    </span>
                    <span class="post-side">
                        <span class="pill ${p.status}">${p.status === 'published' ? 'Published' : 'Draft'}</span>
                        <time datetime="${p.updated_at}">Edited ${shortDate(p.updated_at)}</time>
                    </span>
                </a>
            </li>`).join('');
    }

    $('post-filter').addEventListener('change', renderPostList);

    // ============ Story editor ============
    function renderDistrictChips() {
        $('post-district').innerHTML = state.districts.map(d => `
            <label><input type="radio" name="post-district" value="${d.slug}"><span>${esc(d.name)}</span></label>`).join('');
    }

    function selectedDistrict() {
        const checked = document.querySelector('input[name="post-district"]:checked');
        return checked ? checked.value : null;
    }

    function postFormValue() {
        return JSON.stringify([
            $('post-title').value.trim(), selectedDistrict(), $('post-slug').value.trim(), $('post-tag').value.trim(),
            $('post-excerpt').value.trim(), $('post-body').value, state.cover,
        ]);
    }

    function postDirty() {
        return postFormValue() !== state.postSnapshot;
    }

    function refreshPostState() {
        const post = state.post;
        const dirty = postDirty();
        const published = post && post.status === 'published';
        const bar = $('post-bar');
        bar.classList.toggle('is-clean', !dirty && Boolean(post));
        bar.classList.remove('is-error');
        $('post-bar-text').textContent = !post ? 'Not saved yet'
            : dirty ? 'Unsaved changes'
            : published ? 'Live on the site' : 'Draft saved';

        const excerpt = $('post-excerpt').value.length;
        $('post-excerpt-count').textContent = `${excerpt} / 200`;
        const words = $('post-body').value.trim().split(/\s+/).filter(Boolean).length;
        $('post-words').textContent = `${words} ${words === 1 ? 'word' : 'words'} · ${site.readMinutes($('post-body').value)} min read`;

        const slug = $('post-slug');
        const slugOk = !slug.value || lib.isValidSlug(slug.value);
        if (slugOk) slug.removeAttribute('aria-invalid'); else slug.setAttribute('aria-invalid', 'true');
        $('post-slug-help').textContent = slugOk
            ? 'Part of the story\'s web address. Filled in from the title.'
            : 'Use lowercase letters, numbers and single hyphens only.';
        $('post-slug-help').style.color = slugOk ? '' : 'var(--danger)';
        schedulePreview();
    }

    function setCover(url) {
        state.cover = url;
        const img = $('cover-img');
        img.hidden = !url;
        if (url) img.src = url; else img.removeAttribute('src');
        $('cover-empty').hidden = Boolean(url);
        $('cover-drop').classList.toggle('has-image', Boolean(url));
        $('cover-remove').hidden = !url;
        $('cover-choose-label').textContent = url ? 'Replace image' : 'Choose image';
    }

    async function openEditor(id) {
        showView('editor');
        setTab('write');
        state.post = null;
        disarmDelete();
        if (id) {
            const { data } = await db.from('posts').select('*').eq('id', id).maybeSingle();
            if (!data) {
                toast('That story could not be opened. It may have been deleted.', true);
                ignoreHash = true;
                location.hash = 'posts';
                return openPosts();
            }
            state.post = data;
        }
        const p = state.post || { district_slug: state.district || site.DISTRICTS[0], status: 'draft' };
        $('editor-heading').textContent = state.post ? 'Edit story' : 'New story';
        const status = $('editor-status');
        status.className = `pill ${state.post ? p.status : ''}`;
        status.textContent = state.post ? (p.status === 'published' ? 'Published' : 'Draft') : '';
        $('post-title').value = p.title || '';
        const chip = document.querySelector(`input[name="post-district"][value="${p.district_slug}"]`);
        if (chip) chip.checked = true;
        $('post-slug').value = p.slug || '';
        $('post-tag').value = p.tag || '';
        $('post-excerpt').value = p.excerpt || '';
        $('post-body').value = p.body_md || '';
        $('post-cover').value = '';
        ['post-title', 'post-slug'].forEach(f => $(f).removeAttribute('aria-invalid'));
        setCover(p.cover_url || null);
        state.slugTouched = Boolean(p.slug);
        const published = p.status === 'published';
        $('save-publish').textContent = published ? 'Update' : 'Publish';
        $('save-draft').textContent = published ? 'Unpublish' : 'Save draft';
        $('danger-zone').hidden = !state.post;
        state.postSnapshot = postFormValue();
        refreshPostState();
        requestAnimationFrame(() => document.querySelectorAll('#panel-editor textarea[data-autosize]').forEach(autosize));
        if (!id) $('post-title').focus();
    }

    $('post-form').addEventListener('input', event => {
        if (event.target.id === 'post-title' && !state.slugTouched) {
            $('post-slug').value = lib.slugify($('post-title').value);
        }
        if (event.target.id === 'post-slug') state.slugTouched = true;
        refreshPostState();
    });
    $('post-form').addEventListener('change', event => {
        if (event.target.name === 'post-district') refreshPostState();
    });

    // Enter in a one-line field would submit with the first button, which is "Unpublish" on a live story
    $('post-form').addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.matches('input')) event.preventDefault();
    });

    // Cover upload: file picker or drag and drop; converted to WebP, at most 1600px wide
    async function uploadCover(file) {
        if (!file) return;
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Use a JPEG, PNG or WebP image.', true);
        const district = selectedDistrict() || 'misc';
        $('cover-progress').hidden = false;
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, 1600 / bitmap.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
            const path = `${district}/${crypto.randomUUID()}.webp`;
            const { error } = await db.storage.from('blog-images').upload(path, blob, { contentType: 'image/webp' });
            if (error) throw error;
            setCover(db.storage.from('blog-images').getPublicUrl(path).data.publicUrl);
            refreshPostState();
            toast('Cover uploaded. Save the story to keep it.');
        } catch (error) {
            toast(`Cover not uploaded: ${error.message || 'the file could not be read as an image'}.`, true);
        } finally {
            $('cover-progress').hidden = true;
        }
    }

    $('post-cover').addEventListener('change', event => uploadCover(event.target.files[0]));
    const drop = $('cover-drop');
    ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => { event.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(type => drop.addEventListener(type, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', event => { event.preventDefault(); uploadCover(event.dataTransfer.files[0]); });
    $('cover-remove').addEventListener('click', () => { setCover(null); refreshPostState(); });

    $('post-form').addEventListener('submit', event => {
        event.preventDefault();
        const button = event.submitter || $('save-draft');
        const status = button.dataset.status;
        const title = $('post-title');
        const slug = $('post-slug');
        if (!title.value.trim()) {
            title.setAttribute('aria-invalid', 'true');
            setTab('write');
            title.focus();
            return toast('Give the story a title before saving.', true);
        }
        title.removeAttribute('aria-invalid');
        if (!slug.value.trim()) slug.value = lib.slugify(title.value);
        if (!lib.isValidSlug(slug.value)) {
            slug.setAttribute('aria-invalid', 'true');
            setTab('write');
            slug.focus();
            return toast('Fix the link text: lowercase letters, numbers and single hyphens only.', true);
        }

        const label = status === 'published' ? 'Publishing…' : (state.post && state.post.status === 'published' ? 'Unpublishing…' : 'Saving…');
        busy(button, label, async () => {
            const fields = {
                title: title.value.trim(),
                district_slug: selectedDistrict(),
                slug: slug.value.trim(),
                tag: $('post-tag').value.trim(),
                excerpt: $('post-excerpt').value.trim(),
                body_md: $('post-body').value,
                cover_url: state.cover,
                status,
                updated_at: new Date().toISOString(),
            };
            if (status === 'published' && !(state.post && state.post.published_at)) fields.published_at = new Date().toISOString();

            const result = state.post
                ? await db.from('posts').update(fields).eq('id', state.post.id).select().single()
                : await db.from('posts').insert({ ...fields, author_id: state.me.id, author_name: state.me.display_name || state.me.email }).select().single();

            if (result.error) {
                const text = result.error.code === '23505'
                    ? 'Another story in this district already uses this link text. Change it and save again.'
                    : `Not saved: ${result.error.message}`;
                $('post-bar').classList.add('is-error');
                $('post-bar-text').textContent = 'Not saved';
                return toast(text, true);
            }
            const wasNew = !state.post;
            delete state.publishedCache[fields.district_slug];
            if (wasNew) {
                ignoreHash = true;
                location.hash = `edit/${result.data.id}`;
                lastHash = location.hash;
            }
            await openEditor(result.data.id);
            toast(status === 'published'
                ? `Published. It's live on the ${districtName(fields.district_slug)} page.`
                : 'Saved as a draft. Visitors can\'t see it.');
        });
    });

    // Two-step delete: the first click arms the button for 4 seconds, the second deletes
    let deleteTimer;
    function disarmDelete() {
        clearTimeout(deleteTimer);
        const button = $('delete-post');
        button.classList.remove('is-armed');
        button.innerHTML = '<svg><use href="#i-trash"/></svg>Delete story';
    }
    $('delete-post').addEventListener('click', async () => {
        const button = $('delete-post');
        if (!button.classList.contains('is-armed')) {
            button.classList.add('is-armed');
            button.textContent = 'Click again to delete';
            deleteTimer = setTimeout(disarmDelete, 4000);
            return;
        }
        clearTimeout(deleteTimer);
        const { error } = await db.from('posts').delete().eq('id', state.post.id);
        if (error) return toast(`Not deleted: ${error.message}`, true);
        delete state.publishedCache[state.post.district_slug];
        state.postSnapshot = postFormValue(); // nothing left to save
        toast('Story deleted.');
        location.hash = 'posts';
    });

    // Write / Preview tabs (below 1180px the preview moves behind a tab)
    function setTab(tab) {
        $('story-layout').dataset.tab = tab;
        document.querySelectorAll('#editor-tabs [role="tab"]').forEach(button => {
            button.setAttribute('aria-selected', String(button.dataset.tab === tab));
        });
        if (tab === 'preview') { renderPreview(); sizePreview(); }
    }
    $('editor-tabs').addEventListener('click', event => {
        const button = event.target.closest('[role="tab"]');
        if (button) setTab(button.dataset.tab);
    });

    // ============ Live preview ============
    // Renders with the site's own stylesheets and the same HTML builders as the live pages
    // (js/content-api.js), so what the admin sees is what visitors get.
    const frame = $('preview-frame');
    const stage = $('preview-stage');
    let previewTimer;
    let frameShell = '';

    function schedulePreview() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(renderPreview, 180);
    }

    function previewPage() {
        return document.querySelector('input[name="preview-page"]:checked').value;
    }

    function previewWidth() {
        return Number(document.querySelector('input[name="preview-width"]:checked').value);
    }

    async function publishedFor(slug) {
        if (!state.publishedCache[slug]) {
            try { state.publishedCache[slug] = await site.posts(slug, 4); } catch { state.publishedCache[slug] = []; }
        }
        return state.publishedCache[slug];
    }

    function draftAsPost() {
        return {
            slug: $('post-slug').value.trim() || 'draft',
            title: $('post-title').value.trim() || 'Untitled story',
            tag: $('post-tag').value.trim(),
            excerpt: $('post-excerpt').value.trim(),
            body_md: $('post-body').value,
            cover_url: state.cover,
            author_name: state.post ? state.post.author_name : (state.me.display_name || state.me.email),
            published_at: (state.post && state.post.published_at) || new Date().toISOString(),
        };
    }

    function frameDocument(body) {
        const base = new URL('../dist/', location.href).href;
        return `<!DOCTYPE html><html><head><meta charset="utf-8">
            <base href="${base}">
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&family=Shadows+Into+Light+Two&display=swap">
            <link rel="stylesheet" href="s12.css"><link rel="stylesheet" href="blog-spot.css">
            <style>html,body{background:#fff;min-height:0} a{pointer-events:none} main.main-content{padding-top:2.5rem} .blog-spot{margin-top:0}</style>
            </head><body><main class="main-content">${body}</main></body></html>`;
    }

    async function renderPreview() {
        if (state.currentView !== 'editor' || !state.me) return;
        const slug = selectedDistrict();
        if (!slug) return;
        const draft = draftAsPost();
        let body;
        if (previewPage() === 'district') {
            const posts = lib.previewPosts(draft, (await publishedFor(slug)).filter(p => !state.post || p.slug !== state.post.slug));
            body = `<section class="blog-spot"><h2 class="blog-spot-title">From the ${esc(districtName(slug))} journal</h2>
                <div class="blog-spot-body${posts.length === 1 ? ' blog-spot-single' : ''}">${site.blogSpotHtml(slug, posts)}</div></section>`;
            $('preview-note').textContent = 'How the blog section will look on the district page. Other published stories from this district are shown beside yours.';
        } else {
            body = `<article class="blog-post">${site.storyHtml({
                slug,
                districtName: districtName(slug),
                post: draft,
                bodyHtml: DOMPurify.sanitize(marked.parse(draft.body_md || '')),
                next: null,
            })}</article>`;
            $('preview-note').textContent = 'How the story page will look when someone opens it.';
        }

        // Swap only <main> when the frame is already set up, so the preview keeps its scroll position while typing
        const shell = `${previewPage()}`;
        const doc = frame.contentDocument;
        const main = doc && doc.querySelector('main.main-content');
        if (frameShell === shell && main) {
            main.innerHTML = body;
        } else {
            frameShell = shell;
            frame.srcdoc = frameDocument(body);
        }
    }

    function sizePreview() {
        const width = previewWidth();
        const stageWidth = stage.clientWidth;
        const stageHeight = stage.clientHeight;
        if (!stageWidth) return;
        const phone = width < 600;
        stage.classList.toggle('is-phone', phone);
        const inset = phone ? 16 : 0;
        const scale = Math.min(1, (stageWidth - inset * 2) / width);
        frame.style.width = `${width}px`;
        frame.style.height = `${Math.ceil((stageHeight - inset * 2) / scale)}px`;
        frame.style.left = `${phone ? Math.max(inset, (stageWidth - width * scale) / 2) : 0}px`;
        frame.style.top = `${inset}px`;
        frame.style.transform = `scale(${scale})`;
    }

    new ResizeObserver(sizePreview).observe(stage);
    document.querySelectorAll('input[name="preview-width"]').forEach(input => input.addEventListener('change', sizePreview));
    document.querySelectorAll('input[name="preview-page"]').forEach(input => input.addEventListener('change', renderPreview));

    // ============ Authors (admin only) ============
    async function openAuthors() {
        showView('authors');
        $('author-list').innerHTML = '<li class="skeleton skeleton-row"></li><li class="skeleton skeleton-row"></li>';
        const { data, error } = await db.from('profiles').select('id, email, display_name, role').order('email');
        if (error) return toast(`Authors could not be loaded: ${error.message}`, true);
        $('author-list').innerHTML = (data || []).map(p => {
            const self = p.id === state.me.id;
            const role = p.role || '';
            const option = (value, label) => `<label><input type="radio" name="role-${p.id}" value="${value}" ${role === value ? 'checked' : ''} ${self ? 'disabled' : ''}><span>${label}</span></label>`;
            return `
                <li class="author-row${role ? '' : ' no-role'}" data-id="${p.id}" data-role="${role}" data-name="${esc(p.display_name)}">
                    <span class="avatar">${esc(lib.initials(p.display_name || p.email))}</span>
                    <span class="author-who"><b>${esc(p.display_name || p.email)}</b><span>${esc(p.email)}${self ? ' · you' : ''}</span></span>
                    <input type="text" value="${esc(p.display_name)}" aria-label="Name shown on stories by ${esc(p.email)}" placeholder="Name shown on stories">
                    <div class="segmented small" role="radiogroup" aria-label="Role for ${esc(p.email)}"${self ? ' title="You can\'t change your own role"' : ''}>
                        ${option('', 'No access')}${option('author', 'Author')}${option('admin', 'Admin')}
                    </div>
                    <button class="btn btn-primary save-author" type="button">Save</button>
                </li>`;
        }).join('');
    }

    function authorDirty(row) {
        const checked = row.querySelector('input[type="radio"]:checked');
        return row.querySelector('input[type="text"]').value.trim() !== row.dataset.name
            || (checked ? checked.value : '') !== row.dataset.role;
    }

    $('author-list').addEventListener('input', event => {
        const row = event.target.closest('.author-row');
        if (row) row.classList.toggle('is-dirty', authorDirty(row));
    });
    $('author-list').addEventListener('change', event => {
        const row = event.target.closest('.author-row');
        if (row) row.classList.toggle('is-dirty', authorDirty(row));
    });

    $('author-list').addEventListener('click', event => {
        const button = event.target.closest('.save-author');
        if (!button) return;
        const row = button.closest('.author-row');
        const checked = row.querySelector('input[type="radio"]:checked');
        const fields = { display_name: row.querySelector('input[type="text"]').value.trim() };
        if (!checked || !checked.disabled) fields.role = checked && checked.value ? checked.value : null;
        busy(button, 'Saving…', async () => {
            const { error } = await db.from('profiles').update(fields).eq('id', row.dataset.id);
            if (error) return toast(`Not saved: ${error.message}`, true);
            row.dataset.name = fields.display_name;
            if ('role' in fields) row.dataset.role = fields.role || '';
            row.classList.remove('is-dirty');
            row.classList.toggle('no-role', !row.dataset.role);
            row.querySelector('.author-who b').textContent = fields.display_name || row.querySelector('.author-who span').textContent.split(' ·')[0];
            toast('Saved.');
        });
    });
})();
