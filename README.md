# Invoices – IT Bulgaria

A browser app for issuing invoices. The invoices are kept in one encrypted file in Google Drive
(`it-bulgaria-invoices.enc.json`) that is shared between the people who issue them. Each person signs in with
their Google account and then unlocks the file with their own password.

## Running it

The app is published with GitHub Pages at <https://smashsmashin.github.io/invoices/> (see
[Publishing on GitHub Pages](#publishing-on-github-pages)).

The page has to be opened over `http://` or `https://`. Google sign-in does not work when `index.html` is
opened straight from disk (`file://`).

To run it on your own computer, from this folder:

```sh
python3 -m http.server 8000
```

then open <http://localhost:8000>.

## Publishing on GitHub Pages

GitHub Pages serves the files of this repository as they are, so there is nothing to build. Do this before the
Google setup below, which needs the site's address.

1. **Decide on the repository's visibility.** Pages is free for public repositories; a private repository needs
   a paid GitHub plan (Pro, Team or Enterprise). In a public repository everyone can read the code, including
   `js/config.js` with the company details and the Google client ID and API key. That is acceptable: those are
   printed on every invoice or visible to every browser anyway, and the invoices themselves are never in the
   repository – they live encrypted in Google Drive.
2. **Jekyll processing is off:** the empty `.nojekyll` file in the repository root tells GitHub to serve every
   file unchanged instead of running it through the Jekyll site generator. Keep that file.

3. On GitHub open the repository, then **Settings → Pages**. Under **Build and deployment**:
   - **Source**: *Deploy from a branch*
   - **Branch**: `main`, folder `/ (root)`, then **Save**.
4. Wait for the **pages build and deployment** run on the **Actions** tab to finish (a minute or two). The site
   is then at <https://smashsmashin.github.io/invoices/>. Leave **Enforce HTTPS** ticked.
5. Add the site to Google: the origin `https://smashsmashin.github.io` in step 4 and the website
   `https://smashsmashin.github.io/invoices/*` in step 5 of [Setting up Google](#setting-up-google-one-time).

**Updating the site:** every push to `main` publishes again. GitHub caches the files for about 10 minutes, so
after an update reload the page with Ctrl+Shift+R.

**Own domain (optional):** under **Settings → Pages → Custom domain** enter e.g. `invoices.example.com` and
create the DNS record GitHub shows. Then use that address in Google instead (steps 3–5), and add the domain under
**Authorized domains** in step 3.

## Setting up Google (one time)

The app needs three values from a Google Cloud project, all of which go into `GOOGLE` in `js/config.js`:

| Value in `js/config.js` | What it is                        | Where it comes from |
|-------------------------|-----------------------------------|---------------------|
| `client_id`             | OAuth client ID (Google sign-in)  | step 4              |
| `api_key`               | API key for the Google Picker     | step 5              |
| `project_number`        | The Cloud project's number        | step 1              |

The addresses below are for GitHub Pages and for running the app locally. Note the difference between the
two kinds of address: a sign-in *origin* (step 4) is only scheme, host and port – `https://smashsmashin.github.io`,
without `/invoices` – while the API key's *website* (step 5) includes the path.

Google renames console menus from time to time; if a name below does not match, use the search box at the top
of the console.

### 1. Create a project

1. Open <https://console.cloud.google.com> and sign in with the Google account that will manage the app.
2. In the project picker at the top, choose **New project**, name it `IT Bulgaria Invoices` and create it.
3. Make sure the new project is selected. On the project's **Dashboard** (or **IAM & Admin → Settings**), copy
   the **Project number** – this is `project_number`.

### 2. Enable the APIs

**APIs & Services → Library**, then search for and **Enable** each of:

- **Google Drive API** – reading and saving the invoices file
- **Google Picker API** – the "choose the file from Google Drive" window

### 3. Configure the consent screen

Open **Google Auth Platform** (also reachable as **APIs & Services → OAuth consent screen**) and click
**Get started** if asked.

1. **Branding**: app name `IT Bulgaria Invoices`, a user support email and a developer contact email.
   If the app is hosted on your own domain, add that domain under **Authorized domains**.
2. **Audience**: choose **External** (people sign in with ordinary Google accounts). If everyone is in one
   Google Workspace organisation, **Internal** also works and limits sign-in to that organisation.
3. **Data access → Add or remove scopes**, add these two and save:
   - `https://www.googleapis.com/auth/drive.file` – only the files this app creates or the user picks with it
   - `https://www.googleapis.com/auth/userinfo.email` – the signed-in user's email address

   Both are non-sensitive scopes, so the app does not need Google's verification.
4. Back on **Audience**, decide who may sign in:
   - **Publish app** (status *In production*): anyone with the shared file and a password can sign in. Recommended.
   - Or keep it in **Testing** and add every person's Google email under **Test users**. Then each new person
     added in the app (see [Adding people](#adding-people)) must also be added here, or Google refuses their
     sign-in with "access blocked".

### 4. Create the OAuth client (`client_id`)

1. **Google Auth Platform → Clients → Create client** (or **APIs & Services → Credentials → Create
   credentials → OAuth client ID**).
2. **Application type**: *Web application*, name: `Invoices web`.
3. **Authorized JavaScript origins** – add every address the app is opened from:
   - `http://localhost:8000`
   - `https://smashsmashin.github.io`

   No path and no trailing slash. **Authorized redirect URIs** stay empty: sign-in happens in a popup.
4. Create it and copy the **Client ID** (ends in `.apps.googleusercontent.com`) – this is `client_id`.

A change to the origins can take from a few minutes to a few hours to start working.

### 5. Create the API key for the Picker (`api_key`)

1. **APIs & Services → Credentials → Create credentials → API key**, then open the new key to edit it.
2. **Application restrictions**: *Websites*, and add:
   - `http://localhost:8000/*`
   - `https://smashsmashin.github.io/invoices/*`
3. **API restrictions**: *Restrict key* and tick only **Google Picker API**.
4. Save and copy the key – this is `api_key`.

### 6. Put the values into `js/config.js`

```js
const GOOGLE = {
  client_id: '….apps.googleusercontent.com',
  api_key: 'AIza…',
  project_number: '…',
  scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'
};
```

Leave `scopes` as it is. None of these values is a secret: every browser that opens the app sees them. What
protects them is the list of origins (step 4) and websites (step 5), so keep those lists to your own addresses.

### 7. First sign-in: create the invoices file

The first person does this once:

1. Open the app and click **Вход с Google**; choose the account and allow everything Google asks for (leave all
   boxes ticked).
2. On the next screen click **Създайте нов файл с фактури**, choose a password (at least 10 characters) and
   click **Създай**.

This creates `it-bulgaria-invoices.enc.json` in that person's Google Drive. Invoices that this browser kept
from the version before Google Drive are moved into the new file.

**If every person with access forgets their password, the invoices cannot be recovered.** Keep backups with the
**Export** button.

## Adding people

1. Someone who already has access opens **Достъп**, enters the new person's Google email and a temporary
   password, and clicks **Добави**. The app shares the file with that account and Google emails them about it.
2. Give them the temporary password some other way (phone, message) – not in the same email.
3. They open the app, click **Вход с Google**, then **Избери файла** and pick `it-bulgaria-invoices.enc.json`
   (under *Shared with me*). This is needed only once per Google account.
4. They enter the temporary password and then set their own.

If the app is in **Testing** (step 3), also add them as a test user first.

A person who forgot their password gets a new temporary one the same way – someone with access adds their
email again.

## Troubleshooting

| Problem | Cause and fix |
|---------|---------------|
| Google shows **Error 400: origin_mismatch** | The address in the browser is not in **Authorized JavaScript origins** (step 4). It must match exactly, including `http`/`https` and the port – and without a path, so `https://smashsmashin.github.io`, not `…/invoices`. |
| The GitHub Pages site shows **404** | Pages is not switched on for `main` / root (see [Publishing on GitHub Pages](#publishing-on-github-pages)), or the deployment on the **Actions** tab has not finished or failed. |
| An update does not show up on the site | GitHub caches the files for about 10 minutes; reload with Ctrl+Shift+R. |
| Google shows **Access blocked** / **403: access_denied** | The app is in **Testing** and this account is not a test user (step 3). |
| The file picker says the **API developer key is invalid** | The API key does not allow this website or the Picker API (step 5), or the Picker API is not enabled (step 2). |
| "Не е разрешен достъпът до Google Drive…" | A permission box was unticked on Google's consent screen. Sign in again and leave all boxes ticked. |
| "Файлът не е достъпен за …" | The file was not picked with this Google account, or is not shared with it. Pick it again with **Избери файла**, or ask to be added under **Достъп**. |
| Nothing happens on **Вход с Google** | The browser blocked the popup – allow popups for the site. Also check the page is not opened as `file://`. |
