// Page start-up: compiles the templates in index.html and renders the saved invoices.
// Loaded at the end of the page, after the templates.

var header_parse_fn = doT.template(document.getElementById('header_tmpl').innerHTML);
var list_parse_fn = doT.template(document.getElementById('inv_list_tmpl').innerHTML);
var inv_parse_fn = doT.template(document.getElementById('inv_tmpl').innerHTML);

function render_header(data) {
  document.getElementById('header').innerHTML = header_parse_fn(data);
}

function parse_invoices(data) {
  render_header(data);
  document.getElementById('container').innerHTML = inv_parse_fn(data);
  document.getElementById('invoice_list').innerHTML = list_parse_fn(data);
  auto_grow_textarea(document.getElementById('supplier_address'));
  auto_grow_textarea(document.getElementById('client_address'));
  auto_grow_textarea(document.getElementById('payment_details'));
}

var data = load_invoices();

parse_invoices(data);

enable_drop_import(document.body);

window.onload = (event) => {
  auto_grow_textarea(document.getElementById('supplier_address'));
  auto_grow_textarea(document.getElementById('client_address'));
  auto_grow_textarea(document.getElementById('payment_details'));
}
