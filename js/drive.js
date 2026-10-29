// Google sign-in and the shared invoices file in Google Drive (Drive REST API v3 over fetch).
// The token comes from Google Identity Services and lives only in memory, for about an hour.

const DRIVE_FILE_NAME = 'it-bulgaria-invoices.enc.json';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

class SignInNeededError extends Error {}

var google_token = null;

function load_script(src) {
  return new Promise((resolve, reject) => {
    var script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Не може да се зареди ' + src));
    document.head.appendChild(script);
  });
}

async function load_google_libraries() {
  await Promise.all([load_script('https://accounts.google.com/gsi/client'), load_script('https://apis.google.com/js/api.js')]);
  await new Promise((resolve) => gapi.load('picker', resolve));
}

// set when the user unticked a permission on Google's consent screen, so the next sign-in shows it again
var google_consent_needed = false;

// must be called straight from a click: Google opens a popup, which browsers block otherwise
function google_sign_in(email_hint) {
  return new Promise((resolve, reject) => {
    var client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE.client_id,
      scope: GOOGLE.scopes,
      login_hint: email_hint || '',
      callback: (response) => {
        if(response.error)
          return reject(new Error(response.error_description || response.error));
        // Google lets the user untick each permission; without them every Drive request fails
        if(!google.accounts.oauth2.hasGrantedAllScopes(response, ...GOOGLE.scopes.split(' '))) {
          google_consent_needed = true;
          return reject(new Error('Не е разрешен достъпът до Google Drive. Влезте отново и в прозореца на Google отметнете всички отметки.'));
        }
        google_consent_needed = false;
        google_token = {access_token: response.access_token, expires_at: Date.now() + response.expires_in * 1000};
        resolve();
      },
      error_callback: (error) => reject(new Error(error.type == 'popup_closed' ? 'Входът беше прекъснат.' : error.message || error.type))
    });
    client.requestAccessToken({prompt: google_consent_needed ? 'consent' : email_hint ? '' : 'select_account'});
  });
}

function google_signed_in() {
  // a minute of margin, so a request does not start with a token about to expire
  return google_token && Date.now() < google_token.expires_at - 60000;
}

async function google_request(url, options) {
  if(!google_signed_in())
    throw new SignInNeededError('Връзката с Google изтече.');
  options = options || {};
  options.headers = Object.assign({Authorization: 'Bearer ' + google_token.access_token}, options.headers);
  var response = await fetch(url, options);
  if(response.status == 401) {
    google_token = null;
    throw new SignInNeededError('Връзката с Google изтече.');
  }
  if(!response.ok) {
    var message = response.status + ' ' + response.statusText;
    try {
      message = (await response.json()).error.message || message;
    } catch(e) {}
    var error = new Error('Google Drive: ' + message);
    error.status = response.status;
    throw error;
  }
  return response;
}

async function google_user_email() {
  var response = await google_request('https://www.googleapis.com/oauth2/v3/userinfo');
  return normalize_email((await response.json()).email);
}

// the Picker also grants this app access to the chosen file (drive.file scope), so it is needed once per Google account
function pick_drive_file() {
  return new Promise((resolve) => {
    var shared = new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes('application/json').setOwnedByMe(false);
    var mine = new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes('application/json').setOwnedByMe(true);
    new google.picker.PickerBuilder()
      .setTitle('Изберете файла с фактурите (' + DRIVE_FILE_NAME + ')')
      .addView(shared)
      .addView(mine)
      .setOAuthToken(google_token.access_token)
      .setDeveloperKey(GOOGLE.api_key)
      .setAppId(GOOGLE.project_number)
      .setCallback((result) => {
        if(result.action == google.picker.Action.PICKED)
          resolve(result.docs[0].id);
        else if(result.action == google.picker.Action.CANCEL)
          resolve(null);
      })
      .build()
      .setVisible(true);
  });
}

// version grows with every change of the file, its content or its properties (the lock)
async function drive_file_info(file_id) {
  var response = await google_request(DRIVE_API + '/' + file_id + '?fields=version,appProperties');
  var info = await response.json();
  info.appProperties = info.appProperties || {};
  return info;
}

async function read_drive_file(file_id) {
  return (await google_request(DRIVE_API + '/' + file_id + '?alt=media')).text();
}

async function write_drive_file(file_id, text) {
  var response = await google_request(DRIVE_UPLOAD + '/' + file_id + '?uploadType=media&fields=version', {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: text
  });
  return (await response.json()).version;
}

async function create_drive_file(text) {
  var boundary = 'invoices' + Date.now();
  var body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'
    + JSON.stringify({name: DRIVE_FILE_NAME, mimeType: 'application/json'})
    + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n'
    + text
    + '\r\n--' + boundary + '--';
  var response = await google_request(DRIVE_UPLOAD + '?uploadType=multipart&fields=id,version', {
    method: 'POST',
    headers: {'Content-Type': 'multipart/related; boundary=' + boundary},
    body: body
  });
  return response.json();
}

// appProperties values must be strings; keepalive lets the request finish while the page closes
async function set_drive_file_properties(file_id, properties, keepalive) {
  var response = await google_request(DRIVE_API + '/' + file_id + '?fields=version,appProperties', {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({appProperties: properties}),
    keepalive: !!keepalive
  });
  return response.json();
}

function share_drive_file(file_id, email) {
  return google_request(DRIVE_API + '/' + file_id + '/permissions?sendNotificationEmail=true', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({type: 'user', role: 'writer', emailAddress: email})
  });
}

async function unshare_drive_file(file_id, email) {
  var response = await google_request(DRIVE_API + '/' + file_id + '/permissions?fields=permissions(id,emailAddress,role)');
  var permissions = ((await response.json()).permissions || []).filter((permission) => normalize_email(permission.emailAddress || '') == email);
  if(permissions.some((permission) => permission.role == 'owner'))
    throw new Error(email + ' е собственик на файла');
  for(var permission of permissions)
    await google_request(DRIVE_API + '/' + file_id + '/permissions/' + permission.id, {method: 'DELETE'});
}
