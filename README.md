# Football Tournament Scoreboard

This is a tournament website with a live TV scoreboard, public fixtures, results and standings, and an admin panel for running matches. It's built with **Vite + React + TypeScript**, and **Supabase** (free tier) provides the database, admin login and realtime updates.

## Pages

| URL | For | What it shows |
|---|---|---|
| `/` | Everyone | Active tournament: live matches, fixtures, results, group standings, knockout rounds, top scorers, squads |
| `/t/<slug>` | Everyone | A specific (e.g. past) tournament |
| `/match/<id>` | Everyone | One match: live score, clock and goals. Good for sharing on WhatsApp/Facebook |
| `/scoreboard` | TV / projector | Full-screen scoreboard for the match the admin chose with "Show on scoreboard" |
| `/scoreboard/<match-id>` | TV / projector | Full-screen scoreboard locked to one match (for two pitches at once) |
| `/admin` | Admins | Match control, matches, tournaments, teams and squads |

Add `?demo` to any public URL (e.g. `/scoreboard?demo`) to preview it with sample data. No database is needed for that.

## 1. Set up Supabase (about 5 minutes)

1. Create a free account at https://supabase.com and click **New project**.
2. In **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. In **Authentication → Users → Add user → Create new user**, add an admin email and password and tick *Auto confirm user*. Repeat for each admin.
4. In **Authentication → Sign In / Providers**, turn off *Allow new users to sign up*.
5. In **Project Settings → API**, copy the Project URL and the `anon` public key.
6. Copy `.env.example` to `.env.local` and paste both values into it.

**Updating an existing database:** run the whole `schema.sql` again. It's safe to re-run, and it adds new columns and tables (such as lineups and the field/bench settings) without touching your data.

Anyone can read the data, but only logged-in admins can change it. This is enforced by row-level security in the database. The anon key is meant to be public.

## 2. Run locally

```sh
npm install
npm run dev        # http://localhost:5173
```

## 3. Deploy

**Vercel**: import the repository at vercel.com, and in *Settings → Environment Variables* add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `vercel.json` is already set up so links like `/admin` work.

**Netlify**: import the repository at app.netlify.com and add the same two environment variables. `netlify.toml` already sets the build command and redirects.

After changing environment variables, redeploy so they're included in the build.

### Adding it to the school's own website / domain

Pick one of these:

1. **Subdomain (recommended)**, e.g. `football.school.edu.bd`. In Vercel or Netlify, go to *Domains → Add* and enter the subdomain. Then the school adds the CNAME record the host shows them. This works whatever their main website is built with.
2. **Sub-folder of their site**, e.g. `school.edu.bd/football/`. Build with `VITE_BASE=/football/ npm run build` and upload `dist/` into that folder. The server must send unknown paths under `/football/` to `/football/index.html`.
3. **Embed on an existing page**, for a WordPress page or similar:
   ```html
   <iframe src="https://football.school.edu.bd/scoreboard" style="width:100%;aspect-ratio:16/9;border:0" allowfullscreen></iframe>
   ```
   Any public page can be embedded the same way, e.g. `/` for the standings.

## Running a tournament

1. **Teams & squads**: add each school once. Teams are reused in later tournaments.
   - Short name is shown big (e.g. `CADT`), plus a subtitle, an optional logo URL and a colour.
   - Add players one by one, or paste a whole squad, one per line: `10 Samiul Haque`. Jersey numbers are optional.
2. **Tournaments**: create the tournament (name, year, tagline, points for a win or draw).
   - Tick the teams that take part.
   - For a group stage, type each team's group (A, B, …). Leave it empty for a single league table.
   - **Make active** chooses which tournament the home page shows. Past tournaments stay online at `/t/<slug>`.
3. **Matches**: create fixtures with the teams, kick-off time, venue, stage and half length.
   - The group is filled in automatically from the teams.
   - Tick **Knockout** for quarter-finals, semis and the final. These don't count in the standings and allow extra time and penalties.
   - Tick *Start the clock automatically* if the scoreboard should count down and kick off by itself.
4. **Match control** (on match day):
   - **Kick off → Pause/Resume → End 1st half → Start 2nd half → Full time**. For drawn knockouts there's also **Start extra time** and a **Penalty shoot-out** score.
   - **+1…+5** shows the announced added time. When a half's time runs out, the clock holds at 45:00 and counts the stoppage time beside it.
   - **Adjust clock** fixes the time if it was started late.
   - **Lineup**: in each team's panel, press **Set lineup** and mark players *Field*, *Bench* or *Out* (or use *Quick fill* / *Copy from last match*). How many may be on the field and on the bench is set per tournament, and a match can override it under **Matches**.
   - **Goals**: tap the scorer's jersey number. The minute fills in from the clock (e.g. `45+2'`); type a minute first to override it. Press **Penalty** before tapping to mark a penalty. An own goal is the red dashed row ("Own goal by a … player"): it lists the *opponent's* players and counts for the team whose panel it is in. A wrong goal can be removed, or its penalty mark switched, in the Goals list.
   - **Substitution**: tap the player going off, then the player coming on. The jersey buttons update straight away.
   - **Show on scoreboard** chooses which match the TV shows. Kicking off a match also puts it on the TV, unless another match is in progress there.

Every screen updates instantly. The clock runs on the database server's time, so phones, laptops and the TV stay in sync.

Standings count finished group or league matches, ranked by points, then goal difference, then goals scored.

## Customising

- School name, slogans and the values row are in [`src/brand.ts`](src/brand.ts).
- The tournament name, year and tagline are set in the admin panel.
- To use the real school logo or a stadium photo, put the files in `public/` (e.g. `public/logo.png`) and set `logoUrl: '/logo.png'` / `backgroundUrl: '/stadium.jpg'`.

## Project layout

```
src/
  brand.ts              school branding
  lib/                  supabase client, types, clock maths, standings, data provider, demo data
  components/           crests, match rows, site header
  pages/Scoreboard.tsx  TV scoreboard (styles/board.css)
  pages/TournamentPage.tsx, MatchPage.tsx   public site
  pages/admin/          login, match control, matches, tournaments, teams
supabase/schema.sql     database tables, security rules, realtime
```
