/* ===== Açaí ERP — bootstrap, roteamento e eventos globais ===== */
(function (global) {
  'use strict';
  var A = global.Acai, U = A.util, V = global.AcaiViews, Act = global.AcaiActions;
  var routes = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'sales', label: 'Vendas', icon: 'sales' },
    { id: 'entries', label: 'Entradas', icon: 'entries' },
    { id: 'expenses', label: 'Despesas', icon: 'expenses' },
    { id: 'cashflow', label: 'Fluxo de caixa', icon: 'cashflow' },
    { id: 'stock', label: 'Estoque', icon: 'stock' },
    { id: 'products', label: 'Produtos e custos', icon: 'products' },
    { id: 'purchases', label: 'Compras e fornecedores', icon: 'purchases' },
    { id: 'bills', label: 'Contas a pagar/receber', icon: 'bills' },
    { id: 'reports', label: 'Relatórios', icon: 'reports' },
    { id: 'goal', label: 'Metas financeiras', icon: 'goal' },
    { id: 'partners', label: 'Sócios e lucros', icon: 'partners' },
    { id: 'settings', label: 'Configurações', icon: 'settings' }
  ];
  var bottom = ['dashboard', 'sales', 'entries', 'expenses', 'more'];

  var UI = {
    route: 'dashboard', period: 'month', cashPeriod: 'month', billType: 'pagar',
    report: 'dre', showDerived: true, authOpen: false,
    settingsSection: 'general', saveState: null,
    f: { from: '', to: '', q: '', product: '', payment: '', location: '', status: '', category: '', supplier: '', payer: '', report: 'dre' }
  };

  function applyTheme() {
    var t = A.state.meta.theme || 'light';
    var dark = t === 'dark' || (t === 'auto' && global.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }

  function renderNav() {
    var nav = document.getElementById('nav-list');
    nav.innerHTML = routes.map(function (r) {
      return '<button class="nav-item' + (UI.route === r.id ? ' active' : '') + '" data-act="go" data-route="' + r.id + '">' +
        '<span class="ic">' + Icon(r.icon, 20) + '</span><span>' + r.label + '</span></button>';
    }).join('');
    document.getElementById('bottom-nav').innerHTML = bottom.map(function (id) {
      if (id === 'more') return '<button class="bottom-item' + (['cashflow', 'stock', 'products', 'purchases', 'bills', 'reports', 'goal', 'partners', 'settings'].indexOf(UI.route) >= 0 ? ' active' : '') + '" data-act="more-menu"><span class="ic">' + Icon('menu', 21) + '</span><span>Mais</span></button>';
      var r = routes.find(function (x) { return x.id === id; });
      return '<button class="bottom-item' + (UI.route === id ? ' active' : '') + '" data-act="go" data-route="' + id + '">' +
        '<span class="ic">' + Icon(r.icon, 21) + '</span><span>' + r.label + '</span></button>';
    }).join('');
  }

  function renderStatus() {
    var st = A.cloud.status, pill = document.getElementById('sync-pill');
    var text, cls = 'pill';
    if (st.session && st.online && !st.dirty) { text = 'Sincronizado'; cls += ' online'; }
    else if (st.session && st.online && st.dirty) { text = 'Sincronizando…'; cls += ' dirty'; }
    else if (st.session && !st.online) { text = 'Offline'; cls += ' offline'; }
    else if (st.localMode) { text = 'Somente local'; cls += ' offline'; }
    else { text = 'Sem conta'; cls += ' offline'; }
    pill.textContent = text; pill.className = cls;
    document.getElementById('last-sync').textContent = st.lastSync ? 'Última sincronização: ' + U.dateTimeBR(st.lastSync) : '';
    document.getElementById('brand-name').textContent = A.state.meta.businessName || 'Açaí ERP';
  }

  function paintSaveState() {
    var el = document.querySelector('[data-save-state]');
    if (!el || !UI.saveState) return;
    el.textContent = UI.saveState.text;
    el.className = 'save-state' + (UI.saveState.kind ? ' ' + UI.saveState.kind : '');
  }
  function setSaveState(text, kind) {
    UI.saveState = { text: text, kind: kind || '' };
    paintSaveState();
  }

  function render() {
    applyTheme();
    renderNav();
    renderStatus();
    var fn = V[UI.route] || V.dashboard;
    document.getElementById('view').innerHTML = fn(A.state, UI);
    paintSaveState();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function navigate(route) {
    if (!routes.some(function (r) { return r.id === route; })) route = 'dashboard';
    UI.route = route;
    if (location.hash !== '#' + route) location.hash = route;
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');
    render();
  }

  function moreMenu() {
    var html = '<div class="modal-head"><h2>Todas as seções</h2><button class="icon-btn" data-act="close-modal" aria-label="Fechar">' + Icon('close', 16) + '</button></div><div class="grid g2">' +
      routes.map(function (r) {
        return '<button class="btn ghost" data-act="go" data-route="' + r.id + '" style="justify-content:flex-start">' + Icon(r.icon, 17) + ' ' + r.label + '</button>';
      }).join('') + '</div>';
    document.getElementById('modal-root').innerHTML = '<div class="modal-back" data-act="close-modal-bg"><div class="modal">' + html + '</div></div>';
  }

  function handleClick(ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act;
    if (act === 'toggle-sidebar') {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebar-overlay').classList.toggle('open');
      return;
    }
    if (act === 'more-menu') { moreMenu(); return; }
    if (act === 'close-modal-bg') {
      if (ev.target.classList.contains('modal-back')) Act['close-modal']();
      return;
    }
    var fn = Act[act];
    if (typeof fn === 'function') { ev.preventDefault(); fn(el, ev); }
  }

  function applySetting(key, value) {
    if (key === 'theme') {
      var old = A.state.meta.theme;
      A.state.meta.theme = value;
      A.saveState(); A.audit('config', 'appearance', 'editar', { theme: old }, { theme: value }, 'Tema do aplicativo');
      setSaveState('Salvando…');
      render();
      setSaveState('Salvo.');
      return;
    }
    if (key === 'storageMode') {
      var local = value === 'local';
      setSaveState('Salvando…');
      A.cloud.setLocalMode(local);
      render();
      (local ? Promise.resolve() : A.cloud.init()).then(function () {
        render(); setSaveState('Salvo.');
      });
    }
  }

  var filterTimer = null;
  function handleFilter(ev) {
    var el = ev.target;
    if (el.dataset && el.dataset.setting && ev.type === 'change') {
      applySetting(el.dataset.setting, el.value);
      return;
    }
    if (!el.id || el.id.slice(0, 2) !== 'f-') return;
    var key = el.id.slice(2);
    if (key === 'report') UI.report = el.value;
    else UI.f[key] = el.value;
    if (el.type === 'text' && ev.type === 'input') {
      clearTimeout(filterTimer);
      var id = el.id, pos = el.selectionStart;
      filterTimer = setTimeout(function () {
        render();
        var again = document.getElementById(id);
        if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
      }, 320);
    } else render();
  }

  function handleSubmit(ev) {
    var f = ev.target;
    if (f.id === 'form-login') { ev.preventDefault(); Act.login('login'); return; }
    if (f.id === 'form-business') {
      ev.preventDefault();
      var name = f.elements.businessName.value.trim() || 'Açaí ERP';
      var old = A.state.meta.businessName;
      A.state.meta.businessName = name;
      A.saveState(); A.audit('config', 'business', 'editar', { businessName: old }, { businessName: name }, 'Configurações do negócio');
      setSaveState('Salvando…'); render(); setSaveState('Salvo.'); return;
    }
    if (f.id === 'form-cloud') {
      ev.preventDefault();
      var url = f.elements.url.value.trim().replace(/\/+$/, ''), key = f.elements.key.value.trim();
      if (!/^https:\/\//i.test(url)) return U.toast('Informe uma URL HTTPS válida.', true);
      setSaveState('Salvando…');
      A.cloud.setConfig(url, key).then(function () { render(); setSaveState('Salvo.'); }).catch(function (e) { setSaveState('Erro ao salvar', 'err'); });
    }
  }

  function hydrateIcons() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (el) {
      el.innerHTML = Icon(el.dataset.icon, el.dataset.size);
    });
  }

  function boot() {
    hydrateIcons();
    applyTheme();
    var hash = (location.hash || '').replace('#', '');
    if (hash) UI.route = hash;
    UI.f.from = ''; UI.f.to = '';
    document.addEventListener('click', handleClick);
    document.addEventListener('change', handleFilter);
    document.addEventListener('input', handleFilter);
    document.addEventListener('submit', handleSubmit);
    window.addEventListener('hashchange', function () {
      var r = (location.hash || '').replace('#', '');
      if (r && r !== UI.route) { UI.route = r; render(); }
    });
    A.onChange(renderStatus);
    render();
    A.cloud.init().then(function () { render(); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  global.AcaiApp = { UI: UI, render: render, navigate: navigate, applyTheme: applyTheme, routes: routes };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
