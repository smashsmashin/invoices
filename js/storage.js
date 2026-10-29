// The invoices live in an encrypted file in Google Drive (see crypto.js, drive.js); this page keeps
// them only in memory. One person edits at a time: an edit lock in the file's properties says who,
// the others get a read-only view. JSON files remain for manual backups.

// the data of the version before Google Drive, kept by the browser on each computer
const LEGACY_STORAGE_NAME = 'IT-Bulgaria Invoices1';

// which Google account and file this computer used last (nothing secret)
const LAST_LOGIN_NAME = 'IT-Bulgaria Invoices login';

const LOCK_MINUTES = 10;

const LOCK_RENEW_MINUTES = 3;

class ConflictError extends Error {}

var session = {
  email: null,
  password: null,
  file_id: null,
  store: null,
  data_key: null,
  version: null,     // the Drive file version this page has loaded or written
  invoices_json: '[]',
  readonly: true,
  lock_by: null,
  saves_pending: 0,
  unsaved: false,    // changes not yet in Google Drive
  error: null        // SignInNeededError or another error from the last Drive request
};

var sync_queue = Promise.resolve();

// Drive requests that check the file and then change it run one after another,
// so each one sees the version the previous one wrote
function in_turn(task) {
  var run = sync_queue.then(task);
  sync_queue = run.catch(() => {});
  return run;
}

function sort_invoices_desc(data) {
  data.invoices.sort(function(a, b) {
    return b.number - a.number;
  });
}

// a fresh copy, so edits in the form do not change the saved invoices until they are saved
function load_invoices() {
  var data = {invoices: JSON.parse(session.invoices_json)};
  sort_invoices_desc(data);
  return data;
}

function store_invoices(data) {
  session.invoices_json = JSON.stringify(data.invoices);
  session.unsaved = true;
  save_store();
}

function legacy_invoices() {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_STORAGE_NAME))?.invoices || [];
  } catch(e) {
    return [];
  }
}

function remove_legacy_invoices() {
  localStorage.removeItem(LEGACY_STORAGE_NAME);
  localStorage.removeItem(LEGACY_STORAGE_NAME + ' last change');
  localStorage.removeItem(LEGACY_STORAGE_NAME + ' last export');
}

function last_login() {
  try {
    return JSON.parse(localStorage.getItem(LAST_LOGIN_NAME)) || {};
  } catch(e) {
    return {};
  }
}

function remember_login() {
  localStorage.setItem(LAST_LOGIN_NAME, JSON.stringify({email: session.email, file_id: session.file_id}));
}

// alerts and returns false when this page may not change the data
function can_edit() {
  if(session.readonly) {
    alert(session.lock_by
      ? 'Данните в момента се редактират от ' + session.lock_by + '. Можете само да ги разглеждате.'
      : 'Данните са само за четене. Опитайте отново от горната лента.');
    return false;
  }
  return true;
}

// reads the file again, keeping the data key: it changes only when someone is removed, which unlocks the file
async function reload_store() {
  var info = await drive_file_info(session.file_id);
  var store = parse_store(await read_drive_file(session.file_id));
  var data_key = session.data_key;
  var invoices;
  try {
    invoices = await decrypt_invoices(store, data_key);
  } catch(e) {
    data_key = await open_key_slot(store, session.email, session.password);
    invoices = await decrypt_invoices(store, data_key);
  }
  session.store = store;
  session.data_key = data_key;
  session.version = info.version;
  session.invoices_json = JSON.stringify(invoices);
}

function lock_holder(properties) {
  return properties.lock_by && parseInt(properties.lock_until) > Date.now() ? properties.lock_by : null;
}

// takes the lock if it is free, reloading first when someone else saved meanwhile.
// Two computers may write the lock at the same moment; after a pause both read back the same winner.
async function acquire_lock() {
  var info = await drive_file_info(session.file_id);
  var holder = lock_holder(info.appProperties);
  if(holder && holder != session.email) {
    session.readonly = true;
    session.lock_by = holder;
    if(info.version != session.version)
      await reload_store();
    return false;
  }
  if(info.version != session.version)
    await reload_store();
  await set_drive_file_properties(session.file_id, {lock_by: session.email, lock_until: String(Date.now() + LOCK_MINUTES * 60000)});
  await new Promise((resolve) => setTimeout(resolve, 1500));
  info = await drive_file_info(session.file_id);
  holder = lock_holder(info.appProperties);
  session.version = info.version;
  session.readonly = holder != session.email;
  session.lock_by = session.readonly ? holder : null;
  return !session.readonly;
}

// renews the lock while the page is visible; a page in the background lets it expire, so a forgotten
// window does not keep the others out. When it comes back, it re-checks and reloads if needed.
function refresh_session() {
  if(!session.file_id)
    return;
  return in_turn(async () => {
    var invoices_before = session.invoices_json;
    try {
      var info = await drive_file_info(session.file_id);
      if(!session.readonly && info.version == session.version && info.appProperties.lock_by == session.email) {
        var result = await set_drive_file_properties(session.file_id, {lock_by: session.email, lock_until: String(Date.now() + LOCK_MINUTES * 60000)});
        session.version = result.version;
        // a save that failed earlier, e.g. while the Google sign-in had expired
        if(session.unsaved)
          save_store();
      } else if(session.unsaved) {
        await handle_conflict();
      } else {
        session.readonly = true;
        await acquire_lock();
      }
      session.error = null;
    } catch(e) {
      session.error = e;
    }
    if(session.invoices_json != invoices_before)
      show_reloaded_data();
    else
      render_header(data);
  });
}

// best effort while the page closes; if it does not get through, the lock expires by itself
function release_lock() {
  if(session.readonly || !session.file_id || !google_signed_in())
    return;
  session.readonly = true;
  set_drive_file_properties(session.file_id, {lock_by: '', lock_until: '0'}, true).catch(() => {});
}

function show_reloaded_data() {
  var number = data.current?.number;
  data = load_invoices();
  data.current = data.invoices.find((inv) => inv.number == number);
  parse_invoices(data);
  if(data.current)
    mark_selected_invoice(data.current.number);
}

// re-encrypts and uploads the store; called after every change of the invoices or the key slots.
// Resolves to whether this save reached Google Drive.
function save_store() {
  session.saves_pending++;
  render_header(data);
  return in_turn(async () => {
    try {
      // after a conflict the page is read-only, and saves queued before it have nothing to add
      if(session.readonly)
        return false;
      var info = await drive_file_info(session.file_id);
      if(info.version != session.version || info.appProperties.lock_by != session.email)
        throw new ConflictError();
      await encrypt_invoices(session.store, session.data_key, JSON.parse(session.invoices_json));
      session.version = await write_drive_file(session.file_id, JSON.stringify(session.store));
      session.error = null;
      if(session.saves_pending == 1)
        session.unsaved = false;
      return true;
    } catch(e) {
      if(e instanceof ConflictError)
        await handle_conflict();
      else
        session.error = e;
      return false;
    } finally {
      session.saves_pending--;
      render_header(data);
    }
  });
}

// someone else saved or took the lock: never overwrite their data, hand ours over as a file instead
async function handle_conflict() {
  export_data(load_invoices());
  alert('Данните в Google Drive са били променени от друг компютър, затова вашите последни промени НЕ са записани там.\n\n'
    + 'Те са изтеглени като архивен файл - след като данните се презаредят, сравнете и ако трябва въведете промените отново.');
  session.readonly = true;
  session.unsaved = false;
  try {
    await reload_store();
    await acquire_lock();
    session.error = null;
  } catch(e) {
    session.error = e;
  }
  show_reloaded_data();
}

// shown under the header
function sync_status() {
  if(session.saves_pending)
    return {text: 'Записване в Google Drive…'};
  if(session.error)
    return {
      text: (session.error instanceof SignInNeededError ? 'Връзката с Google изтече' : 'Грешка: ' + session.error.message)
        + (session.unsaved ? ' - промените НЕ са записани в Google Drive.' : '.'),
      action: session.error instanceof SignInNeededError ? 'Влезте отново' : 'Опитайте отново',
      problem: true
    };
  if(session.readonly)
    return {
      text: session.lock_by ? 'Само четене - в момента редактира ' + session.lock_by + '.' : 'Само за четене.',
      action: 'Проверете отново',
      problem: true
    };
  return {text: 'Записано в Google Drive'};
}

// the button in the status line; signing in again needs this click for Google's popup
async function sync_status_action() {
  try {
    if(!google_signed_in()) {
      await google_sign_in(session.email);
      if(await google_user_email() != session.email)
        throw new Error('Влезте със същия Google профил: ' + session.email);
    }
  } catch(e) {
    alert(e.message);
    return false;
  }
  if(session.unsaved && !session.readonly)
    save_store();
  else
    refresh_session();
  return false;
}

function start_sync_timers() {
  setInterval(() => {
    if(document.visibilityState == 'visible' && !session.readonly)
      refresh_session();
  }, LOCK_RENEW_MINUTES * 60000);

  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState == 'visible')
      refresh_session();
  });

  window.addEventListener('pagehide', release_lock);
}

// Downloads the saved invoices (not unsaved form edits) as a dated JSON file
function export_data(data) {
  var json = JSON.stringify({exported_at: new Date().toISOString(), invoices: data.invoices}, undefined, 2);
  var link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
  link.download = 'it-bulgaria-invoices-' + new Date().toLocaleDateString('sv-SE') + '.json'; // sv-SE gives YYYY-MM-DD
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function import_file(file) {
  if(!file || !session.file_id || !can_edit())
    return;

  var reader = new FileReader();
  reader.onload = function() {
    var obj;
    try {
      obj = JSON.parse(this.result);
    } catch(e) {
      alert('"' + file.name + '" не е валиден JSON файл: ' + e.message);
      return;
    }
    if(!obj || !Array.isArray(obj.invoices) || obj.invoices.some((inv) => !inv || inv.number == undefined)) {
      alert('"' + file.name + '" не съдържа фактури.');
      return;
    }
    if(!confirm('Да заменя ли текущите ' + data.invoices.length + ' фактури с ' + obj.invoices.length + ' от "' + file.name + '"?'
        + (data.invoices.length ? '\n\nПреди замяната текущите фактури ще бъдат изтеглени като архив.' : '')))
      return;

    // keep a file copy of what is about to be overwritten
    if(data.invoices.length)
      export_data(data);

    store_invoices({invoices: obj.invoices});
    data = load_invoices();
    parse_invoices(data);
  };
  reader.readAsText(file);
}

function enable_drop_import(targetEl) {
  // disable default drag & drop functionality
  targetEl.addEventListener('dragenter', function(e){ e.preventDefault(); });
  targetEl.addEventListener('dragover',  function(e){ e.preventDefault(); });

  targetEl.addEventListener('drop', function(event) {
    event.preventDefault();
    if(event.dataTransfer.files.length)
      import_file(event.dataTransfer.files[0]);
  });
}
