# Turning on accounts and friends

Accounts and friends run on [Supabase](https://supabase.com/), a free online database. You make the Supabase project yourself (it's your data, so it should be in your name), then send two things back so they can go into the app. It takes about 15 minutes. No coding.

Until this is done, the app works exactly like before. Profile and Friends just say "coming soon".

## 1. Make a Supabase account and project

1. Go to [supabase.com](https://supabase.com/) and tap **Start your project**. Sign up with your GitHub account (easiest) or an email.
2. Make a **New project**.
   - **Name:** `creeked-up`
   - **Database password:** tap **Generate a password**, and save it in a password manager. You won't need it for these steps, and **never** send it to anyone, including Claude.
   - **Region:** pick **Canada (Central)** if it's in the list. If not, pick the one closest to Ontario.
   - **Plan:** Free.
3. Tap **Create new project** and wait a minute or two while it sets up.

## 2. Set up the database

1. In the left menu, open **SQL Editor**.
2. Open [supabase/setup.sql](../supabase/setup.sql) in this repo, tap the copy button (or select all of it) and copy it.
3. Paste it into the SQL Editor and tap **Run**. It should say **Success. No rows returned**. It's safe to run again if you're unsure.

If Supabase shows a warning about "destructive operations", that's because the script removes and re-adds its own rules. Tap to run it anyway.

## 3. Let people sign up without a confirmation email

Supabase's free built-in email only sends to people on your Supabase team, and only 2 emails an hour ([Supabase docs](https://supabase.com/docs/guides/auth/auth-smtp)). So for now, turn email confirmation off:

1. Open **Authentication**, then **Sign In / Providers** (it may be called **Providers**).
2. Tap **Email**.
3. Turn **Confirm email** off, and tap **Save**.

The catch: "Forgot your password?" won't send emails yet. That needs a free email service hooked up later (step 6).

## 4. Copy two things and send them back

1. Tap the **Connect** button at the top of the project page.
2. Copy the **Project URL**. It looks like `https://abcdefghijkl.supabase.co`.
3. Copy the **Publishable key**. It starts with `sb_publishable_`. If you only see an **anon** key (a long string starting with `eyJ`), that works too.

Send both in the chat. **Both are safe to share and are meant to be public:** they go inside the app, which anyone can download. The database rules from step 2 are what keep everyone's data private.

**Never send** the **secret** key (starts with `sb_secret_`), the **service_role** key, or the database password. Those can read and delete everything.

## 5. Test it together

Once the two values are in the app:

1. Open the app on your phone, go to **Profile** and tap **Make an account**.
2. Log a catch. Profile should say **All catches saved to your account**.
3. On a second phone or computer, log in. Your catch should appear.
4. Make a second account there (with a different email), and add your first account as a friend from the **Friends** tab.

## 6. Later: password reset emails (optional)

To make "Forgot your password?" work, Supabase needs your own email-sending service. Supabase lists free options in its [custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp). Also set **Authentication → URL Configuration → Site URL** to `https://mindchips1234.github.io/Creeked-up/` so reset links come back to the app.

## What the free plan gives you

From [supabase.com/pricing](https://supabase.com/pricing), checked October 24, 2026:

| | Free plan |
|---|---|
| Database | 500 MB |
| Photo storage | 1 GB (about 5,000 to 10,000 catch photos at the app's size) |
| Data sent out | 5 GB a month |
| Monthly active users | 50,000 |
| Projects | 2 |
| **Pausing** | **The project pauses after 1 week with no activity.** |

If it pauses, the app can't sync until you open the Supabase dashboard and tap **Restore project**. Nothing is lost, and the app keeps working offline on everyone's phones in the meantime. Once people use the app every week, it won't pause.

## Why Supabase and not Firebase

Both have free plans. Supabase was picked because:

- **Photos are free.** Firebase now needs its paid Blaze plan (a credit card on file) to store any files at all, including photos ([Firebase FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)).
- **Privacy rules live in the database.** Supabase can hand friends a fixed list of safe fields, so exact locations and notes never leave the database. Firebase's rules work on whole records, so locations would need to be split into separate records to stay private.
- **A Canadian region** is offered.

Firebase's downsides don't make it a bad choice: it doesn't pause, and its free plan allows 1 GB of data and 50,000 reads a day ([firebase.google.com/pricing](https://firebase.google.com/pricing)).
