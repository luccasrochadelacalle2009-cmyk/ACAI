/* ===== Açaí ERP — motor de cálculos (puro, testável em Node) ===== */
(function (global) {
  'use strict';
  var C = {};
  var r2 = function (n) { n = Number(n) || 0; return Math.round((n + Number.EPSILON) * 100) / 100; };
  var sum = function (arr, fn) {
    var get = typeof fn === 'function' ? fn : (typeof fn === 'string' ? function (x) { return x && x[fn]; } : function (x) { return x; });
    return r2((arr || []).reduce(function (a, x) { return a + (Number(get(x)) || 0); }, 0));
  };
  var active = function (arr) { return (arr || []).filter(function (x) { return x && !x.deleted; }); };
  var inRange = function (d, from, to) {
    d = String(d || '').slice(0, 10);
    return (!from || d >= from) && (!to || d <= to);
  };

  C.round2 = r2;
  C.active = active;
  C.sum = sum;
  C.inRange = inRange;

  C.groupOf = function (state, expense) {
    var cat = (state && state.CATEGORIES) || global.Acai && global.Acai.CATEGORIES;
    var key = expense && (expense.categoryKey || expense.category);
    if (cat && cat[key]) return cat[key].group;
    if (key === 'investimentos') return 'investimento';
    if (key === 'impostos') return 'imposto';
    if (key === 'producao' || key === 'embalagens') return 'custo';
    return 'operacional';
  };

  /* Custo de umareceita: soma qty * custo unitário do insumo */
  C.recipeCost = function (state, productId, variantId) {
    var rec = active(state.recipes).find(function (r) {
      return r.productId === productId && (!variantId || !r.variantId || r.variantId === variantId);
    });
    if (!rec || !rec.items || !rec.items.length) {
      var p = active(state.products).find(function (x) { return x.id === productId; });
      var v = p && (p.variants || []).find(function (x) { return x.id === variantId; });
      return r2(v && v.cost || 0);
    }
    return r2(rec.items.reduce(function (acc, it) {
      var item = active(state.stockItems).find(function (s) { return s.id === it.stockItemId; });
      return acc + (Number(it.qty) || 0) * (item ? Number(item.unitCost) || 0 : 0);
    }, 0));
  };

  C.recalcCosts = function (state) {
    active(state.products).forEach(function (p) {
      (p.variants || []).forEach(function (v) {
        var c = C.recipeCost(state, p.id, v.id);
        if (c) { v.cost = c; v.costUpdatedAt = new Date().toISOString(); }
      });
    });
    return state;
  };

  C.saleCost = function (state, sale) {
    if (typeof sale.costTotal === 'number') return r2(sale.costTotal);
    return r2((sale.items || []).reduce(function (a, it) {
      return a + (Number(it.costUnit) || C.recipeCost(state, it.productId, it.variantId)) * (Number(it.qty) || 0);
    }, 0));
  };

  C.salesIn = function (state, from, to) {
    return active(state.sales).filter(function (s) {
      return s.status !== 'cancelada' && inRange(s.dateTime, from, to);
    });
  };
  C.cancelledSalesIn = function (state, from, to) {
    return active(state.sales).filter(function (s) { return s.status === 'cancelada' && inRange(s.dateTime, from, to); });
  };
  C.entriesIn = function (state, from, to) {
    return active(state.entries).filter(function (e) { return inRange(e.date, from, to); });
  };
  C.expensesIn = function (state, from, to, paidOnly) {
    return active(state.expenses).filter(function (e) {
      return inRange(e.paymentDate || e.purchaseDate, from, to) && (!paidOnly || e.status === 'pago');
    });
  };

  C.accountBalances = function (state) {
    var bal = {};
    active(state.accounts).forEach(function (a) { bal[a.id] = r2(Number(a.openingBalance) || 0); });
    var add = function (id, v) { if (id && bal[id] !== undefined) bal[id] = r2(bal[id] + (Number(v) || 0)); };
    active(state.sales).forEach(function (s) { if (s.status !== 'cancelada') add(s.accountId, s.total); });
    active(state.entries).forEach(function (e) { add(e.accountId, e.amount); });
    // Despesa paga individualmente por um sócio não debita o caixa do negócio.
    active(state.expenses).forEach(function (e) {
      if (e.payerType === 'parceiro') return;
      if (e.status === 'pago') add(e.accountId, -e.amount);
      else if (e.status === 'parcial') add(e.accountId, -(Number(e.paidAmount) || 0));
    });
    active(state.transfers).forEach(function (t) { add(t.fromAccountId, -t.amount); add(t.toAccountId, t.amount); });
    active(state.bills).forEach(function (b) {
      if (b.status === 'pago' && !b.expenseId) add(b.accountId, b.type === 'pagar' ? -b.amount : b.amount);
    });
    var reserve = active(state.accounts).find(function (a) { return a.type === 'Reserva financeira'; });
    var reserveId = reserve ? reserve.id : 'acc-reserva';
    active(state.goalMovements).forEach(function (g) {
      var acc = g.accountId || (active(state.accounts)[0] || {}).id;
      if (g.type === 'deposito') { add(acc, -g.amount); add(reserveId, g.amount); }
      else { add(reserveId, -g.amount); add(acc, g.amount); }
    });
    return bal;
  };

  C.debts = function (state) {
    var openExpenses = sum(active(state.expenses).filter(function (e) {
      return e.status !== 'pago' && e.payerType !== 'parceiro';
    }), function (e) {
      return Math.max(0, (Number(e.amount) || 0) - (Number(e.paidAmount) || 0));
    });
    var bills = sum(active(state.bills).filter(function (b) {
      return b.type === 'pagar' && b.status !== 'pago' && !b.expenseId;
    }), function (b) { return Number(b.amount) || 0; });
    return r2(openExpenses + bills);
  };
  C.receivables = function (state) {
    return sum(active(state.bills).filter(function (b) { return b.type === 'receber' && b.status !== 'pago'; }), 'amount');
  };

  C.metrics = function (state, from, to) {
    var today = (global.Acai && global.Acai.util.today()) || new Date().toISOString().slice(0, 10);
    var month = today.slice(0, 7);
    var sales = C.salesIn(state, from, to);
    var revenue = sum(sales, 'total');
    var cogs = sum(sales, function (s) { return C.saleCost(state, s); });
    var entries = C.entriesIn(state, from, to);
    var entriesTotal = sum(entries, 'amount');
    var expensesPaid = C.expensesIn(state, from, to, true).filter(function (e) { return e.payerType !== 'parceiro'; });
    var totalOut = sum(expensesPaid, 'amount');
    var groups = { custo: 0, operacional: 0, imposto: 0, investimento: 0, outro: 0 };
    expensesPaid.forEach(function (e) {
      var g = C.groupOf(state, e);
      if (groups[g] === undefined) g = 'outro';
      groups[g] = r2(groups[g] + (Number(e.amount) || 0));
    });
    var grossProfit = r2(revenue - cogs);
    var netProfit = r2(grossProfit - groups.operacional - groups.imposto - groups.outro);
    var balances = C.accountBalances(state);
    var consolidated = r2(Object.keys(balances).reduce(function (a, k) { return a + balances[k]; }, 0));
    var available = r2(Object.keys(balances).reduce(function (a, k) {
      var acc = active(state.accounts).find(function (x) { return x.id === k; });
      return a + (acc && acc.type === 'Reserva financeira' ? 0 : balances[k]);
    }, 0));
    var salesMonth = C.salesIn(state, month + '-01', month + '-31');
    var salesDay = C.salesIn(state, today, today);
    var units = sum(sales, function (s) {
      return sum(s.items || [], function (it) { return Number(it.qty) || 0; });
    });
    var byProduct = {}, byPayment = {}, byLocation = {}, byDay = {};
    sales.forEach(function (s) {
      byPayment[s.paymentMethod || 'Outros'] = r2((byPayment[s.paymentMethod || 'Outros'] || 0) + (Number(s.total) || 0));
      byLocation[s.location || 'Não informado'] = r2((byLocation[s.location || 'Não informado'] || 0) + (Number(s.total) || 0));
      var d = String(s.dateTime).slice(0, 10);
      byDay[d] = r2((byDay[d] || 0) + (Number(s.total) || 0));
      (s.items || []).forEach(function (it) {
        var k = it.name || it.productName || 'Produto';
        if (!byProduct[k]) byProduct[k] = { name: k, qty: 0, revenue: 0, cost: 0 };
        byProduct[k].qty += Number(it.qty) || 0;
        byProduct[k].revenue = r2(byProduct[k].revenue + (Number(it.total) || 0));
        byProduct[k].cost = r2(byProduct[k].cost + (Number(it.costUnit) || C.recipeCost(state, it.productId, it.variantId)) * (Number(it.qty) || 0));
      });
    });
    Object.keys(byProduct).forEach(function (k) {
      byProduct[k].profit = r2(byProduct[k].revenue - byProduct[k].cost);
      byProduct[k].margin = byProduct[k].revenue ? r2(byProduct[k].profit / byProduct[k].revenue * 100) : 0;
    });
    var bestProduct = Object.keys(byProduct).sort(function (a, b) { return byProduct[b].revenue - byProduct[a].revenue; })[0] || null;
    var bestDay = Object.keys(byDay).sort(function (a, b) { return byDay[b] - byDay[a]; })[0] || null;
    var daysWithSales = Object.keys(byDay).length;
    return {
      period: { from: from || null, to: to || null },
      revenue: revenue,
      revenueDay: sum(salesDay, 'total'),
      revenueMonth: sum(salesMonth, 'total'),
      salesCount: sales.length,
      unitsSold: r2(units),
      ticketMedio: sales.length ? r2(revenue / sales.length) : 0,
      avgPrice: units ? r2(revenue / units) : 0,
      cogs: cogs,
      grossProfit: grossProfit,
      netProfit: netProfit,
      margin: revenue ? r2(netProfit / revenue * 100) : 0,
      grossMargin: revenue ? r2(grossProfit / revenue * 100) : 0,
      entriesManual: entriesTotal,
      totalIn: r2(revenue + entriesTotal),
      totalOut: totalOut,
      groups: groups,
      investments: groups.investimento,
      debts: C.debts(state),
      receivables: C.receivables(state),
      balances: balances,
      available: available,
      consolidated: consolidated,
      accumulated: C.goalStatus(state).accumulated,
      bestProduct: bestProduct ? byProduct[bestProduct] : null,
      bestProductName: bestProduct,
      bestDay: bestDay,
      dailyAverage: daysWithSales ? r2(revenue / daysWithSales) : 0,
      byProduct: byProduct,
      byPayment: byPayment,
      byLocation: byLocation,
      byDay: byDay,
      cancelled: C.cancelledSalesIn(state, from, to).length,
      stockValue: C.stockStatus(state).totalValue
    };
  };

  C.goalStatus = function (state) {
    var g = (state.meta && state.meta.goal) || {};
    var amount = Number(g.amount) || 0;
    var start = g.startDate || null, end = g.endDate || null;
    var movements = active(state.goalMovements);
    var accumulated = r2(sum(movements, function (m) {
      return (m.type === 'deposito' ? 1 : -1) * (Number(m.amount) || 0);
    }));
    var today = (global.Acai && global.Acai.util.today()) || new Date().toISOString().slice(0, 10);
    var elapsed = start ? Math.max(0, (global.Acai && global.Acai.util.daysBetween(start, today)) || 0) : 0;
    var totalDays = (start && end) ? Math.max(1, (global.Acai && global.Acai.util.daysBetween(start, end)) || 1) : 180;
    var daysLeft = end ? Math.max(0, (global.Acai && global.Acai.util.daysBetween(today, end)) || 0) : 0;
    var remaining = r2(Math.max(0, amount - accumulated));
    var avgPerDay = elapsed > 0 ? r2(accumulated / elapsed) : 0;
    var projection = null;
    if (remaining <= 0) projection = today;
    else if (avgPerDay > 0) {
      var need = Math.ceil(remaining / avgPerDay);
      if (need <= 36500) projection = (global.Acai && global.Acai.util.addDays) ? global.Acai.util.addDays(today, need) : null;
    }
    var expected = r2(amount * Math.min(1, elapsed / totalDays));
    return {
      amount: amount, start: start, end: end, accumulated: accumulated,
      percent: amount ? r2(accumulated / amount * 100) : 0,
      remaining: remaining, elapsedDays: elapsed, totalDays: totalDays, daysLeft: daysLeft,
      perMonth: daysLeft > 0 ? r2(remaining / (daysLeft / 30.44)) : remaining,
      perWeek: daysLeft > 0 ? r2(remaining / (daysLeft / 7)) : remaining,
      perDay: daysLeft > 0 ? r2(remaining / daysLeft) : remaining,
      avgPerDay: avgPerDay, projection: projection, expected: expected,
      onTrack: accumulated >= expected, movements: movements
    };
  };

  C.stockStatus = function (state) {
    var items = active(state.stockItems);
    var today = (global.Acai && global.Acai.util.today()) || new Date().toISOString().slice(0, 10);
    var low = items.filter(function (i) { return (Number(i.qty) || 0) <= (Number(i.minQty) || 0); });
    var expiring = items.filter(function (i) {
      if (!i.expiry) return false;
      var d = (global.Acai && global.Acai.util.daysBetween(today, i.expiry));
      return d !== null && d <= 30;
    });
    return {
      items: items, low: low, expiring: expiring,
      totalValue: r2(sum(items, function (i) { return (Number(i.qty) || 0) * (Number(i.unitCost) || 0); }))
    };
  };

  C.partnerBalances = function (state) {
    var partners = active(state.partners);
    var pt = active(state.partnerTransactions);
    // Despesas pagas por sócio são pessoais: continuam no histórico para acerto,
    // mas não entram no caixa, nas despesas nem no lucro do negócio.
    var exps = active(state.expenses).filter(function (e) { return e.status === 'pago'; });
    var dists = active(state.profitDistributions);
    return partners.map(function (p) {
      var invested = sum(pt.filter(function (t) { return t.partnerId === p.id && ['investimento', 'capital_giro'].indexOf(t.type) >= 0; }), 'amount');
      var loans = sum(pt.filter(function (t) { return t.partnerId === p.id && t.type === 'emprestimo'; }), 'amount');
      var paid = sum(exps.filter(function (e) { return e.payerType === 'parceiro' && e.payerPartnerId === p.id; }), 'amount');
      var expected = 0;
      exps.forEach(function (e) {
        if (e.payerType !== 'parceiro' || !e.split) return;
        var line = e.split.find(function (x) { return x.partnerId === p.id; });
        if (line) expected += (Number(e.amount) || 0) * (Number(line.percent) || 0) / 100;
      });
      // Acerto quitado: o devedor baixa sua dívida e o credor registra o recebimento.
      // Nada disso é nova receita ou despesa do negócio.
      var reimbursed = sum(pt.filter(function (t) {
        return t.partnerId === p.id && t.type === 'reembolso' ||
          t.toPartnerId === p.id && t.type === 'acerto';
      }), 'amount');
      var settledByPartner = sum(pt.filter(function (t) {
        return t.partnerId === p.id && t.type === 'acerto';
      }), 'amount');
      var profitReceived = r2(dists.reduce(function (a, d) {
        var l = (d.lines || []).find(function (x) { return x.partnerId === p.id && x.status === 'pago'; });
        return a + (l ? Number(l.amount) || 0 : 0);
      }, 0));
      var withdrawals = sum(pt.filter(function (t) { return t.partnerId === p.id && t.type === 'retirada'; }), 'amount');
      return {
        partner: p, id: p.id, name: p.name, percentage: Number(p.percentage) || 0,
        invested: invested, loans: loans, expensesPaid: paid, expected: r2(expected),
        balance: r2(paid - expected - reimbursed + settledByPartner), reimbursed: reimbursed,
        profitReceived: profitReceived, withdrawals: withdrawals
      };
    });
  };

  C.settlePartners = function (state) {
    var balances = C.partnerBalances(state);
    var creditors = balances.filter(function (b) { return b.balance > 0; }).map(function (b) { return { id: b.id, amount: b.balance }; });
    var debtors = balances.filter(function (b) { return b.balance < 0; }).map(function (b) { return { id: b.id, amount: -b.balance }; });
    var out = [];
    var i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      var v = Math.min(debtors[i].amount, creditors[j].amount);
      if (v > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: r2(v) });
      debtors[i].amount = r2(debtors[i].amount - v);
      creditors[j].amount = r2(creditors[j].amount - v);
      if (debtors[i].amount <= 0) i++;
      if (creditors[j].amount <= 0) j++;
    }
    return out;
  };

  C.profitProjection = function (state, from, to) {
    var m = C.metrics(state, from, to);
    var fixed = r2(m.groups.operacional + m.groups.imposto + m.groups.outro);
    var avgTicket = m.ticketMedio;
    var avgCost = m.unitsSold ? r2(m.cogs / m.unitsSold) : 0;
    var contribution = r2(avgTicket - avgCost);
    return {
      fixedCosts: fixed, avgTicket: avgTicket, avgCostPerUnit: avgCost,
      contribution: contribution,
      breakEvenUnits: contribution > 0 ? Math.ceil(fixed / contribution) : null,
      breakEvenRevenue: contribution > 0 && avgTicket > 0 ? r2(Math.ceil(fixed / contribution) * avgTicket) : null,
      needsWorkingCapital: m.available < fixed
    };
  };

  C.dre = function (state, from, to) {
    var m = C.metrics(state, from, to);
    return [
      ['Receita de vendas (faturamento)', m.revenue],
      ['(-) Custo dos produtos vendidos', -m.cogs],
      ['(=) Lucro bruto', m.grossProfit],
      ['(-) Despesas operacionais', -m.groups.operacional],
      ['(-) Impostos e obrigações', -m.groups.imposto],
      ['(-) Outras despesas', -m.groups.outro],
      ['(=) Lucro líquido', m.netProfit],
      ['— Investimentos (não entram no lucro)', m.investments],
      ['— Entradas manuais (aportes etc.)', m.entriesManual]
    ];
  };

  global.AcaiCalc = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
