function getSizeOfNonDomElement(domElement)
{
  var clone = domElement.cloneNode(true);
  clone.style.position = "absolute";
  clone.style.visibility = "hidden";
  clone.style.display = "block";
  document.body.appendChild(clone);

  let rect = clone.getBoundingClientRect();

  document.body.removeChild(clone);

  return rect;
}

window.onbeforeprint = (event) => {
    console.log('Before print');
    var print_form = document.body.appendChild(document.forms[0].cloneNode(true));
    console.log(print_form);
    print_form.id = 'print_form';

    var suplier_width= Math.max(
        getSizeOfNonDomElement(print_form.querySelector("#supplier_tax_no_label")).width,
        getSizeOfNonDomElement(print_form.querySelector("#supplier_id_no_label")).width,
        getSizeOfNonDomElement(print_form.querySelector("#supplier_responsible_label")).width
    );
    print_form.querySelector("#supplier_tax_no_label").style.width = suplier_width+'px';
    print_form.querySelector("#supplier_id_no_label").style.width = suplier_width+'px';
    print_form.querySelector("#supplier_responsible_label").style.width = suplier_width+'px';

    var client_width= Math.max(
        getSizeOfNonDomElement(print_form.querySelector("#client_tax_no_label")).width,
        getSizeOfNonDomElement(print_form.querySelector("#client_id_no_label")).width,
        getSizeOfNonDomElement(print_form.querySelector("#client_responsible_label")).width
    );
    print_form.querySelector("#client_tax_no_label").style.width = client_width+'px';
    print_form.querySelector("#client_id_no_label").style.width = client_width+'px';
    print_form.querySelector("#client_responsible_label").style.width = client_width+'px';

    var due_date = print_form.querySelector("#due_date");
    if(due_date.value.trim())
        due_date.value = without_year_suffix(due_date.value) + ' г.';
};

window.onafterprint = (event) => {
    console.log('After print');
    document.body.removeChild(document.getElementById('print_form'));
};

