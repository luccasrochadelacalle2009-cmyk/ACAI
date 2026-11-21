/* ===== Açaí ERP — renderização das telas ===== */
(function (global) {
  'use strict';
  var A = global.Acai, U = A.util, C = global.AcaiCalc;
  var h = U.esc, m = U.money, d = U.dateBR, dt = U.dateTimeBR;
  var V = {};

  function head(title, sub, actions) {
    return '<div class="page-head"><div><h1>' + h(title) + '</h1>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' +
      (actions ? '<div class="head-actions">' + actions + '</div>' : '') + '</div>';
  }
  function kpi(label, value, hint, cls) {
    return '<div class="kpi ' + (cls || '') + '"><div class="label">' + label + '</div>' +
      '<div class="value mono">' + value + '</div>' +
      (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  }
  function empty(msg, icon) {
    return '<div class="empty"><span class="big">' + Icon(icon || 'circle', 34) + '</span>' + h(msg) + '</div>';
  }
  function badge(text, kind) { return '<span class="badge ' + (kind || '') + '">' + h(text) + '</span>'; }
  function statusBadge(s) {
    var k = s === 'pago' || s === 'confirmada' ? 'ok' : (s === 'cancelada' || s === 'atrasado' ? 'bad' : 'warn');
    return badge(s || '—', k);
  }
  function table(headers, rows) {
    if (!rows.length) return empty('Nenhum registro encontrado.');
    return '<div class="table-wrap"><table><thead><tr>' + headers.map(function (x) {
      return '<th' + (x.num ? ' class="num"' : '') + '>' + h(x.t || x) + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }
  function filterBox(fields) {
    return '<div class="filters">' + fields.filter(Boolean).map(function (f) {
      return '<div class="field"><label>' + h(f.label) + '</label>' + f.html + '</div>';
    }).join('') + '</div>';
  }
  function inp(id, value, type, ph) {
    return '<input id="' + id + '" type="' + (type || 'text') + '" value="' + h(value === undefined ? '' : value) + '"' +
      (ph ? ' placeholder="' + h(ph) + '"' : '') + '>';
  }
  function sel(id, list, value) { return '<select id="' + id + '">' + U.options(list, value) + '</select>'; }
  function segment(items, active) {
    return '<div class="segment">' + items.map(function (i) {
      return '<button data-act="segment" data-group="' + i.group + '" data-value="' + i.value + '"' +
        (active === i.value ? ' class="active"' : '') + '>' + h(i.label) + '</button>';
    }).join('') + '</div>';
  }
  function periodFilters(f) {
    return filterBox([
      { label: 'De', html: inp('f-from', f.from, 'date') },
      { label: 'Até', html: inp('f-to', f.to, 'date') },
      { label: 'Buscar', html: inp('f-q', f.q, 'text', 'descrição, cliente…') }
    ]);
  }
  function settingRow(label, desc, control) {
    return '<div class="setting-row"><div class="setting-info"><div class="setting-name">' + label + '</div>' +
      (desc ? '<div class="setting-desc">' + desc + '</div>' : '') + '</div>' +
      '<div class="setting-control">' + control + '</div></div>';
  }
  function barChart(title, data, format, alt) {
    var max = Math.max.apply(null, [1].concat(Object.keys(data || {}).map(function (k) { return Math.abs(data[k]) || 0; })));
    var keys = Object.keys(data || {}).sort(function (a, b) { return data[b] - data[a]; }).slice(0, 8);
    return '<div class="card"><h2>' + h(title) + '</h2>' + (keys.length ? '<div class="bar-chart">' + keys.map(function (k) {
      var w = Math.max(2, Math.abs(data[k]) / max * 100);
      return '<div class="bar-row"><span title="' + h(k) + '">' + h(String(k).slice(0, 13)) + '</span>' +
        '<div class="bar-track' + (alt ? ' alt' : '') + '"><i style="width:' + w.toFixed(1) + '%"></i></div>' +
        '<span class="v mono">' + (format ? format(data[k]) : m(data[k])) + '</span></div>';
    }).join('') + '</div>' : empty('Sem dados no período.')) + '</div>';
  }

  /* ---------- Dashboard ---------- */
  V.dashboard = function (s, ui) {
    var p = ui.period || 'month';
    var today = U.today();
    var from = p === 'today' ? today : p === 'month' ? today.slice(0, 7) + '-01' : (ui.f.from || today.slice(0, 7) + '-01');
    var to = p === 'today' ? today : p === 'month' ? today : (ui.f.to || today);
    var k = C.metrics(s, from, to);
    var g = C.goalStatus(s);
    var stock = C.stockStatus(s);
    var due = A.list('bills').filter(function (b) { return b.status !== 'pago' && b.dueDate && b.dueDate <= U.addDays(today, 7); });
    var acts = '<button class="btn" data-act="new-sale">Nova venda</button>' +
      '<button class="btn ghost" data-act="new-expense">Nova despesa</button>' +
      '<button class="btn ghost" data-act="export-dash">Exportar</button>';

    var html = head('Visão geral', 'Período: ' + d(from) + ' a ' + d(to) + ' · todos os valores vêm dos registros do sistema', acts);
    html += segment([
      { group: 'period', value: 'today', label: 'Hoje' },
      { group: 'period', value: 'month', label: 'Mês' },
      { group: 'period', value: 'custom', label: 'Período' }
    ], p);
    if (p === 'custom') html += periodFilters(ui.f);
    html += '<div class="kpis">' +
      kpi('Faturamento no dia', m(k.revenueDay), 'somente vendas confirmadas', 'accent') +
      kpi('Faturamento no mês', m(k.revenueMonth), 'somente vendas confirmadas') +
      kpi('Total de entradas', m(k.totalIn), 'vendas + entradas manuais (inclui aportes)', '') +
      kpi('Total de saídas', m(k.totalOut), 'despesas pagas, inclui investimentos', 'neg') +
      kpi('Lucro bruto', m(k.grossProfit), 'faturamento − custo dos produtos vendidos', k.grossProfit >= 0 ? 'pos' : 'neg') +
      kpi('Lucro líquido', m(k.netProfit), 'lucro bruto − despesas − impostos', k.netProfit >= 0 ? 'pos' : 'neg') +
      kpi('Saldo disponível', m(k.available), 'caixa/banco/carteiras (fora da reserva)') +
      kpi('Patrimônio consolidado', m(k.consolidated), 'inclui a reserva da meta') +
      kpi('Total investido', m(k.investments), 'equipamentos e melhorias (não é despesa)') +
      kpi('Dívidas', m(k.debts), 'contas e despesas em aberto', k.debts > 0 ? 'neg' : '') +
      kpi('Valor acumulado', m(g.accumulated), 'meta — reserva efetiva, não faturamento') +
      kpi('Margem de lucro', U.pct(k.margin), 'lucro líquido ÷ faturamento') +
      '</div>';

    html += '<div class="section-title"><h2>Meta financeira</h2><div class="line"></div></div>';
    html += '<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
      '<div><b>' + m(g.accumulated) + '</b> de ' + m(g.amount) + '</div><div class="muted">' + U.pct(g.percent, 0) + ' concluído</div></div>' +
      '<div class="progress"><i style="width:' + Math.min(100, Math.max(0, g.percent)).toFixed(1) + '%"></i></div>' +
      '<div class="grid g4">' +
      kpi('Falta', m(g.remaining), 'para atingir a meta') +
      kpi('Por mês', m(g.perMonth), g.daysLeft + ' dias restantes') +
      kpi('Por semana', m(g.perWeek), '') +
      kpi('Por dia', m(g.perDay), '') +
      '</div><div class="hintbox" style="margin-top:10px">Projeção: <b>' +
      (g.projection ? d(g.projection) + (g.onTrack ? ' · no ritmo planejado' : ' · abaixo do ritmo planejado') : 'indisponível (sem movimentações suficientes)') +
      '</b>. Ritmo atual: ' + m(g.avgPerDay) + '/dia. <button class="btn ghost small" data-act="go" data-route="goal">Abrir meta</button></div></div>';

    html += '<div class="section-title"><h2>Comercial</h2><div class="line"></div></div>';
    html += '<div class="kpis">' +
      kpi('Garrafas / unidades', String(k.unitsSold), 'quantidade vendida no período') +
      kpi('Vendas realizadas', String(k.salesCount), k.cancelled + ' cancelada(s)') +
      kpi('Ticket médio', m(k.ticketMedio), 'faturamento ÷ vendas') +
      kpi('Preço médio', m(k.avgPrice), 'faturamento ÷ unidades') +
      kpi('Produto mais vendido', h(k.bestProductName || '—'), k.bestProduct ? m(k.bestProduct.revenue) + ' faturados' : '') +
      kpi('Melhor dia', k.bestDay ? d(k.bestDay) : '—', k.bestDay ? m(k.byDay[k.bestDay]) : '') +
      kpi('Média diária', m(k.dailyAverage), 'nos dias com vendas') +
      kpi('Estoque em valor', m(k.stockValue), 'qtd × custo unitário') +
      '</div>';

    html += '<div class="grid g2" style="margin-top:12px">' +
      barChart('Faturamento por dia', k.byDay) +
      barChart('Faturamento por produto', Object.keys(k.byProduct).reduce(function (a, x) { a[x] = k.byProduct[x].revenue; return a; }, {})) +
      barChart('Por forma de pagamento', k.byPayment) +
      barChart('Despesas por categoria', Object.keys(A.CATEGORIES).reduce(function (a, key) {
        var total = A.list('expenses').filter(function (e) { return e.categoryKey === key && e.status === 'pago' && (!from || (e.paymentDate || e.purchaseDate) >= from) && (!to || (e.paymentDate || e.purchaseDate) <= to); });
        a[A.CATEGORIES[key].label] = C.sum(total, 'amount'); return a;
      }, {}), m, true) +
      '</div>';

    var alerts = [];
    if (stock.low.length) alerts.push(badge(stock.low.length + ' item(ns) com estoque baixo', 'warn') + ' <button class="btn ghost small" data-act="go" data-route="stock">Ver</button>');
    if (stock.expiring.length) alerts.push(badge(stock.expiring.length + ' item(ns) perto do vencimento', 'warn'));
    if (due.length) alerts.push(badge(due.length + ' conta(s) vence(m) em 7 dias', 'bad') + ' <button class="btn ghost small" data-act="go" data-route="bills">Ver</button>');
    var settle = C.settlePartners(s);
    if (settle.length) alerts.push(badge(settle.length + ' acerto(s) entre sócios pendente(s)', 'warn') + ' <button class="btn ghost small" data-act="go" data-route="partners">Ver</button>');
    if (alerts.length) html += '<div class="section-title"><h2>Alertas</h2><div class="line"></div></div><div class="card"><div class="list">' +
      alerts.map(function (a) { return '<div class="row"><span class="grow">' + a + '</span></div>'; }).join('') + '</div></div>';
    return html;
  };

  /* ---------- Vendas ---------- */
  V.sales = function (s, ui) {
    var f = ui.f;
    var sales = C.active(C.salesIn(s, f.from, f.to));
    if (f.payment) sales = sales.filter(function (x) { return x.paymentMethod === f.payment; });
    if (f.location) sales = sales.filter(function (x) { return (x.location || '').toLowerCase().indexOf(f.location.toLowerCase()) >= 0; });
    if (f.product) sales = sales.filter(function (x) { return (x.items || []).some(function (i) { return (i.name || '').toLowerCase().indexOf(f.product.toLowerCase()) >= 0; }); });
    if (f.status === 'cancelada') sales = C.active(s.sales).filter(function (x) { return x.status === 'cancelada' && C.inRange(x.dateTime, f.from, f.to); });
    if (f.q) sales = sales.filter(function (x) { return JSON.stringify(x).toLowerCase().indexOf(f.q.toLowerCase()) >= 0; });
    sales.sort(function (a, b) { return String(b.dateTime).localeCompare(String(a.dateTime)); });
    var total = C.sum(sales, 'total');

    var html = head('Vendas', sales.length + ' registro(s) · ' + m(total) + ' no filtro',
      '<button class="btn" data-act="new-sale">Nova venda</button><button class="btn ghost" data-act="quick-sale">Venda rápida</button>' +
      '<button class="btn ghost" data-act="export-sales">CSV</button>');
    html += filterBox([
      { label: 'De', html: inp('f-from', f.from, 'date') },
      { label: 'Até', html: inp('f-to', f.to, 'date') },
      { label: 'Produto', html: inp('f-product', f.product, 'text', 'ex.: açaí 500ml') },
      { label: 'Pagamento', html: sel('f-payment', [''].concat(A.PAYMENTS), f.payment) },
      { label: 'Local', html: inp('f-location', f.location, 'text', 'praia, rua…') },
      { label: 'Situação', html: sel('f-status', [{ v: '', l: 'Todas ativas' }, { v: 'cancelada', l: 'Canceladas' }], f.status) }
    ]);
    if (!sales.length) return html + empty('Nenhuma venda registrada neste filtro.', 'sales');
    html += '<div class="list">' + sales.map(function (x) {
      var itens = (x.items || []).map(function (i) { return h(i.qty) + '× ' + h(i.name); }).join(', ');
      return '<div class="row"><div class="grow"><div class="title">#' + h(String(x.code || x.id).slice(-8)) + ' · ' + dt(x.dateTime) + '</div>' +
        '<div class="meta">' + itens + ' · ' + h(x.paymentMethod) + ' · ' + h(x.location || 'sem local') + '</div>' +
        '<div>' + statusBadge(x.status) + (x.payerPartnerName ? ' ' + badge('Resp.: ' + x.payerPartnerName) : '') + '</div></div>' +
        '<div class="right"><div class="amount ' + (x.status === 'cancelada' ? '' : 'in') + '">' + m(x.total) + '</div>' +
        '<div class="acts" style="margin-top:6px;justify-content:flex-end">' +
        '<button class="btn ghost small" data-act="receipt" data-id="' + x.id + '">Resumo</button>' +
        (x.status !== 'cancelada' ? '<button class="btn ghost small" data-act="cancel-sale" data-id="' + x.id + '">Cancelar</button>' : '') +
        '</div></div></div>';
    }).join('') + '</div>';
    return html;
  };

  /* ---------- Entradas ---------- */
  V.entries = function (s, ui) {
    var f = ui.f;
    var list = C.active(C.entriesIn(s, f.from, f.to));
    if (f.category) list = list.filter(function (e) { return e.category === f.category; });
    if (f.q) list = list.filter(function (e) { return JSON.stringify(e).toLowerCase().indexOf(f.q.toLowerCase()) >= 0; });
    list.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var derived = ui.showDerived !== false;
    var salesAsEntries = derived ? C.salesIn(s, f.from, f.to).map(function (x) {
      return { id: 'v-' + x.id, date: String(x.dateTime).slice(0, 10), description: 'Venda #' + String(x.code || x.id).slice(-6), category: 'Vendas (automático)', amount: x.total, method: x.paymentMethod, source: x.location || 'Venda', readOnly: true };
    }) : [];
    var all = list.concat(salesAsEntries).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var html = head('Entradas', 'Vendas entram aqui automaticamente como somente leitura — não são cadastradas duas vezes',
      '<button class="btn" data-act="new-entry">Nova entrada</button><button class="btn ghost" data-act="export-entries">CSV</button>');
    html += filterBox([
      { label: 'De', html: inp('f-from', f.from, 'date') },
      { label: 'Até', html: inp('f-to', f.to, 'date') },
      { label: 'Categoria', html: sel('f-category', [''].concat(A.ENTRY_CATEGORIES), f.category) },
      { label: 'Buscar', html: inp('f-q', f.q, 'text', 'descrição…') }
    ]);
    html += '<label class="checkline" style="margin-bottom:10px"><input type="checkbox" data-act="toggle-derived"' + (derived ? ' checked' : '') + '> Mostrar vendas como entradas (somente leitura)</label>';
    if (!all.length) return html + empty('Nenhuma entrada no período.', 'entries');
    html += '<div class="list">' + all.map(function (e) {
      return '<div class="row"><div class="grow"><div class="title">' + h(e.description) + '</div>' +
        '<div class="meta">' + d(e.date) + ' · ' + h(e.category) + ' · ' + h(e.method || '') + (e.source ? ' · origem: ' + h(e.source) : '') + '</div>' +
        (e.notes ? '<div class="meta">' + h(e.notes) + '</div>' : '') +
        (e.attachments && e.attachments.length ? '<a class="tiny" href="' + e.attachments[0] + '" download="comprovante">' + Icon('paperclip', 13) + ' comprovante</a>' : '') +
        '</div><div class="right"><div class="amount in">' + m(e.amount) + '</div>' +
        (e.readOnly ? '<div class="tiny muted">automático</div>' : '<div class="acts" style="margin-top:6px;justify-content:flex-end">' +
          '<button class="btn ghost small" data-act="edit-entry" data-id="' + e.id + '">Editar</button>' +
          '<button class="btn ghost small" data-act="delete-record" data-entity="entries" data-id="' + e.id + '">Excluir</button></div>') +
        '</div></div>';
    }).join('') + '</div>';
    return html;
  };

  /* ---------- Despesas ---------- */
  V.expenses = function (s, ui) {
    var f = ui.f;
    var list = A.list('expenses').filter(function (e) { return C.inRange(e.paymentDate || e.purchaseDate, f.from, f.to); });
    if (f.category) list = list.filter(function (e) { return e.categoryKey === f.category; });
    if (f.status) list = list.filter(function (e) { return e.status === f.status; });
    if (f.payer) list = list.filter(function (e) { return (e.payerPartnerId || 'empresa') === f.payer; });
    if (f.q) list = list.filter(function (e) { return JSON.stringify(e).toLowerCase().indexOf(f.q.toLowerCase()) >= 0; });
    list.sort(function (a, b) { return String(b.paymentDate || b.purchaseDate).localeCompare(String(a.paymentDate || a.purchaseDate)); });
    var total = C.sum(list, 'amount');
    var partnerOpts = [{ v: '', l: 'Todos os pagadores' }, { v: 'empresa', l: 'Caixa da empresa' }].concat(A.list('partners').map(function (p) { return { v: p.id, l: p.name }; }));
    var html = head('Despesas', list.length + ' registro(s) · ' + m(total) + ' (inclui investimentos)',
      '<button class="btn" data-act="new-expense">Nova despesa</button><button class="btn ghost" data-act="export-expenses">CSV</button>');
    html += filterBox([
      { label: 'De', html: inp('f-from', f.from, 'date') },
      { label: 'Até', html: inp('f-to', f.to, 'date') },
      { label: 'Categoria', html: '<select id="f-category">' + U.categoryOptions(f.category) + '</select>' },
      { label: 'Status', html: sel('f-status', [{ v: '', l: 'Todos' }, { v: 'pago', l: 'Pago' }, { v: 'pendente', l: 'Pendente' }, { v: 'parcial', l: 'Parcial' }], f.status) },
      { label: 'Pagador', html: sel('f-payer', partnerOpts, f.payer) },
      { label: 'Buscar', html: inp('f-q', f.q, 'text', 'descrição, fornecedor…') }
    ]);
    if (!list.length) return html + empty('Nenhuma despesa no filtro.', 'expenses');
    html += '<div class="list">' + list.map(function (e) {
      var payer = e.payerType === 'parceiro' ? (A.get('partners', e.payerPartnerId) || {}).name || 'Sócio' : 'Empresa';
      var g = A.CATEGORIES[e.categoryKey] || { label: e.category };
      return '<div class="row"><div class="grow"><div class="title">' + h(e.name) + '</div>' +
        '<div class="meta">' + d(e.paymentDate || e.purchaseDate) + ' · ' + h(g.label) + (e.supplierName ? ' · ' + h(e.supplierName) : '') + '</div>' +
        '<div>' + statusBadge(e.status) + ' ' + badge('Pago por: ' + payer, e.payerType === 'parceiro' ? '' : 'ok') +
        (e.split && e.split.length > 1 ? ' ' + badge('Compartilhada') : '') +
        (e.purchaseId ? ' ' + badge('Compra vinculada') : '') + '</div></div>' +
        '<div class="right"><div class="amount out">' + m(e.amount) + '</div><div class="acts" style="margin-top:6px;justify-content:flex-end">' +
        '<button class="btn ghost small" data-act="edit-expense" data-id="' + e.id + '">Editar</button>' +
        '<button class="btn ghost small" data-act="pay-expense" data-id="' + e.id + '">' + (e.status === 'pago' ? 'Editar pago' : 'Marcar pago') + '</button>' +
        '</div></div></div>';
    }).join('') + '</div>';
    return html;
  };

  /* ---------- Fluxo de caixa ---------- */
  V.cashflow = function (s, ui) {
    var per = ui.cashPeriod || 'month';
    var today = U.today();
    var from = per === 'day' ? today : per === 'week' ? U.addDays(today, -6) : per === 'month' ? today.slice(0, 7) + '-01' : per === 'year' ? today.slice(0, 4) + '-01-01' : (ui.f.from || today.slice(0, 7) + '-01');
    var to = per === 'custom' ? (ui.f.to || today) : today;
    var moves = [];
    C.active(s.sales).forEach(function (x) { if (x.status !== 'cancelada' && C.inRange(x.dateTime, from, to)) moves.push({ date: x.dateTime, type: 'in', label: 'Venda #' + String(x.code || x.id).slice(-6), amount: x.total, account: x.accountId, ref: x.id }); });
    C.active(s.entries).forEach(function (x) { if (C.inRange(x.date, from, to)) moves.push({ date: x.date, type: 'in', label: x.description, amount: x.amount, account: x.accountId, ref: x.id }); });
    C.active(s.expenses).forEach(function (x) { if (x.status === 'pago' && x.payerType !== 'parceiro' && C.inRange(x.paymentDate || x.purchaseDate, from, to)) moves.push({ date: x.paymentDate || x.purchaseDate, type: 'out', label: x.name, amount: x.amount, account: x.accountId, ref: x.id }); });
    C.active(s.transfers).forEach(function (x) { if (C.inRange(x.date, from, to)) {
      moves.push({ date: x.date, type: 'transfer', label: '→ ' + (A.get('accounts', x.toAccountId) || {}).name, amount: -x.amount, account: x.fromAccountId, ref: x.id });
      moves.push({ date: x.date, type: 'transfer', label: '← ' + (A.get('accounts', x.fromAccountId) || {}).name, amount: x.amount, account: x.toAccountId, ref: x.id });
    } });
    C.active(s.goalMovements).forEach(function (x) { if (C.inRange(x.date, from, to)) moves.push({ date: x.date, type: 'transfer', label: (x.type === 'deposito' ? 'Reserva da meta' : 'Retirada da meta'), amount: x.type === 'deposito' ? -x.amount : x.amount, account: x.accountId || 'acc-caixa', ref: x.id }); });
    C.active(s.bills).forEach(function (x) { if (x.status === 'pago' && !x.expenseId && C.inRange(x.paidDate, from, to)) moves.push({ date: x.paidDate, type: x.type === 'pagar' ? 'out' : 'in', label: x.description, amount: x.amount, account: x.accountId, ref: x.id }); });
    moves.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var bal = C.accountBalances(s);
    var inflow = C.sum(moves.filter(function (x) { return x.type === 'in'; }), 'amount');
    var outflow = C.sum(moves.filter(function (x) { return x.type === 'out'; }), 'amount');
    var opening = C.sum(C.active(s.accounts), 'openingBalance');
    var proj = C.profitProjection(s, from, to);
    var lastCount = C.active(s.cashCounts).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })[0];

    var html = head('Fluxo de caixa', 'Movimentações efetivamente realizadas · transferências separadas de receitas/despesas',
      '<button class="btn ghost" data-act="new-transfer">Transferir</button><button class="btn ghost" data-act="new-count">Conciliação</button><button class="btn ghost" data-act="export-cashflow">CSV</button>');
    html += segment([
      { group: 'cashPeriod', value: 'day', label: 'Diário' }, { group: 'cashPeriod', value: 'week', label: 'Semanal' },
      { group: 'cashPeriod', value: 'month', label: 'Mensal' }, { group: 'cashPeriod', value: 'year', label: 'Anual' },
      { group: 'cashPeriod', value: 'custom', label: 'Personalizado' }
    ], per);
    if (per === 'custom') html += periodFilters(ui.f);
    html += '<div class="kpis">' +
      kpi('Saldo inicial', m(opening), 'saldos iniciais cadastrados') +
      kpi('Entradas realizadas', m(inflow), 'no período', 'pos') +
      kpi('Saídas realizadas', m(outflow), 'no período', 'neg') +
      kpi('Saldo final', m(C.sum(Object.keys(bal).map(function (k) { return bal[k]; }))), 'consolidado', 'accent') +
      '</div>';
    html += '<div class="card"><h2>Saldos por conta</h2><div class="list">' +
      A.list('accounts').map(function (a) {
        return '<div class="row"><span class="grow"><div class="title">' + h(a.name) + '</div><div class="meta">' + h(a.type) + '</div></span>' +
          '<span class="amount ' + (bal[a.id] >= 0 ? 'in' : 'out') + '">' + m(bal[a.id]) + '</span></div>';
      }).join('') + '</div></div>';
    html += '<div class="card"><h2>Conciliação de caixa</h2>' + (lastCount ?
      '<div class="grid g3">' + kpi('Sistema', m(lastCount.systemBalance), d(lastCount.date)) +
      kpi('Contado', m(lastCount.countedBalance), '') + kpi('Diferença', m(C.round2(lastCount.countedBalance - lastCount.systemBalance)), Math.abs(lastCount.countedBalance - lastCount.systemBalance) > 0.01 ? 'verificar' : 'ok') + '</div>' :
      empty('Nenhuma conferência registrada.', 'search')) +
      '<button class="btn ghost small" style="margin-top:10px" data-act="new-count">Registrar conferência</button></div>';
    html += '<div class="card"><h2>Projeção (estimativa)</h2><div class="hintbox">Custos fixos do período: <b>' + m(proj.fixedCosts) + '</b> · margem por unidade: <b>' + m(proj.contribution) + '</b> · ponto de equilíbrio: <b>' +
      (proj.breakEvenUnits === null ? 'indisponível (margem ≤ 0)' : proj.breakEvenUnits + ' unidades / ' + m(proj.breakEvenRevenue)) +
      '</b>. ' + (proj.needsWorkingCapital ? 'Atenção: saldo disponível abaixo dos custos fixos do período.' : 'Saldo disponível cobre os custos fixos do período.') + '</div></div>';
    html += '<div class="card"><h2>Extrato</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Movimentação</th><th>Conta</th><th class="num">Valor</th></tr></thead><tbody>' +
      (moves.length ? moves.map(function (x) {
        return '<tr><td>' + dt(x.date) + '</td><td>' + h(x.label) + (x.type === 'transfer' ? ' ' + badge('_transferência_', '') : '') + '</td>' +
          '<td>' + h((A.get('accounts', x.account) || {}).name || '—') + '</td><td class="num" style="color:' + (x.type === 'transfer' ? 'inherit' : x.type === 'in' ? 'var(--ok)' : 'var(--danger)') + '">' +
          (x.type === 'out' ? '− ' : '') + m(Math.abs(x.amount)) + '</td></tr>';
      }).join('') : '<tr><td colspan="4">' + empty('Sem movimentações no período.') + '</td></tr>') + '</tbody></table></div></div>';
    return html.replace(/_transferência_/g, 'transferência');
  };

  /* ---------- Estoque ---------- */
  V.stock = function (s, ui) {
    var st = C.stockStatus(s);
    var movs = A.list('stockMovements').sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 60);
    var html = head('Estoque', st.items.length + ' item(ns) · valor total ' + m(st.totalValue),
      '<button class="btn" data-act="new-stock-item">Novo item</button><button class="btn ghost" data-act="new-movement">Movimentar</button>' +
      '<button class="btn ghost" data-act="new-production">Produzir</button>');
    if (st.low.length || st.expiring.length) {
      html += '<div class="card soft"><h2>Alertas</h2><div class="list">' +
        st.low.map(function (i) { return '<div class="row"><span class="grow"><b>' + h(i.name) + '</b><div class="meta">Estoque ' + U.num(i.qty) + ' ' + h(i.unit) + ' · mínimo ' + U.num(i.minQty) + '</div></span>' + badge('Baixo', 'warn') + '</div>'; }).join('') +
        st.expiring.map(function (i) { return '<div class="row"><span class="grow"><b>' + h(i.name) + '</b><div class="meta">Vence em ' + d(i.expiry) + '</div></span>' + badge('Vencimento', 'warn') + '</div>'; }).join('') + '</div></div>';
    }
    html += '<div class="card"><h2>Itens</h2>' + (st.items.length ? '<div class="table-wrap"><table><thead><tr><th>Item</th><th>Un.</th><th class="num">Qtd.</th><th class="num">Mín.</th><th class="num">Custo</th><th class="num">Total</th><th></th></tr></thead><tbody>' +
      st.items.map(function (i) {
        return '<tr><td><b>' + h(i.name) + '</b><div class="tiny muted">' + h((A.get('suppliers', i.supplierId) || {}).name || '') + (i.expiry ? ' · vence ' + d(i.expiry) : '') + '</div></td>' +
          '<td>' + h(i.unit) + '</td><td class="num">' + U.num(i.qty) + '</td><td class="num">' + U.num(i.minQty) + '</td><td class="num">' + m(i.unitCost) + '</td><td class="num">' + m(i.qty * i.unitCost) + '</td>' +
          '<td><button class="btn ghost small" data-act="edit-stock-item" data-id="' + i.id + '">Editar</button></td></tr>';
      }).join('') + '</tbody></table></div>' : empty('Cadastre os insumos e embalagens.', 'stock')) + '</div>';
    html += '<div class="card"><h2>Histórico de movimentações</h2>' + table(
      [{ t: 'Data' }, { t: 'Item' }, { t: 'Tipo' }, { t: 'Motivo' }, { t: 'Qtd.', num: true }, { t: 'Custo', num: true }],
      movs.map(function (x) {
        return ['<td>' + d(x.date) + '</td>', '<td>' + h((A.get('stockItems', x.itemId) || {}).name || '—') + '</td>',
          '<td>' + badge(x.type, x.type === 'entrada' || x.type === 'producao' ? 'ok' : x.type === 'perda' ? 'bad' : '') + '</td>',
          '<td>' + h(x.reason || '') + '</td>', '<td class="num">' + U.num(x.qty) + '</td>', '<td class="num">' + m(x.unitCost * x.qty) + '</td>'].join('');
      })) + '</div>';
    return html;
  };

  /* ---------- Produtos e custos ---------- */
  V.products = function (s, ui) {
    var prods = A.list('products');
    var html = head('Produtos e custos', 'Fichas técnicas calculam o custo real a partir dos insumos',
      '<button class="btn" data-act="new-product">Novo produto</button><button class="btn ghost" data-act="recalc-costs">Recalcular custos</button>');
    if (!prods.length) return html + empty('Cadastre um produto e sua ficha técnica.', 'products');
    html += '<div class="list">' + prods.map(function (p) {
      return '<div class="card" style="margin-bottom:10px"><div style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap">' +
        '<div class="grow"><h2>' + h(p.name) + '</h2><div class="muted tiny">' + h(p.category || '') + '</div></div>' +
        '<button class="btn ghost small" data-act="edit-product" data-id="' + p.id + '">Editar</button>' +
        '<button class="btn ghost small" data-act="delete-record" data-entity="products" data-id="' + p.id + '">Excluir</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Versão</th><th class="num">Preço</th><th class="num">Custo</th><th class="num">Lucro/un</th><th class="num">Margem</th><th class="num">P/ lucro alvo</th><th></th></tr></thead><tbody>' +
        (p.variants || []).map(function (v) {
          var cost = C.recipeCost(s, p.id, v.id);
          var profit = C.round2(v.salePrice - cost);
          var margin = v.salePrice ? C.round2(profit / v.salePrice * 100) : 0;
          var target = profit > 0 ? Math.ceil(1000 / profit) : '—';
          return '<tr><td><b>' + h(v.name) + '</b><div class="tiny muted">' + h(v.volume || '') + '</div></td><td class="num">' + m(v.salePrice) + '</td>' +
            '<td class="num">' + m(cost) + '</td><td class="num" style="color:' + (profit >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' + m(profit) + '</td>' +
            '<td class="num">' + U.pct(margin) + '</td><td class="num">' + target + ' un</td>' +
            '<td><button class="btn ghost small" data-act="edit-recipe" data-product="' + p.id + '" data-variant="' + v.id + '">Ficha técnica</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }).join('') + '</div>';
    html += '<div class="hintbox">"P/ lucro alvo" mostra quantas unidades são necessárias para R$ 1.000 de lucro bruto, usando a margem atual (estimativa).</div>';
    return html;
  };

  /* ---------- Compras ---------- */
  V.purchases = function (s, ui) {
    var f = ui.f;
    var list = A.list('purchases').filter(function (p) { return C.inRange(p.date, f.from, f.to); });
    if (f.supplier) list = list.filter(function (p) { return p.supplierId === f.supplier; });
    if (f.q) list = list.filter(function (p) { return JSON.stringify(p).toLowerCase().indexOf(f.q.toLowerCase()) >= 0; });
    list.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var suppliers = A.list('suppliers');
    var html = head('Compras e fornecedores', list.length + ' compra(s) · ' + m(C.sum(list, 'total')),
      '<button class="btn" data-act="new-purchase">Nova compra</button><button class="btn ghost" data-act="new-supplier">Fornecedor</button>');
    html += filterBox([
      { label: 'De', html: inp('f-from', f.from, 'date') }, { label: 'Até', html: inp('f-to', f.to, 'date') },
      { label: 'Fornecedor', html: sel('f-supplier', [''].concat(suppliers.map(function (x) { return { v: x.id, l: x.name }; })), f.supplier) },
      { label: 'Buscar', html: inp('f-q', f.q, 'text', 'nota, descrição…') }
    ]);
    html += '<div class="card"><h2>Fornecedores cadastrados</h2>' + (suppliers.length ? '<div class="list">' + suppliers.map(function (x) {
      var spent = C.sum(A.list('purchases').filter(function (p) { return p.supplierId === x.id; }), 'total');
      return '<div class="row"><span class="grow"><div class="title">' + h(x.name) + '</div><div class="meta">' + h(x.contact || '') + ' · ' + h(x.products || '') + '</div></span>' +
        '<span class="amount">' + m(spent) + '</span><button class="btn ghost small" data-act="edit-supplier" data-id="' + x.id + '">Editar</button></div>';
    }).join('') + '</div>' : empty('Nenhum fornecedor cadastrado.')) + '</div>';
    html += '<div class="card"><h2>Histórico de compras</h2>' + table(
      [{ t: 'Data' }, { t: 'Fornecedor' }, { t: 'Itens' }, { t: 'Despesa' }, { t: 'Total', num: true }],
      list.map(function (p) {
        return ['<td>' + d(p.date) + '</td>', '<td>' + h((A.get('suppliers', p.supplierId) || {}).name || '—') + '</td>',
          '<td>' + h((p.items || []).map(function (i) { return i.qty + '× ' + (A.get('stockItems', i.stockItemId) || {}).name; }).join(', ')) + '</td>',
          '<td>' + (p.expenseId ? badge('Vinculada', 'ok') : badge('Sem despesa', 'warn')) + '</td>',
          '<td class="num">' + m(p.total) + '</td>'].join('');
      })) + '</div>';
    return html;
  };

  /* ---------- Contas a pagar/receber ---------- */
  V.bills = function (s, ui) {
    var type = ui.billType || 'pagar';
    var today = U.today();
    var list = A.list('bills').filter(function (b) { return b.type === type; });
    if (ui.f.status) list = list.filter(function (b) { return b.status === ui.f.status; });
    list.sort(function (a, b) { return String(a.dueDate).localeCompare(String(b.dueDate)); });
    var total = C.sum(list, 'amount');
    var html = head(type === 'pagar' ? 'Contas a pagar' : 'Contas a receber', list.length + ' lançamento(s) · ' + m(total),
      '<button class="btn" data-act="new-bill">Nova conta</button>');
    html += segment([
      { group: 'billType', value: 'pagar', label: 'A pagar' }, { group: 'billType', value: 'receber', label: 'A receber' }
    ], type);
    html += filterBox([{ label: 'Status', html: sel('f-status', [{ v: '', l: 'Todos' }, { v: 'pendente', l: 'Pendente' }, { v: 'pago', l: 'Pago' }], ui.f.status) }]);
    var overdue = list.filter(function (b) { return b.status !== 'pago' && b.dueDate < today; }).length;
    if (overdue) html += '<div class="card soft"><b style="color:var(--danger)">' + overdue + ' conta(s) atrasada(s)</b></div>';
    html += '<div class="list">' + (list.length ? list.map(function (b) {
      var late = b.status !== 'pago' && b.dueDate < today;
      return '<div class="row"><div class="grow"><div class="title">' + h(b.description) + '</div>' +
        '<div class="meta">' + h(b.person || '') + ' · vence ' + d(b.dueDate) + (b.installments ? ' · ' + b.installments + 'x' : '') + '</div>' +
        '<div>' + statusBadge(late ? 'atrasado' : b.status) + (b.expenseId ? ' ' + badge('Despesa vinculada') : '') + '</div></div>' +
        '<div class="right"><div class="amount">' + m(b.amount) + '</div><div class="acts" style="margin-top:6px;justify-content:flex-end">' +
        (b.status !== 'pago' ? '<button class="btn ghost small" data-act="pay-bill" data-id="' + b.id + '">' + (type === 'pagar' ? 'Pagar' : 'Receber') + '</button>' : '') +
        '<button class="btn ghost small" data-act="delete-record" data-entity="bills" data-id="' + b.id + '">Excluir</button></div></div></div>';
    }).join('') : empty('Nenhuma conta nesta lista.', 'bills')) + '</div>';
    return html;
  };

  /* ---------- Relatórios ---------- */
  V.reports = function (s, ui) {
    var r = ui.report || 'dre';
    var from = ui.f.from || U.today().slice(0, 7) + '-01', to = ui.f.to || U.today();
    var k = C.metrics(s, from, to);
    var reports = {
      dre: 'Demonstrativo de resultados (DRE gerencial)', cashflow: 'Fluxo de caixa', revenues: 'Receitas',
      expenses: 'Despesas', investments: 'Investimentos', debts: 'Dívidas', netprofit: 'Lucro líquido',
      margin: 'Margem de lucro', equity: 'Evolução patrimonial', saledays: 'Vendas por dia',
      topproducts: 'Produtos mais vendidos', byproduct: 'Faturamento por produto', ticket: 'Ticket médio',
      location: 'Vendas por localização', payment: 'Vendas por forma de pagamento',
      consumption: 'Consumo de estoque', losses: 'Perdas e desperdícios', purchases: 'Compras realizadas',
      production: 'Custos de produção', performance: 'Desempenho dos produtos'
    };
    var html = head('Relatórios', 'Dados reais do sistema · filtre e exporte',
      '<button class="btn ghost" data-act="print-report">PDF (imprimir)</button><button class="btn ghost" data-act="export-report-csv">CSV</button><button class="btn ghost" data-act="export-json">JSON</button>');
    html += filterBox([
      { label: 'Relatório', html: sel('f-report', Object.keys(reports).map(function (x) { return { v: x, l: reports[x] }; }), r) },
      { label: 'De', html: inp('f-from', from, 'date') }, { label: 'Até', html: inp('f-to', to, 'date') },
      { label: 'Categoria', html: '<select id="f-category">' + U.categoryOptions(ui.f.category) + '</select>' }
    ]);
    html += '<div class="card" id="report-area">';
    html += '<div style="border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:10px">' +
      '<b>' + h(s.meta.businessName || 'Negócio') + '</b><div class="muted tiny">' + reports[r] + ' · ' + d(from) + ' a ' + d(to) + ' · gerado em ' + dt(U.nowDT()) + '</div></div>';
    var rows = [];
    if (r === 'dre') rows = C.dre(s, from, to).map(function (x) { return [x[0], x[1]]; });
    else if (r === 'cashflow') {
      rows = [['Saldo inicial', C.sum(C.active(s.accounts), 'openingBalance')], ['Entradas realizadas', k.totalIn], ['Saídas realizadas', -k.totalOut], ['Saldo final', k.consolidated], ['Contas a pagar (em aberto)', -k.debts], ['Contas a receber (em aberto)', k.receivables]];
    } else if (r === 'revenues') rows = [['Faturamento de vendas', k.revenue], ['Entradas manuais', k.entriesManual], ['Total de entradas', k.totalIn]];
    else if (r === 'expenses') rows = A.list('expenses').filter(function (e) { return C.inRange(e.paymentDate || e.purchaseDate, from, to); }).map(function (e) { return [d(e.paymentDate || e.purchaseDate) + ' — ' + e.name, e.amount]; });
    else if (r === 'investments') rows = A.list('expenses').filter(function (e) { return e.categoryKey === 'investimentos' && C.inRange(e.paymentDate, from, to); }).map(function (e) { return [d(e.paymentDate) + ' — ' + e.name, e.amount]; });
    else if (r === 'debts') rows = [['Dívidas em aberto', k.debts], ['Contas a receber', k.receivables]];
    else if (r === 'netprofit') rows = [['Lucro bruto', k.grossProfit], ['Despesas e impostos', -(k.grossProfit - k.netProfit)], ['Lucro líquido', k.netProfit], ['Margem %', k.margin]];
    else if (r === 'margin') rows = [['Faturamento', k.revenue], ['Custo dos produtos', k.cogs], ['Lucro bruto', k.grossProfit], ['Margem bruta %', k.grossMargin], ['Margem líquida %', k.margin]];
    else if (r === 'equity') rows = [['Saldos consolidados', k.consolidated], ['Reserva da meta', C.goalStatus(s).accumulated], ['Estoque (valor)', k.stockValue], ['Dívidas', -k.debts]];
    else if (r === 'saledays') rows = Object.keys(k.byDay).sort().map(function (x) { return [d(x), k.byDay[x]]; });
    else if (r === 'topproducts' || r === 'byproduct' || r === 'performance') rows = Object.keys(k.byProduct).map(function (x) { var p = k.byProduct[x]; return [x + ' (' + p.qty + ' un)', r === 'performance' ? p.margin : p.revenue]; }).sort(function (a, b) { return b[1] - a[1]; });
    else if (r === 'ticket') rows = [['Vendas', k.salesCount], ['Unidades', k.unitsSold], ['Ticket médio', k.ticketMedio], ['Preço médio', k.avgPrice]];
    else if (r === 'location') rows = Object.keys(k.byLocation).map(function (x) { return [x, k.byLocation[x]]; });
    else if (r === 'payment') rows = Object.keys(k.byPayment).map(function (x) { return [x, k.byPayment[x]]; });
    else if (r === 'consumption') rows = A.list('stockMovements').filter(function (x) { return ['saida', 'producao', 'venda'].indexOf(x.type) >= 0 && C.inRange(x.date, from, to); }).map(function (x) { return [(A.get('stockItems', x.itemId) || {}).name || '—', x.qty]; });
    else if (r === 'losses') rows = A.list('stockMovements').filter(function (x) { return x.type === 'perda' && C.inRange(x.date, from, to); }).map(function (x) { return [d(x.date) + ' — ' + x.reason, x.qty]; });
    else if (r === 'purchases') rows = A.list('purchases').filter(function (x) { return C.inRange(x.date, from, to); }).map(function (x) { return [d(x.date) + ' — ' + ((A.get('suppliers', x.supplierId) || {}).name || ''), x.total]; });
    else if (r === 'production') rows = Object.keys(k.byProduct).map(function (x) { return [x, k.byProduct[x].cost]; });
    html += table([{ t: 'Indicador' }, { t: 'Valor', num: true }], rows.map(function (x) {
      var isPct = /%$/.test(String(x[0]));
      return '<tr><td>' + h(x[0]) + '</td><td class="num">' + (isPct ? U.pct(x[1]) : typeof x[1] === 'number' ? m(x[1]) : h(x[1])) + '</td></tr>';
    }));
    html += '<div class="hintbox" style="margin-top:10px">Resumo: faturamento ' + m(k.revenue) + ' · lucro líquido ' + m(k.netProfit) + ' · saldo disponível ' + m(k.available) + ' · acumulado da meta ' + m(C.goalStatus(s).accumulated) + '.</div></div>';
    return html;
  };

  /* ---------- Meta ---------- */
  V.goal = function (s, ui) {
    var g = C.goalStatus(s);
    var html = head('Meta financeira', 'A meta considera dinheiro efetivamente reservado — não faturamento',
      '<button class="btn" data-act="goal-deposit">Registrar aporte</button><button class="btn ghost" data-act="goal-withdraw">Registrar retirada</button><button class="btn ghost" data-act="edit-goal">Configurar meta</button>');
    html += '<div class="card"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><div><b style="font-size:22px">' + m(g.accumulated) + '</b><div class="muted tiny">de ' + m(g.amount) + '</div></div><div class="right"><b>' + U.pct(g.percent, 0) + '</b><div class="muted tiny">' + d(g.start) + ' → ' + d(g.end) + '</div></div></div>' +
      '<div class="progress"><i style="width:' + Math.min(100, Math.max(0, g.percent)).toFixed(1) + '%"></i></div>' +
      '<div class="grid g4">' +
      kpi('Falta', m(g.remaining), '') + kpi('Por mês', m(g.perMonth), g.daysLeft + ' dias restantes') +
      kpi('Por semana', m(g.perWeek), '') + kpi('Por dia', m(g.perDay), '') + '</div></div>';
    html += '<div class="card"><h2>Projeção e ritmo</h2><div class="grid g3">' +
      kpi('Ritmo atual', m(g.avgPerDay) + '/dia', g.elapsedDays + ' dias desde o início') +
      kpi('Esperado até hoje', m(g.expected), g.onTrack ? 'Dentro do plano' : 'Abaixo do plano', g.onTrack ? 'pos' : 'neg') +
      kpi('Previsão de conclusão', g.projection ? d(g.projection) : '—', 'baseada no ritmo real') + '</div>' +
      '<div class="hintbox" style="margin-top:10px">Ao registrar um aporte, o valor sai da conta escolhida e entra na "Reserva da meta". Transferências internas não aumentam o patrimônio total nem viram receita.</div></div>';
    var ev = g.movements.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    html += '<div class="card"><h2>Evolução</h2>' + table([{ t: 'Data' }, { t: 'Tipo' }, { t: 'Descrição' }, { t: 'Valor', num: true }],
      ev.map(function (x) { return ['<td>' + d(x.date) + '</td>', '<td>' + badge(x.type === 'deposito' ? 'Aporte' : 'Retirada', x.type === 'deposito' ? 'ok' : 'bad') + '</td>', '<td>' + h(x.description || '') + '</td>', '<td class="num">' + (x.type === 'deposito' ? '' : '− ') + m(x.amount) + '</td>'].join(''); })) + '</div>';
    var months = (function (a, b) {
      var out = [], cur = new Date(a + '-01T12:00:00Z'), end = new Date(b + '-01T12:00:00Z');
      while (cur <= end && out.length < 240) { out.push(cur.toISOString().slice(0, 7)); cur.setUTCMonth(cur.getUTCMonth() + 1); }
      return out;
    })(g.start || U.today().slice(0, 7), g.end || U.today().slice(0, 7));
    var realByMonth = {}, running = 0;
    g.movements.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); }).forEach(function (mv) {
      running += (mv.type === 'deposito' ? 1 : -1) * (Number(mv.amount) || 0);
      realByMonth[String(mv.date).slice(0, 7)] = C.round2(running);
    });
    var realSeries = {}, planSeries = {}, lastReal = 0;
    months.forEach(function (mo, i) {
      if (realByMonth[mo] !== undefined) lastReal = realByMonth[mo];
      realSeries[mo] = lastReal;
      planSeries[mo] = C.round2(g.amount * (i + 1) / Math.max(1, months.length));
    });
    html += '<div class="card"><h2>Evolução mensal</h2>' + barChart('Acumulado real', realSeries) + barChart('Meta planejada', planSeries, m, true) + '</div>';
    return html;
  };

  /* ---------- Sócios ---------- */
  V.partners = function (s, ui) {
    var balances = C.partnerBalances(s);
    var settle = C.settlePartners(s);
    var pt = A.list('partnerTransactions').sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var dists = A.list('profitDistributions').sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var totalDist = C.sum(dists, 'distributable');
    var html = head('Sócios e lucros', 'Patrimônio do negócio separado do patrimônio pessoal',
      '<button class="btn" data-act="new-partner">Novo sócio</button><button class="btn ghost" data-act="new-partner-tx">Movimentação</button><button class="btn ghost" data-act="new-distribution">Distribuir lucro</button>');
    html += '<div class="kpis">' +
      kpi('Investido pelos sócios', m(C.sum(balances, 'invested')), 'capital e capital de giro') +
      kpi('Despesas pagas', m(C.sum(balances, 'expensesPaid')), 'pelos sócios individualmente') +
      kpi('Reembolsos pendentes', m(C.sum(settle, 'amount')), 'acertos entre sócios', settle.length ? 'neg' : '') +
      kpi('Lucro distribuído', m(C.sum(balances, 'profitReceived')), 'efetivamente recebido', 'pos') +
      '</div>';
    html += '<div class="card"><h2>Participação</h2>' + (balances.length ? '<div class="list">' + balances.map(function (b) {
      return '<div class="row"><span class="grow"><div class="title">' + h(b.name) + ' · ' + U.pct(b.percentage, 0) + '</div>' +
        '<div class="meta">Investido ' + m(b.invested) + ' · despesas pagas ' + m(b.expensesPaid) + ' · retiradas ' + m(b.withdrawals) + '</div></span>' +
        '<button class="btn ghost small" data-act="edit-partner" data-id="' + b.id + '">Editar</button></div>';
    }).join('') + '</div>' : empty('Cadastre os sócios para começar.', 'partners')) + '</div>';
    html += '<div class="card"><h2>Acerto financeiro entre sócios</h2>' + (settle.length ?
      '<div class="list">' + settle.map(function (x) {
        var from = (A.get('partners', x.from) || {}).name, to = (A.get('partners', x.to) || {}).name;
        return '<div class="row"><span class="grow"><b>' + h(from) + '</b> deve <b>' + h(to) + '</b><div class="meta">Acerto de despesas compartilhadas pagas individualmente</div></span>' +
          '<span class="amount">' + m(x.amount) + '</span><button class="btn small" data-act="settle-partners" data-from="' + x.from + '" data-to="' + x.to + '" data-amount="' + x.amount + '">Quitar</button></div>';
      }).join('') + '</div>' : empty('Nenhum acerto pendente.', 'check')) +
      '<div class="hintbox" style="margin-top:10px">Reembolsos entre sócios não são novas despesas do negócio e não entram no faturamento.</div></div>';
    html += '<div class="card"><h2>Distribuição de lucros</h2>' + (dists.length ? table([{ t: 'Data' }, { t: 'Período' }, { t: 'Lucro líquido', num: true }, { t: 'Reservas', num: true }, { t: 'Distribuível', num: true }],
      dists.map(function (x) { return ['<td>' + d(x.date) + '</td>', '<td>' + d(x.periodStart) + ' a ' + d(x.periodEnd) + '</td>', '<td class="num">' + m(x.netProfit) + '</td>', '<td class="num">' + m(x.reserveReinvest + x.reserveCash) + '</td>', '<td class="num">' + m(x.distributable) + '</td>'].join(''); })) : empty('Nenhuma distribuição registrada.')) +
      '<div class="hintbox" style="margin-top:10px">Total distribuído: ' + m(totalDist) + '. Investimentos anteriores não são participação nos lucros.</div></div>';
    html += '<div class="card"><h2>Histórico societário</h2>' + table([{ t: 'Data' }, { t: 'Sócio' }, { t: 'Tipo' }, { t: 'Descrição' }, { t: 'Status' }, { t: 'Valor', num: true }],
      pt.map(function (x) { return ['<td>' + d(x.date) + '</td>', '<td>' + h((A.get('partners', x.partnerId) || {}).name || '—') + '</td>', '<td>' + h(x.type) + '</td>', '<td>' + h(x.description || '') + '</td>', '<td>' + statusBadge(x.status) + '</td>', '<td class="num">' + m(x.amount) + '</td>'].join(''); })) + '</div>';
    return html;
  };

  /* ---------- Configurações ---------- */
  V.settings = function (s, ui) {
    var sc = A.cloud.config(), st = A.cloud.status;
    var section = ui.settingsSection || 'general';
    var audits = A.list('audit').sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, 50);
    var sections = [
      { id: 'general', label: 'Geral', icon: 'general', desc: 'Identificação e preferências básicas do sistema.' },
      { id: 'appearance', label: 'Aparência', icon: 'appearance', desc: 'Escolha o tema visual do aplicativo.' },
      { id: 'accounts', label: 'Contas', icon: 'accounts', desc: 'Contas, carteiras e saldos usados nos lançamentos.' },
      { id: 'sync', label: 'Conta e sincronização', icon: 'sync', desc: 'Login, nuvem e sincronização entre dispositivos.' },
      { id: 'data', label: 'Privacidade e dados', icon: 'data', desc: 'Backup, restauração, exportação e histórico.' }
    ];
    var current = sections.filter(function (x) { return x.id === section; })[0] || sections[0];

    var html = head('Configurações', 'Gerencie as preferências e os dados do aplicativo');
    html += '<div class="settings-layout"><nav class="settings-nav" aria-label="Categorias de configurações">';
    sections.forEach(function (x) {
      html += '<button type="button" class="settings-nav-item' + (x.id === current.id ? ' active' : '') + '"' +
        ' data-act="settings-section" data-section="' + x.id + '"' + (x.id === current.id ? ' aria-current="page"' : '') + '>' +
        Icon(x.icon, 16) + '<span>' + h(x.label) + '</span></button>';
    });
    html += '</nav><div class="settings-content"><section class="settings-pane">';
    html += '<header class="settings-head"><h2>' + h(current.label) + '</h2><p>' + h(current.desc) + '</p></header>';

    if (current.id === 'general') {
      html += '<form id="form-business" class="settings-form">' +
        settingRow('Nome do negócio', 'Exibido no cabeçalho e nos relatórios.',
          '<input name="businessName" value="' + h(s.meta.businessName) + '" required maxlength="60">') +
        settingRow('Idioma', 'Idioma da interface.', '<input value="Português (Brasil)" disabled>') +
        settingRow('Formato de data e horário', 'Padrão usado nos registros.', '<input value="DD/MM/AAAA · HH:mm" disabled>') +
        settingRow('Moeda', 'Moeda oficial dos lançamentos.', '<input value="BRL — Real brasileiro" disabled>') +
        settingRow('Fuso horário', 'Usado para registrar datas e horas.', '<input value="America/Sao_Paulo" disabled>') +
        '<div class="settings-actions"><span class="save-state" data-save-state></span><button class="btn" type="submit">Salvar alterações</button></div></form>';
    } else if (current.id === 'appearance') {
      html += '<div class="settings-form">' +
        settingRow('Tema', 'Escolha como o aplicativo aparece para você.',
          '<select data-setting="theme"><option value="light"' + (s.meta.theme === 'light' ? ' selected' : '') + '>Claro</option>' +
          '<option value="dark"' + (s.meta.theme === 'dark' ? ' selected' : '') + '>Escuro</option>' +
          '<option value="auto"' + (s.meta.theme === 'auto' ? ' selected' : '') + '>Seguir o sistema</option></select>') +
        '<div class="settings-actions"><span class="save-state" data-save-state></span></div></div>';
    } else if (current.id === 'accounts') {
      var balances = C.accountBalances(s);
      html += '<div class="settings-rows">' + A.list('accounts').map(function (a) {
        return '<div class="setting-row"><div class="setting-info"><div class="setting-name">' + h(a.name) + '</div>' +
          '<div class="setting-desc">' + h(a.type) + (a.notes ? ' · ' + h(a.notes) : '') + '</div></div>' +
          '<div class="setting-control"><span class="money-strong">' + m(balances[a.id]) + '</span>' +
          '<div class="btn-row compact"><button class="btn ghost small" data-act="edit-account" data-id="' + a.id + '">' + Icon('pencil', 14) + ' Editar</button>' +
          '<button class="btn ghost small" data-act="delete-record" data-entity="accounts" data-id="' + a.id + '">' + Icon('trash', 14) + ' Excluir</button></div></div></div>';
      }).join('') + '</div>' +
        '<div class="settings-actions"><span class="save-state" data-save-state></span><button class="btn ghost" data-act="new-account">' + Icon('plus', 16) + ' Nova conta / carteira</button></div>' +
        '<p class="settings-note">A reserva da meta é uma conta interna: transferências para ela não viram receita nem despesa.</p>';
    } else if (current.id === 'sync') {
      html += '<div class="settings-form">' +
        settingRow('Status', st.session ? ('Conectado como <b>' + h(st.session.user.email) + '</b>. ' +
          (st.online ? 'Internet disponível.' : 'Sem internet — os dados ficam no aparelho e serão enviados quando a conexão voltar.')) :
          'Sem login: os dados ficam salvos somente neste aparelho.',
          st.session ? '<span class="status-dot ok"></span> Conectado' : '<span class="status-dot"></span> Local') +
        settingRow('Modo de armazenamento', 'Escolha entre salvar apenas aqui ou sincronizar com a nuvem.',
          '<select data-setting="storageMode"><option value="cloud"' + (!st.localMode ? ' selected' : '') + '>Nuvem</option>' +
          '<option value="local"' + (st.localMode ? ' selected' : '') + '>Somente neste aparelho</option></select>') +
        (st.session ? settingRow('Sincronização', st.lastSync ? 'Última sincronização: ' + h(st.lastSync) : 'Ainda não sincronizado nesta sessão.',
          '<div class="btn-row compact"><button class="btn ghost small" data-act="sync-now">' + Icon('sync', 14) + ' Sincronizar agora</button>' +
          '<button class="btn ghost small" data-act="sign-out">' + Icon('user', 14) + ' Sair da conta</button></div>') :
          settingRow('Acesso', 'Entre ou crie uma conta para sincronizar entre dispositivos.',
            '<button class="btn small" data-act="open-auth">' + Icon('user', 15) + ' Entrar / criar conta</button>')) +
        '<form id="form-cloud"><div class="settings-subhead">Configuração do servidor</div>' +
        settingRow('URL do Supabase', 'Endereço HTTPS do projeto.', '<input name="url" value="' + h(sc.url) + '" type="url">') +
        settingRow('Chave publishable', 'Use somente a chave pública; nunca a service_role.',
          '<input name="key" value="' + h(sc.key) + '" type="password">') +
        '<div class="settings-actions"><span class="save-state" data-save-state></span><button class="btn ghost" type="submit">Salvar configuração</button></div></form>' +
        (st.error ? '<p class="settings-error">Erro: ' + h(st.error) + '</p>' : '') + '</div>';
    } else if (current.id === 'data') {
      html += '<div class="settings-form">' +
        settingRow('Backup completo', 'Baixa todos os registros e o histórico de auditoria.',
          '<button class="btn ghost small" data-act="backup">' + Icon('download', 14) + ' Baixar JSON</button>') +
        settingRow('Restaurar backup', 'Mescla registros por ID e data de atualização.',
          '<button class="btn ghost small" data-act="restore">' + Icon('upload', 14) + ' Selecionar arquivo</button>') +
        settingRow('Exportação', 'Exporta os dados atuais em formato JSON.',
          '<button class="btn ghost small" data-act="export-json">' + Icon('file', 14) + ' Exportar JSON</button>') +
        settingRow('Limpar dados locais', 'Exclui todos os registros deste aparelho após confirmação.',
          '<button class="btn danger small" data-act="clear-all">' + Icon('trash', 14) + ' Excluir dados</button>') +
        '</div>';
      html += '<div class="settings-subhead">Auditoria</div>';
      html += audits.length ? '<div class="settings-audit">' + audits.map(function (a) {
        return '<div class="audit-item"><div><b>' + h(a.action) + '</b> · ' + h(a.entity) + '/' + h(String(a.entityId).slice(-8)) + '</div>' +
          '<div class="tiny muted">' + dt(a.at) + ' · ' + h(a.userId) + (a.reason ? ' · ' + h(a.reason) : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="settings-empty"><b>Nenhuma alteração registrada</b><span>As operações do sistema aparecerão aqui.</span></div>';
    }
    html += '</section></div></div>';
    return html;
  };

  V.authScreen = function () {
    return '<div class="auth-wrap"><div class="logo">' + Icon('brand', 40) + '</div><h1>Açaí ERP</h1>' +
      '<div class="muted" style="margin-bottom:20px">Entre para sincronizar seus dados entre aparelhos.</div><div class="card">' +
      '<form id="form-login"><div class="form-grid"><div class="field"><label>E-mail</label><input name="email" type="email" required autocomplete="username"></div>' +
      '<div class="field"><label>Senha</label><input name="password" type="password" required autocomplete="current-password"></div></div>' +
      '<div class="form-actions" style="justify-content:space-between"><button type="button" class="btn ghost small" data-act="forgot">Esqueci a senha</button>' +
      '<div class="btn-row"><button type="button" class="btn ghost" data-act="signup">Criar conta</button><button class="btn">Entrar</button></div></div></form></div>' +
      '<button class="btn ghost block" style="margin-top:10px" data-act="continue-local">Continuar somente neste aparelho</button></div>';
  };

  global.AcaiViews = V;
})(window);
