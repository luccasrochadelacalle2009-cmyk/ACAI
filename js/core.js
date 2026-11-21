/* ===== Açaí ERP — núcleo: utilitários, estado, auditoria, Supabase ===== */
(function (global) {
  'use strict';

  var KEY = 'acai-erp-v1';
  var CKEY = 'acai-supabase-config';
  var SKEY = 'acai-sync-meta';
  var DKEY = 'acai-device-id';
  var TZ = 'America/Sao_Paulo';

  var DEFAULT_SC = {
    url: 'https://tkgdeklhkhutvgskrbgd.supabase.co',
    key: 'sb_publishable_28gLwnc9CpZ0EzbZY1-5UQ_MKskUNkl'
  };

  var COLLECTIONS = [
    'accounts', 'partners', 'suppliers', 'stockItems', 'products', 'recipes',
    'sales', 'entries', 'expenses', 'purchases', 'stockMovements', 'bills',
    'goalMovements', 'partnerTransactions', 'profitDistributions', 'transfers',
    'cashCounts', 'audit'
  ];

  var CATEGORIES = {
    producao: { label: 'Custos de produção', group: 'custo', items: ['Polpa de açaí', 'Frutas', 'Leite em pó', 'Leite condensado', 'Granola', 'Paçoca', 'Coberturas', 'Outros acompanhamentos'] },
    embalagens: { label: 'Embalagens', group: 'custo', items: ['Garrafas', 'Tampas', 'Sacolas', 'Etiquetas', 'Canudos', 'Descartáveis'] },
    operacional: { label: 'Despesas operacionais', group: 'operacional', items: ['Transporte', 'Combustível', 'Gelo', 'Energia elétrica', 'Taxas de pagamento', 'Manutenção', 'Alimentação na operação'] },
    administrativa: { label: 'Despesas administrativas', group: 'operacional', items: ['Marketing', 'Divulgação', 'Internet', 'Serviços', 'Taxas e licenças', 'Outras administrativas'] },
    impostos: { label: 'Impostos e obrigações', group: 'imposto', items: ['Impostos', 'INSS', 'FGTS', 'Outras obrigações'] },
    investimentos: { label: 'Investimentos', group: 'investimento', items: ['Freezer', 'Liquidificador', 'Utensílios', 'Equipamentos', 'Melhorias na estrutura'] }
  };

  var ENTRY_CATEGORIES = [
    'Vendas (automático)', 'Aporte do proprietário', 'Investimento externo',
    'Recebimento de dívidas', 'Reembolsos', 'Outras receitas'
  ];

  var PAYMENTS = ['Dinheiro', 'PIX', 'Cartão de débito', 'Cartão de crédito', 'Outros'];
  var ACCOUNT_TYPES = ['Caixa operacional', 'Dinheiro físico', 'Conta bancária', 'Carteira digital', 'Reserva financeira'];
  var STOCK_CATEGORIES = ['Matéria-prima', 'Embalagem', 'Produto acabado', 'Acompanhamento', 'Outros'];
  var UNITS = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'caixa'];

  /* ---------- utilitários ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function round2(n) { n = Number(n) || 0; return Math.round((n + Number.EPSILON) * 100) / 100; }
  function num(n) { return round2(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function money(n) { return 'R$ ' + num(n); }
  function pct(n, d) { return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d === undefined ? 1 : d, maximumFractionDigits: d === undefined ? 1 : d }) + '%'; }
  function compact(n) {
    var a = Math.abs(n);
    if (a >= 1000000) return 'R$ ' + (n / 1000000).toFixed(1).replace('.', ',') + ' mi';
    if (a >= 1000) return 'R$ ' + (n / 1000).toFixed(1).replace('.', ',') + ' mil';
    return money(n);
  }
  function uid() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }
  function isoNow() { return new Date().toISOString(); }
  function localDate(d) {
    d = d || new Date();
    return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  function localDateTime(d) {
    d = d || new Date();
    return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d).replace(' ', 'T');
  }
  function today() { return localDate(); }
  function nowDT() { return localDateTime(); }
  function monthOf(s) { return String(s || '').slice(0, 7); }
  function dayOf(s) { return String(s || '').slice(0, 10); }
  function dateBR(s) {
    if (!s) return '—';
    var p = String(s).slice(0, 10).split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(s);
  }
  function dateTimeBR(s) {
    if (!s) return '—';
    var d = String(s).replace('T', ' ').split(':');
    return dateBR(s) + (d.length > 1 ? ' ' + d[0].slice(11, 13) + ':' + d[1] : '');
  }
  function daysBetween(a, b) {
    var x = new Date(a + 'T12:00:00Z'), y = new Date(b + 'T12:00:00Z');
    return Math.round((y - x) / 86400000);
  }
  function addDays(isoDate, n) {
    var d = new Date(isoDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function options(list, selected) {
    return list.map(function (o) {
      var v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }
  function categoryOptions(selected) {
    return Object.keys(CATEGORIES).map(function (k) {
      return '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' + CATEGORIES[k].label + '</option>';
    }).join('');
  }
  function subcategoryOptions(cat, selected) {
    var items = (CATEGORIES[cat] || CATEGORIES.producao).items;
    return options(items, selected || items[0]);
  }
  function toast(msg, isErr) {
    var root = $('#toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 3600);
  }
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function toCSV(rows) {
    return rows.map(function (row) {
      return row.map(function (cell) {
        var v = cell === null || cell === undefined ? '' : String(cell);
        return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(';');
    }).join('\r\n');
  }
  function exportCSV(name, rows) {
    download(name + '-' + today() + '.csv', '\ufeff' + toCSV(rows), 'text/csv;charset=utf-8');
    toast('CSV exportado');
  }
  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ---------- estado ---------- */
  function defaultState() {
    var t = isoNow();
    var s = {
      meta: {
        version: 1, updatedAt: t, businessName: 'Açaí da Praia', currency: 'BRL',
        timezone: TZ, theme: 'light',
        goal: { amount: 20000, startDate: today(), endDate: addDays(today(), 180) },
        settings: { printHeader: true }
      },
      accounts: [
        { id: 'acc-caixa', name: 'Caixa operacional', type: 'Caixa operacional', openingBalance: 0, createdBy: 'sistema', updatedAt: t, deleted: false },
        { id: 'acc-reserva', name: 'Reserva da meta', type: 'Reserva financeira', openingBalance: 0, createdBy: 'sistema', updatedAt: t, deleted: false }
      ],
      partners: [], suppliers: [], stockItems: [], products: [], recipes: [], sales: [], entries: [],
      expenses: [], purchases: [], stockMovements: [], bills: [], goalMovements: [],
      partnerTransactions: [], profitDistributions: [], transfers: [], cashCounts: [], audit: []
    };
    return s;
  }

  function loadState() {
    var s;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    var base = defaultState();
    if (!s || typeof s !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      if (k === 'meta') {
        s.meta = Object.assign({}, base.meta, s.meta || {});
        s.meta.goal = Object.assign({}, base.meta.goal, s.meta.goal || {});
        s.meta.settings = Object.assign({}, base.meta.settings, s.meta.settings || {});
      } else if (!Array.isArray(s[k])) s[k] = base[k];
    });
    return s;
  }

  var state = loadState();
  var saveTimer = null;
  var listeners = [];

  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  function saveState(opts) {
    opts = opts || {};
    state.meta.version = (Number(state.meta.version) || 1) + 1;
    state.meta.updatedAt = isoNow();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {
      toast('Erro ao salvar localmente: ' + e.message, true);
      return;
    }
    cloud.markDirty();
    emit();
    if (opts.push !== false) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { cloud.push(); }, 1200);
    }
  }

  function replaceState(next, push) {
    state = next;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    emit();
    if (push !== false) cloud.push();
  }

  function resetState() {
    var fresh = defaultState();
    fresh.meta.theme = state.meta.theme;
    fresh.meta.businessName = state.meta.businessName;
    replaceState(fresh);
  }

  /* ---------- CRUD com auditoria ---------- */
  function currentUser() {
    var s = cloud.status.session;
    return (s && s.user && s.user.email) ? s.user.email : 'local';
  }

  function audit(entity, entityId, action, before, after, reason) {
    state.audit.push({
      id: uid(), at: isoNow(), entity: entity, entityId: String(entityId || ''),
      action: action, before: before || null, after: after || null,
      reason: reason || '', userId: currentUser(), updatedAt: isoNow(), deleted: false
    });
    if (state.audit.length > 4000) state.audit = state.audit.slice(-4000);
    cloud.pushAudit(entity, entityId, action, before, after, reason);
  }

  function list(entity) {
    return (state[entity] || []).filter(function (r) { return !r.deleted; });
  }
  function get(entity, id) {
    return (state[entity] || []).find(function (r) { return r.id === id && !r.deleted; }) || null;
  }
  function raw(entity, id) {
    return (state[entity] || []).find(function (r) { return r.id === id; }) || null;
  }
  function insert(entity, obj, reason) {
    var t = isoNow();
    var rec = Object.assign({ id: uid(), createdAt: t, createdBy: currentUser(), updatedAt: t, deleted: false }, obj);
    state[entity].push(rec);
    audit(entity, rec.id, 'criar', null, rec, reason);
    saveState();
    return rec;
  }
  function update(entity, id, patch, reason) {
    var rec = raw(entity, id);
    if (!rec) return null;
    var before = JSON.parse(JSON.stringify(rec));
    Object.assign(rec, patch, { updatedAt: isoNow(), updatedBy: currentUser() });
    audit(entity, id, 'editar', before, rec, reason);
    saveState();
    return rec;
  }
  function remove(entity, id, reason) {
    var rec = raw(entity, id);
    if (!rec) return false;
    var before = JSON.parse(JSON.stringify(rec));
    rec.deleted = true; rec.updatedAt = isoNow(); rec.deletedAt = isoNow();
    audit(entity, id, 'excluir', before, rec, reason);
    saveState();
    return true;
  }
  function restore(entity, id, reason) {
    var rec = raw(entity, id);
    if (!rec) return false;
    rec.deleted = false; rec.updatedAt = isoNow();
    audit(entity, id, 'restaurar', null, rec, reason);
    saveState();
    return true;
  }

  /* ---------- merge offline / nuvem ---------- */
  function newer(a, b) {
    var ta = String(a && a.updatedAt || ''), tb = String(b && b.updatedAt || '');
    if (ta === tb) return String(a && a.id || '') > String(b && b.id || '');
    return ta > tb;
  }
  function mergeArray(local, remote) {
    var map = {};
    (local || []).forEach(function (r) { if (r && r.id) map[r.id] = r; });
    (remote || []).forEach(function (r) {
      if (!r || !r.id) return;
      if (!map[r.id] || newer(r, map[r.id])) map[r.id] = r;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function mergeStates(local, remote) {
    if (!remote || typeof remote !== 'object') return local;
    var out = local;
    COLLECTIONS.forEach(function (k) {
      if (Array.isArray(remote[k])) out[k] = mergeArray(local[k] || [], remote[k]);
      else if (!Array.isArray(out[k])) out[k] = remote[k];
    });
    if (remote.meta && newer({ updatedAt: remote.meta.updatedAt, id: 'meta' }, { updatedAt: out.meta.updatedAt, id: '' })) {
      out.meta = Object.assign({}, out.meta, remote.meta);
    }
    return out;
  }

  /* ---------- Supabase ---------- */
  var SC;
  try { SC = Object.assign({}, DEFAULT_SC, JSON.parse(localStorage.getItem(CKEY) || '{}')); }
  catch (e) { SC = Object.assign({}, DEFAULT_SC); }

  var sb = null;
  var pushTimer = null;
  var cloud = {
    status: { session: null, online: navigator.onLine !== false, dirty: false, lastSync: null, error: null, ready: false, localMode: false },
    markDirty: function () {
      cloud.status.dirty = true;
      try { localStorage.setItem(SKEY, JSON.stringify({ lastSync: cloud.status.lastSync, dirty: true })); } catch (e) {}
      emit();
    },
    config: function () { return SC; },
    setConfig: function (url, key) {
      SC = { url: url.replace(/\/+$/, ''), key: key };
      localStorage.setItem(CKEY, JSON.stringify(SC));
      cloud.status.localMode = false;
      sb = null;
      return cloud.init();
    },
    init: function () {
      cloud.status.online = navigator.onLine !== false;
      if (!SC.url || !SC.key || !global.supabase || cloud.status.localMode) {
        cloud.status.ready = false; cloud.status.error = global.supabase ? 'Configuração incompleta.' : 'Supabase indisponível (sem internet).';
        emit(); return Promise.resolve(false);
      }
      try {
        if (!sb) sb = global.supabase.createClient(SC.url, SC.key, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
      } catch (e) { cloud.status.error = e.message; emit(); return Promise.resolve(false); }
      return sb.auth.getSession().then(function (res) {
        cloud.status.session = res.data.session || null;
        cloud.status.ready = true;
        cloud.status.error = null;
        emit();
        if (cloud.status.session) return cloud.pull();
        return false;
      }).catch(function (e) {
        cloud.status.error = e.message; cloud.status.ready = true; emit(); return false;
      });
    },
    signIn: function (email, pass) {
      if (!sb) return Promise.reject(new Error('Supabase não inicializado.'));
      return sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
        if (r.error) throw r.error;
        cloud.status.session = r.data.session;
        return cloud.pull();
      });
    },
    signUp: function (email, pass) {
      if (!sb) return Promise.reject(new Error('Supabase não inicializado.'));
      return sb.auth.signUp({ email: email, password: pass }).then(function (r) {
        if (r.error) throw r.error;
        if (r.data.session) { cloud.status.session = r.data.session; return cloud.pull(); }
        return 'confirm';
      });
    },
    resetPassword: function (email) {
      if (!sb) return Promise.reject(new Error('Supabase não inicializado.'));
      return sb.auth.resetPasswordForEmail(email).then(function (r) {
        if (r.error) throw r.error; return true;
      });
    },
    signOut: function () {
      if (!sb) return Promise.resolve();
      return sb.auth.signOut().then(function () { cloud.status.session = null; emit(); });
    },
    pull: function () {
      if (!sb || !cloud.status.session) return Promise.resolve(false);
      var uidUser = cloud.status.session.user.id;
      return sb.from('acai_data').select('data,device_id,version,updated_at').eq('user_id', uidUser).maybeSingle()
        .then(function (res) {
          if (res.error) throw res.error;
          var meta = {};
          try { meta = JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch (e) {}
          cloud.status.lastSync = res.data && res.data.updated_at || null;
          if (res.data && res.data.data && Object.keys(res.data.data).length) {
            state = mergeStates(state, res.data.data);
            try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
            emit();
          }
          cloud.status.dirty = false;
          try { localStorage.setItem(SKEY, JSON.stringify({ lastSync: cloud.status.lastSync, dirty: false })); } catch (e) {}
          var localDirty = !!(res.data && res.data.data && meta.dirty);
          return cloud.push();
        }).then(function () {
          toast('Dados sincronizados');
          return true;
        }).catch(function (e) {
          cloud.status.error = e.message; emit(); toast('Falha ao sincronizar: ' + e.message, true); return false;
        });
    },
    push: function () {
      if (!sb || !cloud.status.session || !navigator.onLine) return Promise.resolve(false);
      var sess = cloud.status.session;
      var dev = localStorage.getItem(DKEY);
      if (!dev) { dev = uid(); localStorage.setItem(DKEY, dev); }
      var ver = (Number(state.meta.version) || 1) + 1;
      return sb.from('acai_data').upsert({
        user_id: sess.user.id, data: state, device_id: dev, version: ver
      }, { onConflict: 'user_id' }).then(function (res) {
        if (res.error) throw res.error;
        cloud.status.dirty = false; cloud.status.error = null;
        cloud.status.lastSync = new Date().toISOString();
        try { localStorage.setItem(SKEY, JSON.stringify({ lastSync: cloud.status.lastSync, dirty: false })); } catch (e) {}
        emit(); return true;
      }).catch(function (e) {
        cloud.status.error = e.message; emit(); return false;
      });
    },
    pushAudit: function (entity, entityId, action, before, after, reason) {
      if (!sb || !cloud.status.session || !navigator.onLine) return;
      clearTimeout(pushTimer);
      var ev = { entity: entity, entityId: entityId, action: action, before: before, after: after, reason: reason };
      pushTimer = setTimeout(function () {
        sb.from('acai_audit').insert({
          user_id: cloud.status.session.user.id, entity: ev.entity, entity_id: ev.entityId,
          action: ev.action, before: ev.before, after: ev.after, reason: ev.reason,
          user_email: currentUser()
        });
      }, 800);
    },
    setLocalMode: function (on) {
      cloud.status.localMode = !!on;
      if (on) { localStorage.setItem('acai-local-mode', '1'); cloud.status.session = null; cloud.status.ready = false; }
      else localStorage.removeItem('acai-local-mode');
      emit();
    }
  };
  try { if (localStorage.getItem('acai-local-mode') === '1') cloud.status.localMode = true; } catch (e) {}
  try {
    var sm = JSON.parse(localStorage.getItem(SKEY) || '{}');
    cloud.status.lastSync = sm.lastSync || null;
  } catch (e) {}

  global.addEventListener('online', function () {
    cloud.status.online = true; emit();
    if (cloud.status.session) cloud.push();
  });
  global.addEventListener('offline', function () { cloud.status.online = false; emit(); });

  /* ---------- exportação pública ---------- */
  global.Acai = {
    KEY: KEY, TZ: TZ, COLLECTIONS: COLLECTIONS, CATEGORIES: CATEGORIES,
    ENTRY_CATEGORIES: ENTRY_CATEGORIES, PAYMENTS: PAYMENTS,
    ACCOUNT_TYPES: ACCOUNT_TYPES, STOCK_CATEGORIES: STOCK_CATEGORIES, UNITS: UNITS,
    util: {
      $: $, $$: $$, esc: esc, round2: round2, num: num, money: money, pct: pct, compact: compact,
      uid: uid, isoNow: isoNow, localDate: localDate, localDateTime: localDateTime,
      today: today, nowDT: nowDT, monthOf: monthOf, dayOf: dayOf, dateBR: dateBR,
      dateTimeBR: dateTimeBR, daysBetween: daysBetween, addDays: addDays,
      options: options, categoryOptions: categoryOptions, subcategoryOptions: subcategoryOptions,
      toast: toast, download: download, toCSV: toCSV, exportCSV: exportCSV,
      readFileAsDataURL: readFileAsDataURL
    },
    get state() { return state; },
    saveState: saveState, replaceState: replaceState, resetState: resetState, onChange: onChange, emit: emit,
    audit: audit, list: list, get: get, raw: raw, insert: insert, update: update,
    remove: remove, restore: restore, mergeStates: mergeStates, cloud: cloud,
    currentUser: currentUser
  };
})(typeof window !== 'undefined' ? window : globalThis);
