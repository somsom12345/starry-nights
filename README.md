# Starry Nights Translation

A book catalog website with genre filters, search, and an owner dashboard.

## Files
- `index.html`, `styles.css`, `app.js`: the website
- `config.js`: your Supabase URL and anon key go here
- `setup.sql`: run once in Supabase to create the database

## Setup
1. Supabase: SQL Editor > New query > paste `setup.sql` (with your email at the bottom) > Run
2. Supabase: Authentication > Users > Add user > your email + a password, tick Auto Confirm
3. Supabase: Authentication > Sign In / Providers > turn OFF "Allow new users to sign up"
4. Put your Project URL and anon key in `config.js`
5. GitHub: upload all files to the repo, then Settings > Pages > Deploy from branch > main > / (root) > Save

Log in from the "Owner login" link at the bottom of the site to reach the Dashboard.
