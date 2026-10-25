// Saving invoices in localStorage, and backing them up to / restoring them from JSON files

const STORAGE_NAME = 'IT-Bulgaria Invoices1';

const LAST_CHANGE_NAME = STORAGE_NAME + ' last change';

const LAST_EXPORT_NAME = STORAGE_NAME + ' last export';

function sort_invoices_desc(data) {
  data.invoices.sort(function(a, b) {
    return b.number - a.number;
  });
}

function load_invoices() {
  var data = JSON.parse(localStorage.getItem(STORAGE_NAME));

  // If no data loaded - create new
  if(!data)
    data={invoices:[]};

  sort_invoices_desc(data);

  return data;
}

function store_invoices(data) {
  localStorage.setItem(STORAGE_NAME, JSON.stringify({invoices: data.invoices}));
  localStorage.setItem(LAST_CHANGE_NAME, Date.now());
}

function backup_status(data) {
  var last_change = parseInt(localStorage.getItem(LAST_CHANGE_NAME)) || 0;
  var last_export = parseInt(localStorage.getItem(LAST_EXPORT_NAME)) || 0;
  return {
    last_export: last_export,
    text:last_export ? 'Последен архив: ' + new Date(last_export).toLocaleString('bg-BG') : 'Няма архив',
    overdue: last_export ? last_change > last_export : data.invoices.length > 0
  };
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

  localStorage.setItem(LAST_EXPORT_NAME, Date.now());
  render_header(data);
}

function import_file(file) {
  if(!file)
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
    // the stored data now matches a file on disk
    localStorage.setItem(LAST_EXPORT_NAME, Date.now());
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

// ask the browser not to evict localStorage under storage pressure
if(navigator.storage && navigator.storage.persist)
  navigator.storage.persist();
