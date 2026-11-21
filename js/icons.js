/* ===== Açaí ERP — conjunto único de ícones vetoriais ===== */
(function (global) {
  'use strict';

  /* Traço uniforme: 24x24, 1.8px, pontas arredondadas, currentColor. */
  var PATHS = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5"/>',
    theme: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    brand: '<circle cx="12" cy="13.5" r="6"/><path d="M12 7.5c0-2.2 1.6-3.8 4.2-4.2M9.5 12a3.5 3.5 0 0 1 3.5-1.5"/>',

    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    sales: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    entries: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    expenses: '<path d="M12 21V9M7 14l5-5 5 5M4 4h16"/>',
    cashflow: '<path d="M3 17l6-6 4 4 7-8"/><path d="M15 7h5v5"/>',
    stock: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
    products: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/>',
    purchases: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h10.2l2-8H6"/>',
    bills: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    reports: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
    goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    partners: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2M16 5.5a3 3 0 0 1 0 5.5M18 15c2 .6 3 2.3 3 5"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',

    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    paperclip: '<path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',

    general: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    appearance: '<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1.9 1.9 0 0 1 1.3-3.2H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3z"/><circle cx="7.5" cy="11" r=".9"/><circle cx="10" cy="7" r=".9"/><circle cx="15" cy="7.5" r=".9"/>',
    accounts: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 14h3"/>',
    sync: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 10.5 3.8 3.8 0 0 0 7 18z"/>',
    data: '<path d="M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',

    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M4 4h16"/>',
    file: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    pencil: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'
  };

  function icon(name, size) {
    var s = Number(size) || 18;
    return '<svg class="icon" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' + (PATHS[name] || PATHS.circle) + '</svg>';
  }

  global.Icon = icon;
})(window);
