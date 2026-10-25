// Pure helpers for numbers, amounts, VAT and dates; no DOM access

// "1 200,50", "1.200,50" and "1,200.50" all become "1200.50"; a lone comma or dot is the decimal mark
function normalize_number_text(value) {
  var text = String(value).trim().replace(/[\s\u00a0]/g, '');
  [',', '.'].forEach((sep) => {
    if(text.split(sep).length > 2) // repeated: thousands separator
      text = text.split(sep).join('');
  });
  if(text.includes(',') && text.includes('.')) // both: the last one is the decimal mark
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace('.', '').replace(',', '.') : text.replace(',', '');
  return text.replace(',', '.');
}

function parse_amount(value) {
  return parseFloat(normalize_number_text(value));
}

function round_amount(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// a 0% invoice must state the legal basis for not charging VAT (чл. 114 ЗДДС)
function is_zero_rate(rate) {
  return rate !== undefined && rate !== null && String(rate).trim() !== '' && parse_amount(rate) === 0;
}

// VAT amount as a 2-decimal string, or '' when the base or the rate is missing
function calc_vat_amount(subtotal, rate) {
  if(!subtotal || !rate || isNaN(parse_amount(subtotal)) || isNaN(parse_amount(rate)))
    return '';
  return round_amount(parse_amount(subtotal) * parse_amount(rate) / 100).toFixed(2);
}

// fixed rate of the euro changeover on 01.01.2026
const BGN_PER_EUR = 1.95583;

function bgn_to_eur(value) {
  return isNaN(parse_amount(value)) ? value : round_amount(parse_amount(value) / BGN_PER_EUR).toFixed(2);
}

// "5", 5 and "0005" are the same invoice number (all print as 0000000005)
function same_invoice_number(a, b) {
  a = String(a).trim();
  b = String(b).trim();
  return /^\d+$/.test(a) && /^\d+$/.test(b) ? parseInt(a, 10) == parseInt(b, 10) : a == b;
}

// dd.mm.yyyy; toLocaleDateString('bg-BG') would add " г." and the printout adds another
function format_date(date) {
  return String(date.getDate()).padStart(2, '0') + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + date.getFullYear();
}

// dates saved earlier may already end in " г."
function without_year_suffix(date) {
  return String(date).replace(/\s*г\.?\s*$/, '');
}
