// Supabase project settings, from the dashboard: Project Settings > API Keys.
// anonKey takes the "publishable" key (sb_publishable_...) or the legacy "anon" key.
// Either is designed to be public; what it can do is limited by the
// row level security rules in supabase/schema.sql. Never put the
// service_role key here.
// While these are empty, the site behaves exactly as before: the blog spot
// stays hidden and the district text in the HTML is shown unchanged.
window.HIMACHALITES_SUPABASE = {
    url: '',
    anonKey: '',
};
