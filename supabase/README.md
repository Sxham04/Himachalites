# Blog spot and admin setup

The district pages read their headline, description, recommended spots and blog posts from a
Supabase project. The admin area at `/admin/` is where the admin and authors sign in to edit them.

Until `js/supabase-config.js` is filled in, the site behaves exactly as before: the blog spot
stays hidden and the text written in the HTML is shown.

## One-time setup

1. **Create a project** at [supabase.com](https://supabase.com) (the free plan is enough).
2. **Create the tables.** In the dashboard open *SQL Editor › New query*, paste
   `schema.sql`, and run it. Then do the same with `seed.sql`, which copies in today's text
   for all 12 districts.
3. **Turn off public sign-up.** *Authentication › Sign In / Providers*: switch off
   "Allow new users to sign up". Only people you invite can then get an account.
4. **Allow the admin page as a sign-in destination.** *Authentication › URL Configuration*:
   set *Site URL* to the live site's address, and add `https://<your-site>/admin/index.html`
   under *Redirect URLs*. Sign-in links sent by email only work for addresses listed here.
5. **Create your admin account.** *Authentication › Users › Add user*, with your email and a
   password. Then in the SQL Editor run, with your email:

   ```sql
   update public.profiles
   set role = 'admin', display_name = 'Himachalites team'
   where email = 'you@example.com';
   ```

6. **Connect the site.** Copy the *Project URL* (*Project Settings › Data API*) and the
   *publishable* key (*Project Settings › API Keys*, starts with `sb_publishable_`; the legacy
   *anon* key also works) into `js/supabase-config.js`, then commit and deploy.

   Never put the *secret* key (`sb_secret_…`) or the legacy `service_role` key in the site.
   Either one bypasses every permission rule.

## Adding an author

1. Supabase dashboard › *Authentication › Users › Invite user*, with their email.
2. Once they have accepted, open `/admin/` › *Authors*, set their role to **Author**, set the
   name shown on their posts, and save.

Authors can write, publish, edit and delete their own posts. Only the admin can edit district
text, edit other people's posts, and change roles. These rules are enforced by the database
(row level security in `schema.sql`), not just hidden in the admin page.

## Good to know

- Free Supabase projects pause after about a week without any requests. Normal visitor
  traffic keeps the project awake; if it does pause, resume it from the dashboard.
- Post covers are converted to WebP and resized to at most 1600px wide before upload.
- Story text is Markdown. It is cleaned with DOMPurify before display, so pasted HTML or
  scripts cannot run on the site.
