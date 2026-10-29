// Encrypting the shared invoices file.
// The invoices are encrypted with one random data key; every user has a "key slot" holding that
// data key encrypted with a key derived from their own password. A wrong password fails to
// decrypt the slot (AES-GCM checks integrity), which is how a login is verified.
//
// Store file layout:
//   { v: 1, keys: { "<email>": {salt, iv, wrapped} }, iv, data }

const STORE_VERSION = 1;

const PBKDF2_ITERATIONS = 600000;

class WrongPasswordError extends Error {}

function to_b64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function from_b64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

function random_bytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function normalize_email(email) {
  return email.trim().toLowerCase();
}

async function password_key(password, salt) {
  var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: PBKDF2_ITERATIONS},
    base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

// extractable, so it can be put into new key slots
function new_data_key() {
  return crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt']);
}

// the slot is bound to its email, so it cannot be copied under another user's name
async function set_key_slot(store, email, password, data_key) {
  email = normalize_email(email);
  var salt = random_bytes(16);
  var iv = random_bytes(12);
  var raw = await crypto.subtle.exportKey('raw', data_key);
  var wrapped = await crypto.subtle.encrypt({name: 'AES-GCM', iv: iv, additionalData: new TextEncoder().encode(email)},
    await password_key(password, salt), raw);
  store.keys[email] = {salt: to_b64(salt), iv: to_b64(iv), wrapped: to_b64(wrapped)};
}

function remove_key_slot(store, email) {
  delete store.keys[normalize_email(email)];
}

function has_key_slot(store, email) {
  return Object.hasOwn(store.keys, normalize_email(email));
}

async function open_key_slot(store, email, password) {
  email = normalize_email(email);
  var slot = store.keys[email];
  if(!slot)
    throw new Error('No access for ' + email);
  var raw;
  try {
    raw = await crypto.subtle.decrypt({name: 'AES-GCM', iv: from_b64(slot.iv), additionalData: new TextEncoder().encode(email)},
      await password_key(password, from_b64(slot.salt)), from_b64(slot.wrapped));
  } catch(e) {
    throw new WrongPasswordError('Wrong password');
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

// a fresh iv on every save; reusing one with the same key would break AES-GCM
async function encrypt_invoices(store, data_key, invoices) {
  var iv = random_bytes(12);
  var plain = new TextEncoder().encode(JSON.stringify({invoices: invoices}));
  store.iv = to_b64(iv);
  store.data = to_b64(await crypto.subtle.encrypt({name: 'AES-GCM', iv: iv}, data_key, plain));
}

async function decrypt_invoices(store, data_key) {
  var plain = await crypto.subtle.decrypt({name: 'AES-GCM', iv: from_b64(store.iv)}, data_key, from_b64(store.data));
  return JSON.parse(new TextDecoder().decode(plain)).invoices;
}

async function create_store(email, password, invoices) {
  var store = {v: STORE_VERSION, keys: {}};
  var data_key = await new_data_key();
  await set_key_slot(store, email, password, data_key);
  await encrypt_invoices(store, data_key, invoices);
  return {store: store, data_key: data_key};
}

// after removing a user: a new data key, so a copy of the old one no longer opens new saves.
// Only the current user's slot can be re-made (it needs their password); the others get
// new slots from add_user with a temporary password.
async function rotate_data_key(store, email, password, invoices) {
  var data_key = await new_data_key();
  store.keys = {};
  await set_key_slot(store, email, password, data_key);
  await encrypt_invoices(store, data_key, invoices);
  return data_key;
}

function parse_store(text) {
  var store = JSON.parse(text);
  if(!store || store.v != STORE_VERSION || !store.keys || !store.iv || !store.data)
    throw new Error('Not an invoices store file');
  return store;
}

// for the temporary passwords of new users; no look-alike characters, as it is typed in by hand
function random_password() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(random_bytes(14), (byte) => letters[byte % letters.length]).join('');
}
