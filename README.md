# fenilpshah.com: one site, one backend, one admin

```
site/                    → upload to Netlify (this is the whole website)
  index.html             /            Home
  about/ philosophy/ work/ writing/ now/
  book/                  /book        booking page
  book/availability/     /book/availability
  book/feedback/         /book/feedback
  iq/                    /iq          proctored IQ assessment
  otlo/                  /otlo        ઓટલો · Otlo  (articles open at /otlo/#/p/<slug>)
  greetings/             /greetings   landing page
  g/                     /g/<code>    every sorry / birthday / letter link
  admin/                 /admin       ONE admin: Overview, Bookings, Mail, Greetings, IQ, Otlo
  config.js              ← the only file to edit on the website (your /exec URL)
  _redirects             old page names and old subdomains → new paths
apps-script/
  Code.gs                ONE Apps Script project for book + iq + otlo + greet + admin
  appsscript.json        manifest (timezone, Calendar API, web-app access)
```

Your data stays in your four existing Google Sheets; nothing is copied or moved.
The script opens each Sheet by its ID. Each app keeps its own private settings, cache and
triggers inside the one project (prefixed `BOOK.`, `IQ.`, `OTLO.`, `GREET.`), so they never mix.

---

## 1 · Backend (about 15 minutes)

1. Create a **new, empty Google Sheet** called `fenilpshah.com — Control`.
   Extensions → Apps Script.
2. Project Settings ⚙ → tick **Show "appsscript.json"**. Replace its contents with `apps-script/appsscript.json`.
3. Replace `Code.gs` with `apps-script/Code.gs`.
4. At the top of `Code.gs`, fill in `FPS.SHEETS` with the 4 Sheet IDs. The ID is the long part of each Sheet's URL: `docs.google.com/spreadsheets/d/`**`<ID>`**`/edit`.
5. **Deploy → New deployment → Web app** · Execute as **Me** · Who has access **Anyone**. Approve the permissions.
   Copy the URL (ends in `/exec`) and paste it into `FPS.EXEC` in `Code.gs`. Save.
   Then go to Deploy → Manage deployments → ✎ → Version: **New version** → Deploy.
   *(Do this "new version" step after every code change. The URL stays the same.)*
6. **Bring over your old private settings**, so you don't have to reconnect Zoho or reset your password.
   In **each of the 4 old** Apps Script projects, add and run:
   ```js
   function exportForFenil(){ Logger.log(JSON.stringify(PropertiesService.getScriptProperties().getProperties())); }
   ```
   Reload the Control sheet → **🌐 fenilpshah.com → 1. Import settings from old scripts**.
   This creates an `Import` tab. Paste each log line next to its app (book / iq / otlo / greet), then run the menu item again.
   The pasted text is wiped from the sheet once it's imported.
7. **🌐 fenilpshah.com → 2. Set up everything.** This installs the background jobs: IQ sweep every 5 min, booking reminders hourly, and the greetings/Otlo auto-fill when you edit those Sheets.
   It also rewrites the stored links to the new site:
   - booking page and feedback URLs
   - every greeting link (now `fenilpshah.com/g/<code>`)
   - Otlo `site_url` and `api_url`
8. **Switch the old scripts off.** This step is important: otherwise reminders and IQ sweeps run twice.
   In each old project: Triggers ⏰ → delete every trigger. You can then delete the old code, or leave it.

All the old sheet menus (Fenil Book, IQ Test, Otlo, 💌 Greeting Site) now appear in the Control sheet.
The few items that worked on a *selected row* are in /admin instead:
- confirm/cancel booking → Bookings
- send link by email → Greetings → Email it
- "make page codes" and "page help" are gone: Google Sites embeds aren't needed any more.

## 2 · Website on Netlify (about 10 minutes)

1. Open `site/config.js` and paste your `/exec` URL:
   ```js
   window.FPS = { API: 'https://script.google.com/macros/s/AKfy…/exec' };
   ```
2. app.netlify.com → **Add new site → Deploy manually**, then drag the `site` folder in.
   (Or push the folder to GitHub and connect the repo, so future edits deploy automatically.)
3. Domain management → **Add domain** `fenilpshah.com`.
   Then remove the custom URL from the old Google Site, and change the DNS at your registrar to Netlify's records. Netlify shows you exactly which ones.
4. **Old links keep working.** Add these as domain aliases in Netlify and point their DNS at Netlify; `_redirects` sends them to the new paths:
   `otlo.` `amd.` `iq.` `appointment.` `sorry.` `birthday.` `greetings.` (with and without `www.`).
   A greeting link someone already has, like `sorry.fenilpshah.com/riya-7q2m`, opens `fenilpshah.com/g/riya-7q2m`.
5. **Keep `book.fenilpshah.com` on Google Sites for now.** The Fenil Meet room page (`/meet`) wasn't in the files.
   When you find it, send it over. Once it's at `/book/meet`, uncomment the book lines in `_redirects`.

## 3 · Check it

| Open | You should see |
|---|---|
| `<exec>` | `{"ok":true,…,"services":["book","iq","otlo","greet","admin"]}` |
| `/admin` | Sign in with your **booking owner password** → Overview shows all four apps |
| `/book` | Free slots load |
| `/g/<a real code>` | That person's greeting |
| `/otlo` | Your posts (not the sample content) |
| `/iq` | Login screen; a test student can sign in |

## Notes

- **Rotate the Greetings Zoho client secret.** It was written directly in the old Greetings script.
  The new code doesn't contain it; it's read from the imported settings instead.
  In Zoho API Console, generate a new secret, then run 💌 Greeting Site → Connect Zoho Mail once.
- The admin session lasts 6 hours. Signing out of one tab signs you out of all of them.
- The IQ test no longer needs "open in a new tab", because it isn't inside a Google Sites embed any more.
- GitHub Pages also works (`404.html` handles `/g/<code>`), but the old-subdomain redirects need Netlify.
