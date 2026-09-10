# CityFlow AI — Step-by-step setup (Phase 1)

This guide assumes you have never done this before. Follow it **top to bottom**.
Every command is written exactly as you should type it.

Everything used here is **free forever**. No credit card is needed at any point.

---

## What you need before starting

| Thing | How to check | If you don't have it |
|---|---|---|
| **Node.js 18 or newer** | In Terminal type `node -v` | Download the "LTS" version from <https://nodejs.org> and install it |
| **VS Code** | It's the app you code in | Download from <https://code.visualstudio.com> |
| **A GitHub account** | You already have one: `shreyagoyal9` | — |

---

## STEP 1 — Open the project in VS Code

1. Open **VS Code**.
2. Top menu → **File** → **Open Folder…**
3. Choose the folder: `projects` → `cityflow-ai` → `cityflow-ai`
4. Click **Open**.
5. If VS Code asks *"Do you trust the authors of the files in this folder?"* → click **Yes, I trust the authors**.

You should now see a file list on the left containing `web`, `docs` and `README.md`.

---

## STEP 2 — Open the Terminal inside VS Code

1. Top menu → **Terminal** → **New Terminal**.
2. A black/white panel opens at the bottom. This is where you type commands.

**Type this and press Enter:**

```bash
cd web
```

> `cd web` means "go into the web folder". All the app code lives there.

---

## STEP 3 — Install the packages

**Type this and press Enter:**

```bash
npm install
```

This downloads everything the app needs. It takes **1–3 minutes**. You will see a
lot of text scroll past — that is normal.

✅ **Success looks like:** a line similar to `added 380 packages in 45s`, and you get
your typing cursor back.

❌ **If you see red `ERR!` lines:** copy the last 15 lines and send them to me.

---

## STEP 4 — Create your free database on Neon

CityFlow AI stores accounts in a PostgreSQL database. We use **Neon**, which has a
free plan that never expires.

1. Open <https://neon.com> in your browser.
2. Click **Sign up**.
3. Click **Continue with GitHub** (easiest — it uses your `shreyagoyal9` account).
4. Authorise it when GitHub asks.
5. On the "Create project" screen:
   - **Project name:** type `cityflow-ai`
   - **Postgres version:** leave as it is
   - **Region:** pick the one closest to India (usually `AWS ap-southeast-1 (Singapore)`)
6. Click **Create project**.

You now land on a page showing a **connection string**. It looks like this:

```
postgresql://neondb_owner:AbCd1234@ep-cool-name-12345-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

7. Make sure the toggle above it says **Pooled connection** (if you see that option).
8. Click the **copy** icon next to it. **Keep this — you need it in the next step.**

> 💡 If you lose it later: Neon dashboard → your project → **Connect** button → copy again.

---

## STEP 5 — Create your secret settings file

Back in **VS Code**:

1. In the left file list, find the `web` folder and click the little arrow to open it.
2. Find the file called **`.env.example`**.
3. Right-click it → **Copy**.
4. Right-click on the `web` folder → **Paste**. A file called `.env copy.example`
   or similar appears.
5. Right-click that new file → **Rename** → type exactly:

```
.env
```

   and press Enter.

> ⚠️ The name must start with a dot and be exactly `.env`.
> VS Code may show it in a faded colour — that's correct, it means Git will ignore it.

6. Click on `.env` to open it.

### 5a. Paste your database link

Find this line:

```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
```

Replace **everything between the quotes** with the Neon connection string you copied.
It should end up looking like:

```
DATABASE_URL="postgresql://neondb_owner:AbCd1234@ep-cool-name-12345-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

### 5b. Create your secret key

Go back to the **Terminal** in VS Code and type:

```bash
openssl rand -base64 48
```

Press Enter. It prints a long random string like:

```
kJ8f2Lm9QpXw3ZvR7nT5yH1bG4dC6sA0eU2iO8pL5mN3qW7xY9zB1vK4jF6hD8gS
```

Copy that whole line. In `.env`, find:

```
AUTH_SECRET="replace-with-a-long-random-string-at-least-32-characters"
```

and replace the text between the quotes with your random string.

### 5c. Save

Press **Cmd + S** to save the file.

---

## STEP 6 — Create the database tables

In the Terminal (still inside the `web` folder), type:

```bash
npm run db:push
```

✅ **Success looks like:** `Your database is now in sync with your Prisma schema.`

❌ **If it says it cannot reach the database:** your `DATABASE_URL` is wrong.
Go back to Step 5a and check you copied the whole line, including `?sslmode=require`.

---

## STEP 7 — Start the website

In the Terminal, type:

```bash
npm run dev
```

✅ **Success looks like:**

```
▲ Next.js 15.5.24
- Local: http://localhost:3000
✓ Ready in 2.1s
```

Now open your browser and go to:

**<http://localhost:3000>**

You should see the CityFlow AI landing page. 🎉

> To stop the server later: click in the Terminal and press **Control + C**.

---

## STEP 8 — Test that everything works

Go through this checklist in the browser:

- [ ] The landing page loads and shows "Smarter Departures, Smoother Journeys"
- [ ] Click the **sun/moon button** in the header → the whole site switches between light and dark
- [ ] Click the **city name** (top right) → search "bangalore" → pick **Bengaluru** → the background drawing changes
- [ ] Make the browser window narrow (or open on your phone) → the menu becomes a ☰ button
- [ ] Visit <http://localhost:3000/api/health> → you should see `"database": "connected"`
- [ ] Click **Get Started** → create an account with any email + a password like `cityflow123`
- [ ] After signing up you land on a page showing **Your CityFlow ID** like `CF-8X42K91`
- [ ] Click **Continue to my dashboard**
- [ ] Click **Sign out**, then **Log in** with the same email and password

If any step fails, tell me **which step number** and what you saw.

---

## STEP 9 — Save your work to GitHub

In the Terminal, first go back up one folder:

```bash
cd ..
```

Then run these **one at a time**:

```bash
git add .
```

```bash
git commit -m "Phase 1: CityFlow AI foundation, design system, landing page and authentication"
```

```bash
git push origin main
```

If GitHub asks for a username and password:
- **Username:** `shreyagoyal9`
- **Password:** this must be a **Personal Access Token**, not your real password.
  Create one at <https://github.com/settings/tokens> → **Generate new token (classic)**
  → tick the **repo** checkbox → **Generate token** → copy it and paste it as the password.

> 💡 Easier alternative: install **GitHub Desktop** from <https://desktop.github.com>
> and click "Commit" then "Push origin". Same result, no tokens.

---

## STEP 10 — Put it online for free (Vercel)

Do this once. After that, every `git push` updates your live site automatically.

1. Go to <https://vercel.com>.
2. Click **Sign Up** → **Continue with GitHub** → authorise.
3. On your Vercel dashboard click **Add New…** → **Project**.
4. Find `cityflow-ai` in the list → click **Import**.
5. **IMPORTANT — Root Directory:** click **Edit** next to "Root Directory" and choose the
   **`web`** folder. (Our Next.js app lives inside `web`, not at the top.)
6. Open the **Environment Variables** section and add two variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | paste the same Neon string from Step 5a |
   | `AUTH_SECRET` | paste the same random string from Step 5b |

7. Click **Deploy**.
8. Wait 1–3 minutes. You will get a live link like `https://cityflow-ai.vercel.app`.

✅ Your project is now live on the internet, on a free plan that stays free.

> After deploying, go to Vercel → your project → **Settings** → **Environment Variables**
> and add one more: `NEXT_PUBLIC_APP_URL` = your live link. Then click **Redeploy**.

---

## Commands you will use again and again

| What you want | Command (run inside the `web` folder) |
|---|---|
| Start the site locally | `npm run dev` |
| Stop the site | Press `Control + C` in the Terminal |
| Check for code errors | `npm run typecheck` |
| Update database tables after a schema change | `npm run db:push` |
| Browse the database in a UI | `npm run db:studio` |

---

## If something breaks

1. Stop the server (`Control + C`).
2. Run `npm run dev` again.
3. Still broken? Copy the **full red error message** and send it to me — including
   which step you were on.
