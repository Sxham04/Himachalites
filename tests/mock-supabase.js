// In-memory stand-in for the parts of Supabase the site uses (auth, REST, storage), plus a static
// file server for the repo. Used by the Playwright tests so they never touch the real project.
// It does not enforce row level security; those rules live in supabase/schema.sql.
//
//   node tests/mock-supabase.js        -> http://127.0.0.1:8790
//   POST /__reset                      -> restore the seed data between tests
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8790);
const ORIGIN = `http://127.0.0.1:${PORT}`;

const USERS = [
    { id: '11111111-1111-4111-8111-111111111111', email: 'admin@test.local', password: 'admin-pass', display_name: 'Himachalites team', role: 'admin' },
    { id: '22222222-2222-4222-8222-222222222222', email: 'author@test.local', password: 'author-pass', display_name: 'Guest writer', role: 'author' },
    { id: '33333333-3333-4333-8333-333333333333', email: 'pending@test.local', password: 'pending-pass', display_name: 'pending', role: null },
];

// ---------- Seed data from supabase/seed.sql ----------
function parseSeed() {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/seed.sql'), 'utf8');
    const values = s => [...s.matchAll(/'((?:[^']|'')*)'|(\d+)/g)].map(m => (m[1] !== undefined ? m[1].replace(/''/g, "'") : Number(m[2])));
    const districts = [];
    const spots = [];
    let nextId = 1;
    for (const statement of sql.split(/\);\r?\n/)) {
        const m = statement.match(/values \(([\s\S]*)$/);
        if (!m) continue;
        const v = values(m[1]);
        if (statement.includes('public.districts')) districts.push({ slug: v[0], name: v[1], headline: v[2], description: v[3], updated_at: new Date().toISOString() });
        else if (statement.includes('public.recommended_spots')) spots.push({ id: nextId++, district_slug: v[0], name: v[1], body: v[2], position: v[3] });
    }
    return { districts, spots };
}

let db;
function reset() {
    const { districts, spots } = parseSeed();
    db = {
        districts,
        recommended_spots: spots,
        profiles: USERS.map(({ id, email, display_name, role }) => ({ id, email, display_name, role })),
        posts: [
            {
                id: crypto.randomUUID(), district_slug: 'solan', slug: 'barog-station-at-dusk', title: 'Barog station at dusk', tag: 'Rail',
                excerpt: 'Chai, pine air and the toy train.', body_md: 'The station is quiet until the train comes.', cover_url: null,
                author_id: USERS[0].id, author_name: 'Himachalites team', status: 'published',
                published_at: '2026-07-09T06:00:00Z', created_at: '2026-07-09T06:00:00Z', updated_at: '2026-07-09T06:00:00Z',
            },
            {
                id: crypto.randomUUID(), district_slug: 'kangra', slug: 'guest-draft', title: 'A guest draft from Kangra', tag: '',
                excerpt: '', body_md: 'Draft text.', cover_url: null,
                author_id: USERS[1].id, author_name: 'Guest writer', status: 'draft',
                published_at: null, created_at: '2026-08-01T06:00:00Z', updated_at: '2026-08-01T06:00:00Z',
            },
        ],
        files: {},
    };
}
reset();

// ---------- PostgREST-style filtering ----------
function applyFilters(rows, params) {
    let result = rows.filter(row => [...params].every(([key, value]) => {
        if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(key)) return true;
        if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
        if (value.startsWith('in.(')) return value.slice(4, -1).split(',').map(v => v.replace(/^"|"$/g, '')).includes(String(row[key]));
        if (value === 'is.null') return row[key] === null;
        return true;
    }));
    const order = params.get('order');
    if (order) {
        const [column, direction] = order.split(',')[0].split('.');
        result = result.slice().sort((a, b) => {
            const x = a[column] ?? '';
            const y = b[column] ?? '';
            const cmp = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
            return direction === 'desc' ? -cmp : cmp;
        });
    }
    const limit = params.get('limit');
    if (limit) result = result.slice(0, Number(limit));
    return result;
}

function pick(row, select) {
    if (!select || select === '*') return { ...row };
    return Object.fromEntries(select.split(',').map(c => c.trim()).filter(c => c in row).map(c => [c, row[c]]));
}

// ---------- Auth ----------
function base64url(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function tokenFor(user) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url({ sub: user.id, email: user.email, role: 'authenticated', exp })}.signature`;
}

function sessionFor(user) {
    return {
        access_token: tokenFor(user),
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `refresh-${user.id}`,
        user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    };
}

function userFromRequest(req) {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer /, '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        return USERS.find(u => u.id === payload.sub) || null;
    } catch { return null; }
}

// ---------- HTTP ----------
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };

function send(res, status, body, type = 'application/json') {
    res.writeHead(status, {
        'Content-Type': type,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,PUT,OPTIONS',
    });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
    return new Promise(resolve => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, ORIGIN);
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (url.pathname === '/__reset') { reset(); return send(res, 200, { ok: true }); }

    // Point the site at this server instead of the real project
    if (url.pathname === '/js/supabase-config.js') {
        return send(res, 200, `window.HIMACHALITES_SUPABASE = { url: '${ORIGIN}', anonKey: 'sb_publishable_test' };`, 'text/javascript');
    }

    // Auth
    if (url.pathname === '/auth/v1/token') {
        const body = JSON.parse((await readBody(req)).toString() || '{}');
        const user = USERS.find(u => u.email === body.email && u.password === body.password);
        if (!user) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return send(res, 200, sessionFor(user));
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204, '');
    if (url.pathname === '/auth/v1/otp') return send(res, 200, {});
    if (url.pathname === '/auth/v1/user') {
        const user = userFromRequest(req);
        return user ? send(res, 200, sessionFor(user).user) : send(res, 401, { msg: 'not signed in' });
    }

    // Storage
    const upload = url.pathname.match(/^\/storage\/v1\/object\/(?!public\/)([^/]+)\/(.+)$/);
    if (upload && req.method === 'POST') {
        db.files[`${upload[1]}/${upload[2]}`] = await readBody(req);
        return send(res, 200, { Key: `${upload[1]}/${upload[2]}` });
    }
    const download = url.pathname.match(/^\/storage\/v1\/object\/public\/(.+)$/);
    if (download) {
        const file = db.files[decodeURIComponent(download[1])];
        return file ? send(res, 200, file, 'image/webp') : send(res, 404, {});
    }

    // REST
    const rest = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if (rest) {
        const table = db[rest[1]];
        if (!table) return send(res, 404, { message: 'no such table' });
        const params = url.searchParams;
        const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');
        const returnRows = (req.headers.prefer || '').includes('return=representation');
        const select = params.get('select');
        const out = rows => {
            const shaped = rows.map(r => pick(r, select));
            if (wantsObject) return shaped.length === 1 ? send(res, 200, shaped[0]) : send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
            return send(res, 200, shaped);
        };

        if (req.method === 'GET') return out(applyFilters(table, params));

        if (req.method === 'POST') {
            const body = JSON.parse((await readBody(req)).toString());
            const incoming = Array.isArray(body) ? body : [body];
            const created = [];
            for (const values of incoming) {
                const row = { ...values };
                if (rest[1] === 'posts') {
                    if (db.posts.some(p => p.district_slug === row.district_slug && p.slug === row.slug)) {
                        return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint "posts_district_slug_slug_key"' });
                    }
                    row.id = crypto.randomUUID();
                    row.created_at = new Date().toISOString();
                    row.published_at = row.published_at || null;
                    row.tag = row.tag || '';
                    row.excerpt = row.excerpt || '';
                }
                if (rest[1] === 'recommended_spots') row.id = Math.max(0, ...table.map(r => r.id)) + 1;
                table.push(row);
                created.push(row);
            }
            return returnRows ? out(created) : send(res, 201, '');
        }

        if (req.method === 'PATCH') {
            const values = JSON.parse((await readBody(req)).toString());
            const rows = applyFilters(table, params);
            if (rest[1] === 'posts' && values.slug) {
                const clash = rows.find(r => db.posts.some(p => p !== r && p.district_slug === (values.district_slug || r.district_slug) && p.slug === values.slug));
                if (clash) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
            }
            rows.forEach(r => Object.assign(r, values));
            return returnRows ? out(rows) : send(res, 204, '');
        }

        if (req.method === 'DELETE') {
            const rows = applyFilters(table, params);
            db[rest[1]] = table.filter(r => !rows.includes(r));
            return returnRows ? out(rows) : send(res, 204, '');
        }
    }

    // Static files
    // Like GitHub Pages: /dir/ serves dir/index.html and /name serves name.html
    let file = path.join(ROOT, decodeURIComponent(url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname));
    if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain');
    fs.readFile(file, (error, data) => {
        if (error) return send(res, 404, 'not found', 'text/plain');
        send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
    });
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock Supabase + site on ${ORIGIN}`));
