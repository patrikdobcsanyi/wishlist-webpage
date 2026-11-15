# Family wishlist

A family wishlist using plain HTML, CSS, and JavaScript:

- `index.html`: login and shared wishes, connected to Supabase.
- `styles.css`: page styling.
- `app.js`: login, profiles, wish editing, and claims.
- `config.js`: public Supabase connection settings.
- `supabase/schema.sql`: database tables and access policies.

## Editing the design

Style the forms and templates in `index.html` using `styles.css`. Keep the IDs,
input names, and `data-field` attributes: JavaScript uses those to find elements.
Preserve labels and the `hidden` attribute behavior when styling.

## Set up Supabase

1. Create a Supabase project. In its SQL Editor, run `supabase/schema.sql` once
   against the new project. It runs in a transaction; it is not a repeatable migration.
2. Keep email/password authentication enabled and disable public user signup
   in Auth settings. This app uses administrator-created accounts, not email invitations.
3. Choose a unique username for each person: 3–32 lowercase letters, numbers,
   or underscores (for example `patrik`). In Authentication → Users, create their
   account using `patrik@family.invalid` as the email identifier and an individual
   password. Mark the email confirmed through the administrator flow. This is an
   internal identifier, not a real mailbox; the login form accepts just `patrik`.
   Usernames are case-insensitive. Share passwords privately, never in this repository.
   Existing accounts must have their auth email changed to the matching identifier
   through the administrator tools; keep their user UUID and profile row.
4. Copy each created user's UUID. In the Table Editor, insert a row in `profiles`
   with that UUID as `id` and their name as `display_name`. This is the family allowlist;
   an auth account without a profile cannot read family data.
5. Put the project URL and **publishable** key into `config.js`. The browser must
   be able to read these values. Never use a secret or service-role key.

Supabase still handles password hashing and sessions using its email/password
provider. The app maps usernames to the internal `@family.invalid` identifiers;
no email is requested from family members and no email is sent. Email invitations
and email password recovery will not work with these identifiers. Forgotten
passwords must be reset by the administrator through Supabase's admin tools.
Password reset/change UI is not implemented yet. Display names in `profiles`
are independent of login usernames.

For local development, run from this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open http://localhost:8000/. The app loads a pinned Supabase JS client
from esm.sh, so it needs internet access. There is no build step or package install.

## GitHub Pages

Push these files to your repository. In Settings → Pages, choose deployment
from your branch and the repository root. The app will be at
`https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.
All asset links are relative, so repository subpaths work.

GitHub Pages hosts the public UI; authenticated family data lives in Supabase.

## Behavior and access rules

- Family members see everyone's profile and wishes.
- Members add, edit, and delete their own wishes.
- Members claim other people's wishes and release their own claims.
- A wish can have at most one claim, enforced by the database primary key.
- Recipients cannot fetch claims for their own wishes. Other members see whether
  a gift is reserved; the UI only names the claimant when it is the current user.
- Only the administrator can add profiles or change their names.
- Use Refresh wishes to see changes from another device. There is no realtime subscription.

The policies enforce authorization in Supabase. The UI alone is not the security
boundary. Claims are a surprise within this UI/API model, not from a database administrator.

## Verify after connecting

Use two family accounts in separate browser sessions:

1. Add and edit a wish as A; refresh B and check that it appears.
2. Claim it as B; refresh A and confirm no claim details appear.
3. With a third family account, attempt to claim the same wish: only one claim
   should succeed. Release it as B and refresh the third account.
4. Try API writes to another person's wish, a claim on your own wish, and deleting
   someone else's claim. They must fail or affect zero rows.
5. Check that signed-out requests and an auth account without a profile cannot
   read profiles, wishes, or claims. Log out and confirm the page clears family data.

Local syntax checks cannot verify database policies. Run these checks against
your configured project before sharing the app with the family.

References: [Supabase Auth](https://supabase.com/docs/guides/auth),
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security),
[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Product link previews

The wish form calls the `link-preview` Edge Function when a product link changes.
It suggests a title only if the title is empty, and shows an optional image. You
can retry with the preview button or remove the image before saving. Titles and
notes you type are never translated or replaced by a preview response.

### Update your existing project

1. Run `supabase/migrations/202611150001_wish_images.sql` in the SQL Editor.
   **Do not rerun `schema.sql` on the existing database.** New projects can use
   the updated `schema.sql` directly. The new frontend requires the image column.
2. In Supabase → Edge Functions, create a function named `link-preview` using
   the dashboard editor. Copy `supabase/functions/link-preview/index.js` into
   its entry file (the code also works in the editor's default `index.ts`).
3. In Edge Function secrets, set `PREVIEW_PUBLISHABLE_KEY` to the same public
   key used in `config.js`. No service-role key is needed.
4. Galaxus, Digitec, and Zalando Switzerland are allowed by default, with and
   without `www`. To change the list, set `PREVIEW_ALLOWED_HOSTS` to exact trusted
   hostnames separated by commas. This replaces the defaults, so include all
   shops you want to keep. Existing environment settings also override defaults.
5. The default image hosts are `static.digitecgalaxus.ch`, `static01.galaxus.com`,
   and `img01.ztat.net`. Override them with `PREVIEW_IMAGE_HOSTS` if needed.
   Page hosts are also allowed for images. If a CDN is missing, the title can
   still load without an image. These settings do not guarantee a shop allows
   automated requests; verify with real product links after deployment.
6. Disable **Verify JWT with legacy secret** for this function and deploy it.
   The handler itself verifies the user's token with Supabase Auth and checks
   their `profiles` membership before fetching. It is not an anonymous endpoint.
7. Publish the updated frontend files to GitHub Pages, including `i18n.js`.

If you have the Supabase CLI installed and authenticated, deployment from this
folder is also supported:

```sh
supabase functions deploy link-preview --project-ref gasuctbphdarhhvjwujp
```

The function configuration in `supabase/config.toml` sets its JavaScript entry
point and disables legacy gateway JWT verification. Set the above environment
values using the dashboard before trying previews.

### Limits and checks

Only HTTPS on the default port is accepted. Every page redirect is validated
against the exact host allowlist; private/reserved DNS addresses are rejected.
Only add trusted shops/CDNs: DNS validation is a preflight check, not connection
pinning, so the allowlist is part of the security boundary. Arbitrary domains,
IP literals, and unapproved redirect destinations are deliberately unsupported.
Requests time out after eight seconds, allow three redirects, and read at most
1 MB of HTML. Scripts are not run. The response contains only a title and image
URL; no remote HTML is inserted into the page. CORS allows different frontend
origins, but all data requests still require an authenticated family member.

Images load directly from their original host with no referrer. They are not
copied into Supabase Storage and can expire or be blocked by the shop. Broken
images are hidden. Shops that require JavaScript, block bots, or provide no
metadata will still allow a normal text-only wish. There is no automatic backfill:
edit an existing wish and use the preview button to add an image.

After deployment, check with a family account:

- An allowed product URL suggests a title and image; save and refresh to check persistence.
- A typed title remains unchanged. Editing a saved wish preserves its image.
- Removing the image or changing the URL clears the saved image as expected.
- An unsupported link or failed fetch still allows saving without an image.
- Switching between Hungarian and German translates the preview controls and messages.
- Signed-out/non-family requests fail; private addresses and unapproved redirects fail.

The local code has been syntax-checked. The Edge runtime, database migration,
shop responses, and authorization behavior still need these live checks.

Reference: [Supabase function deployment](https://supabase.com/docs/guides/functions/deploy).
