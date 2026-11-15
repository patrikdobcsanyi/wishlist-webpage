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
