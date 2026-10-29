// The invoice form: row handling, recalculation, clone and save

// rewrites a typed number in the form the rest of the invoice uses, leaving text that is not a number alone
function normalize_number_input(el) {
  if(el && el.value.trim() && !isNaN(parse_amount(el.value)))
    el.value = normalize_number_text(el.value);
}

function row_index(el) {
  return parseInt(el.id.split('_').pop());
}

function update_amounts() {
  var i=0;
  var subtotal = 0;
  normalize_number_input(document.getElementById('invoice_tax'));
  while(document.getElementById('product_name_'+i)) {
    normalize_number_input(document.getElementById('product_amount_'+i));
    if(!isNaN(parse_amount(document.getElementById('product_amount_'+i).value)))
      subtotal += parse_amount(document.getElementById('product_amount_'+i).value);
    i++;
  }
  document.getElementById('invoice_subtotal').value = subtotal.toFixed(2);
  var vat_amount = calc_vat_amount(document.getElementById('invoice_subtotal').value, document.getElementById('invoice_tax').value);
  document.getElementById('invoice_tax_amount').value = vat_amount;
  document.getElementById('vat_exempt_row').classList.toggle('hidden', !is_zero_rate(document.getElementById('invoice_tax').value));
  if(vat_amount) {
    // total is the sum of the displayed (rounded) amounts, so the printed numbers always add up
    document.getElementById('invoice_total').value = (parse_amount(document.getElementById('invoice_subtotal').value) + parse_amount(vat_amount)).toFixed(2);
    update_total_amount_verbally();
  }
}

// bases used on earlier invoices, most recent first, offered as suggestions
function known_tax_exempt_bases(data) {
  return [...new Set(data.invoices.map((inv) => inv.invoice_tax_exempt_basis).filter(Boolean))];
}

function calc_row_amount(i) {
  var price = document.getElementById('product_price_'+i), quantity = document.getElementById('product_quantity_'+i);
  normalize_number_input(price);
  normalize_number_input(quantity);
  if(document.getElementById('product_name_'+i) && price.value && quantity.value && !isNaN(parse_amount(price.value)) && !isNaN(parse_amount(quantity.value)))
    document.getElementById('product_amount_'+i).value = round_amount(parse_amount(price.value) * parse_amount(quantity.value)).toFixed(2);
  update_amounts();
}

function add_table_row(el) {
  if(is_last_row(el) && el.value.length) {
    var row_el = clone_row(el.closest('tr'));
  }
}

function clone_row(el) {
  var clone = el.cloneNode(true);
  el.after(clone);
  Array.from(clone.cells).forEach((cell, index) => {
    var component = cell.getElementsByTagName('input')[0];
    component.id = calc_next_id(component);
    component.value = "";
  });
  return clone;
}

function calc_next_id(el) {
  var id_arr = el.id.split('_')
  id_arr.push(parseInt(id_arr.pop())+1);
  return id_arr.join('_');
}

function is_last_row(el) {
  return document.getElementById(calc_next_id(el)) == undefined;
}

function update_total_amount_verbally() {
  var total = document.getElementById('invoice_total').value;
  if(total)
    document.getElementById('verbally').value = Verbally_bg.convert(parse_amount(total), document.getElementById('currency').value);
}

// saved invoices keep their currency (ones saved without it predate the euro, so BGN); new ones get the default
function select_currency(option) {
  var currency = data.current ? data.current.currency || 'BGN' : COMPANY.default_currency;
  return option && currency.toUpperCase() == option.toUpperCase() ? 'selected' : 'ignored';
}

function select_payment_method(option) {
  var method = data.current?.payment_method || COMPANY.default_payment_method;
  return option && method.toUpperCase() == option.toUpperCase() ? 'selected' : 'ignored';
}

// the header shows the number and date in the form, which differ from the saved ones after a Clone or an edit
function refresh_header(form) {
  render_header({invoices: data.invoices, current: {number: form.number.value, date: form.date.value}});
}

function mark_selected_invoice (inv_id) {
  Array.from(document.querySelectorAll('.inv_link.selected')).forEach((el) => el.classList.remove('selected'));
  document.getElementById('inv_'+inv_id).classList.add('selected');
}

// true while the form has edits that are not saved yet; parse_invoices() clears it
var form_dirty = false;

// the list slides in while the address ends in #invoice_list (CSS :target), and out when that is cleared
function invoice_list_open() {
  return location.hash == '#invoice_list';
}

function toggle_invoice_list() {
  location.hash = invoice_list_open() ? '' : 'invoice_list';
  return false;
}

// opening another invoice replaces the form; returning false keeps the list open
function open_invoice(number) {
  if(form_dirty && !confirm('Има незаписани промени. Да ги загубя ли?'))
    return false;
  show_invoice(number);
  return true;
}

function show_invoice(value) {
  data.current = data.invoices.find( ({ number }) => number == value );
  parse_invoices(data);
  mark_selected_invoice(data.current.number);
}

function get_next_invoice_number() {
  if (!data.invoices || data.invoices.length === 0) {
    return 1; // start from 1 if no invoices exist
  }

  const maxNumber = Math.max(...data.invoices.map(invoice => invoice.number || 0));
  return maxNumber + 1;
}

function clone_invoice(form) {
  data.current = null;
  form.number.value = get_next_invoice_number();
  form.date.value = format_date(new Date());
  // fields that belong to one invoice only
  form.proforma.checked = false;
  form.due_date.value = '';
  if(form.currency.value == 'BGN')
    convert_form_to_eur(form);
  // the clone exists only in the form until it is saved
  form_dirty = true;
  refresh_header(form);
  document.querySelectorAll('.inv_link.selected').forEach((el) => el.classList.remove('selected'));
}

// converts the product prices of a cloned BGN invoice and recalculates every amount
function convert_form_to_eur(form) {
  form.currency.value = 'EUR';
  var i = 0;
  while(form['product_name_'+i]) {
    if(form['product_price_'+i].value)
      form['product_price_'+i].value = bgn_to_eur(form['product_price_'+i].value);
    else if(form['product_amount_'+i].value) // a row with only an amount
      form['product_amount_'+i].value = bgn_to_eur(form['product_amount_'+i].value);
    calc_row_amount(i);
    i++;
  }
}

const PRODUCT_FIELDS = ['product_name', 'product_price', 'product_quantity', 'product_unit', 'product_amount'];

// every product row with at least one field filled in, plus the table row numbers of those missing a name or an amount
function read_product_rows(form) {
  var rows = [], incomplete = [];
  for(var i = 0; form['product_name_'+i]; i++) {
    var row = {};
    PRODUCT_FIELDS.forEach((field) => row[field] = form[field+'_'+i].value);
    if(!PRODUCT_FIELDS.some((field) => row[field].trim()))
      continue;
    rows.push(row);
    if(!row.product_name.trim() || !row.product_amount.trim())
      incomplete.push(i + 1);
  }
  return {rows: rows, incomplete: incomplete};
}

function save_invoice(form) {
  if(!can_edit())
    return false;
  var number = form.number.value.trim();
  if(!number) {
    alert('Въведете номер на фактурата.');
    form.number.focus();
    return false;
  }
  // checked only for new or renumbered invoices, so duplicates saved before this check can still be edited
  var existing = !data.current || !same_invoice_number(data.current.number, number)
    ? data.invoices.find((inv) => inv !== data.current && same_invoice_number(inv.number, number))
    : undefined;
  if(existing) {
    alert('Фактура № ' + existing.number + ' от ' + existing.date + ' вече съществува. Изберете друг номер или отворете съществуващата фактура от списъка, за да я промените.');
    form.number.focus();
    return false;
  }
  var products = read_product_rows(form);
  if(products.incomplete.length
      && !confirm('Без наименование или стойност: ред ' + products.incomplete.join(', ') + '. Да запиша ли фактурата въпреки това?'))
    return false;
  if(is_zero_rate(form.invoice_tax.value) && !form.invoice_tax_exempt_basis.value.trim()
      && !confirm('ДДС е 0%, но не е посочено основание за неначисляване на ДДС. Да запиша ли фактурата въпреки това?'))
    return false;
  if(!data.current) {
    var new_invoice = {number: number};
    data.invoices.push(new_invoice);
    sort_invoices_desc(data);
    data.current = new_invoice;
  }
  if(!data.current.supplier)
    data.current.supplier = {};
  data.current.supplier.name = form.supplier_name.value;
  data.current.supplier.address = form.supplier_address.value;
  data.current.supplier.tax_no = form.supplier_tax_no.value;
  data.current.supplier.id_no = form.supplier_id_no.value;
  data.current.supplier.responsible = form.supplier_responsible.value;
  if(!data.current.client)
    data.current.client = {};
  data.current.client.name = form.client_name.value;
  data.current.client.address = form.client_address.value;
  data.current.client.tax_no = form.client_tax_no.value;
  data.current.client.id_no = form.client_id_no.value;
  data.current.client.responsible = form.client_responsible.value;
  data.current.proforma = form.proforma.checked;
  data.current.number = number;
  data.current.date = form.date.value;
  data.current.currency = String(form.currency.value);
  data.current.verbally = form.verbally.value;
  data.current.place = form.place.value;
  data.current.due_date = form.due_date.value;
  data.current.payment_method = String(form.payment_method.value);
  data.current.payment_details = form.payment_details.value;
  data.current.created_by = form.created_by.value;
  data.current.received_by = form.received_by.value;
  data.current.products = products.rows;
  data.current.project = form.project.value;
  data.current.invoice_subtotal = form.invoice_subtotal.value;
  data.current.invoice_tax = form.invoice_tax.value;
  data.current.invoice_tax_amount = form.invoice_tax_amount.value;
  data.current.invoice_tax_exempt_basis = is_zero_rate(form.invoice_tax.value) ? form.invoice_tax_exempt_basis.value.trim() : '';
  data.current.invoice_total = form.invoice_total.value;
  data.current = undefined;

  store_invoices(data);
  data = load_invoices();
  show_invoice(number);
  show_message('Фактура № ' + number + ' е записана.');

  return false;
}

// a short note at the bottom of the screen that disappears by itself
function show_message(text) {
  var message = document.getElementById('message');
  if(!message) {
    message = document.createElement('div');
    message.id = 'message';
    message.className = 'non_print';
    document.body.appendChild(message);
  }
  message.textContent = text;
  message.classList.add('visible');
  clearTimeout(show_message.timer);
  show_message.timer = setTimeout(() => message.classList.remove('visible'), 2500);
}

function auto_grow_textarea(textField)
{
  textField.style.height = 'auto';
  textField.style.height = textField.scrollHeight + "px";
}
