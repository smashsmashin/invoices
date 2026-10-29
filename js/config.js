// Company details and the defaults for new invoices
const COMPANY = {
  supplier: {
    name: 'ИТ България ООД',
    address: 'ул. Софроний Врачански №5\nИхтиман, 2050\nБългария',
    tax_no: 'BG130983696',
    id_no: '130983696',
    responsible: 'Ивайло Цанов'
  },
  created_by: 'Ивайло Цанов',
  default_currency: 'EUR',
  default_payment_method: 'bank_transfer',
  default_payment_details: 'Централна Кооперативна Банка\nгр. София, ж.к. Красна поляна, бул. Възкресение, бл. 132А\nSWIFT: CECBBGSF\nIBAN: BG98CECB97901093971500',
  default_vat_rate: '20'
};

// Google Drive storage (see the Google Cloud project "IT Bulgaria Invoices")
const GOOGLE = {
  client_id: '330212201220-84gvmj934algka0ghfmdrqrseiv9o97n.apps.googleusercontent.com',
  api_key: 'AIzaSyBpjuod6IjiK2HlU9ZB5c-sXKtrCIKmwpQ', // Picker API key, restricted to the site's addresses
  project_number: '330212201220', // Picker app id: the Cloud project number
  scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'
};
