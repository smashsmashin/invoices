// The login screen (Google account, then the shared file, then the password) and the "Access" dialog
// where users add or remove people and change their own password.

const MIN_PASSWORD_LENGTH = 10;

var login = {step: 'loading', error: null, busy: false};

var login_parse_fn = doT.template(document.getElementById('login_tmpl').innerHTML);
var people_parse_fn = doT.template(document.getElementById('people_tmpl').innerHTML);

function render_login() {
  document.getElementById('login').innerHTML = login_parse_fn(login);
  var input = document.querySelector('#login input[type="password"]');
  if(input)
    input.focus();
}

function show_login_step(step, error) {
  login.step = step;
  login.error = error || null;
  login.busy = false;
  render_login();
}

// runs a step's work with the buttons disabled; an error is shown on the same step
async function login_busy(work) {
  login.busy = true;
  login.error = null;
  render_login();
  try {
    await work();
  } catch(e) {
    login.busy = false;
    login.error = e instanceof WrongPasswordError ? 'Грешна парола.' : e.message;
    render_login();
  }
}

function password_problem(password, repeat) {
  if(password.length < MIN_PASSWORD_LENGTH)
    return 'Паролата трябва да е поне ' + MIN_PASSWORD_LENGTH + ' знака.';
  if(password != repeat)
    return 'Двете пароли не съвпадат.';
  return null;
}

async function start_login() {
  render_login();
  try {
    await load_google_libraries();
  } catch(e) {
    show_login_step('loading', e.message + ' Проверете връзката с интернет и презаредете страницата.');
    return;
  }
  show_login_step('google');
}

// not inside login_busy: the Google popup has to open within the click
function login_with_google() {
  var last = last_login();
  login.error = null;
  // no email hint: Google then shows its account chooser, instead of quietly using the browser's default account
  google_sign_in().then(() => login_busy(async () => {
    session.email = await google_user_email();
    if(last.file_id && last.email == session.email)
      await open_store_file(last.file_id);
    else
      show_login_step('file');
  }), (e) => show_login_step('google', e.message));
  return false;
}

function choose_store_file() {
  pick_drive_file().then((file_id) => {
    if(file_id)
      login_busy(() => open_store_file(file_id));
  });
  return false;
}

async function open_store_file(file_id) {
  var info, store;
  try {
    info = await drive_file_info(file_id);
    store = parse_store(await read_drive_file(file_id));
  } catch(e) {
    if(e.status == 403 || e.status == 404)
      return show_login_step('file', 'Файлът не е достъпен за ' + session.email + '. Изберете го отново от Google Drive.');
    if(e instanceof SyntaxError || e.message == 'Not an invoices store file')
      return show_login_step('file', 'Този файл не е файл с фактури.');
    throw e;
  }
  if(!has_key_slot(store, session.email))
    return show_login_step('file', session.email + ' няма достъп до този файл. Помолете някой с достъп да ви добави (бутон "Достъп").');
  session.file_id = file_id;
  session.store = store;
  session.version = info.version;
  show_login_step('password');
}

function submit_password(form) {
  login_busy(async () => {
    var data_key = await open_key_slot(session.store, session.email, form.password.value);
    session.invoices_json = JSON.stringify(await decrypt_invoices(session.store, data_key));
    session.data_key = data_key;
    session.password = form.password.value;
    if(session.store.keys[session.email].temp)
      show_login_step('new_password');
    else
      await finish_login();
  });
  return false;
}

// the first login with a temporary password given by another user
function submit_new_password(form) {
  var problem = password_problem(form.password.value, form.repeat.value);
  if(problem)
    return show_login_step('new_password', problem), false;
  login_busy(async () => {
    await finish_login();
    if(session.readonly) {
      alert('Паролата не е сменена, защото в момента данните се редактират от ' + session.lock_by + '. Ще бъдете помолени отново при следващия вход.');
      return;
    }
    if(await save_key_change(() => set_key_slot(session.store, session.email, form.password.value, session.data_key)))
      session.password = form.password.value;
    else
      alert('Паролата не е сменена - неуспешно записване в Google Drive.');
  });
  return false;
}

// starts the shared file from the invoices this browser kept before Google Drive
function create_store_file(form) {
  var problem = password_problem(form.password.value, form.repeat.value);
  if(problem)
    return show_login_step('create', problem), false;
  login_busy(async () => {
    var invoices = legacy_invoices();
    var created = await create_store(session.email, form.password.value, invoices);
    var file = await create_drive_file(JSON.stringify(created.store));
    session.file_id = file.id;
    session.store = created.store;
    session.data_key = created.data_key;
    session.version = file.version;
    session.password = form.password.value;
    session.invoices_json = JSON.stringify(invoices);
    remove_legacy_invoices();
    await finish_login();
  });
  return false;
}

async function finish_login() {
  remember_login();
  try {
    await acquire_lock();
  } catch(e) {
    session.error = e;
  }
  data = load_invoices();
  document.body.classList.add('logged_in');
  parse_invoices(data);
  start_sync_timers();
}

function logout() {
  if((form_dirty || session.unsaved) && !confirm('Има незаписани промени. Да изляза ли въпреки това?'))
    return false;
  form_dirty = false;
  session.unsaved = false;
  release_lock();
  location.reload();
  return false;
}

// "Access" dialog

// key slot changes are made on the store in memory; when they cannot be saved, they are undone,
// unless a conflict already reloaded the store from Google Drive
async function save_key_change(change) {
  var before = {store: JSON.stringify(session.store), data_key: session.data_key, version: session.version};
  await change();
  if(await save_store())
    return true;
  if(session.version == before.version) {
    session.store = JSON.parse(before.store);
    session.data_key = before.data_key;
  }
  return false;
}

function open_people_dialog() {
  var dialog = document.getElementById('dialog');
  dialog.innerHTML = people_parse_fn({
    me: session.email,
    people: Object.keys(session.store.keys).sort().map((email) => ({email: email, temp: !!session.store.keys[email].temp}))
  });
  dialog.classList.remove('hidden');
  return false;
}

function close_people_dialog() {
  document.getElementById('dialog').classList.add('hidden');
  return false;
}

async function add_person(form) {
  var email = normalize_email(form.email.value);
  var password = form.password.value;
  if(!can_edit())
    return false;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return alert('Въведете имейл на Google профил.'), false;
  if(password.length < MIN_PASSWORD_LENGTH)
    return alert('Временната парола трябва да е поне ' + MIN_PASSWORD_LENGTH + ' знака.'), false;
  if(has_key_slot(session.store, email)
      && !confirm(email + ' вече има достъп. Да му задам ли нова временна парола (напр. ако е забравил своята)?'))
    return false;
  var added = await save_key_change(async () => {
    await set_key_slot(session.store, email, password, session.data_key);
    session.store.keys[email].temp = true;
  });
  if(!added)
    return alert('Неуспешно записване в Google Drive - ' + email + ' не е добавен.'), false;
  var share_error = null;
  try {
    await share_drive_file(session.file_id, email);
  } catch(e) {
    share_error = e;
  }
  open_people_dialog();
  alert(email + ' е добавен.\n\n'
    + (share_error ? 'Файлът НЕ можа да бъде споделен (' + share_error.message + ') - споделете го ръчно от Google Drive.\n\n' : 'Google му изпраща имейл, че файлът е споделен.\n\n')
    + 'Изпратете му временната парола по друг път (телефон, съобщение), не в същия имейл. При първия вход ще си зададе своя парола.');
  return false;
}

// with a new data key, so someone who kept the old one cannot read what is saved from now on.
// Only the current user's slot can be made again from a password; the others get new temporary ones.
async function remove_person(email) {
  if(!can_edit())
    return false;
  var others = Object.keys(session.store.keys).filter((other) => other != email && other != session.email);
  if(!confirm('Да премахна ли достъпа на ' + email + '?'
      + (others.length ? '\n\nДанните ще бъдат шифровани с нов ключ, затова ' + others.join(', ') + ' ще получат нови временни пароли, които трябва да им предадете.' : '')))
    return false;
  var passwords = [];
  var removed = await save_key_change(async () => {
    session.data_key = await rotate_data_key(session.store, session.email, session.password, JSON.parse(session.invoices_json));
    for(var other of others) {
      var password = random_password();
      await set_key_slot(session.store, other, password, session.data_key);
      session.store.keys[other].temp = true;
      passwords.push(other + ':  ' + password);
    }
  });
  if(!removed)
    return alert('Неуспешно записване в Google Drive - достъпът на ' + email + ' не е премахнат.'), false;
  var unshare_error = null;
  try {
    await unshare_drive_file(session.file_id, email);
  } catch(e) {
    unshare_error = e;
  }
  open_people_dialog();
  alert(email + ' е премахнат.'
    + (unshare_error ? '\n\nСподелянето на файла НЕ можа да бъде спряно (' + unshare_error.message + ') - спрете го ръчно от Google Drive.' : '')
    + (passwords.length ? '\n\nНови временни пароли (запишете ги сега, няма да се покажат отново):\n' + passwords.join('\n') : ''));
  return false;
}

async function change_password(form) {
  if(!can_edit())
    return false;
  var problem = password_problem(form.password.value, form.repeat.value);
  if(problem)
    return alert(problem), false;
  if(!await save_key_change(() => set_key_slot(session.store, session.email, form.password.value, session.data_key)))
    return alert('Неуспешно записване в Google Drive - паролата не е сменена.'), false;
  session.password = form.password.value;
  form.reset();
  alert('Паролата е сменена.');
  return false;
}
