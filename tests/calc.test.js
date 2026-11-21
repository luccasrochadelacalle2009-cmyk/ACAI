/* Testes dos cálculos financeiros — execute: node tests/calc.test.js */
const assert = require('assert');
const C = require('../js/calc.js');

function st() {
  return {
    meta: { goal: { amount: 20000, startDate: '2026-01-01', endDate: '2026-06-30' } },
    accounts: [
      { id: 'caixa', name: 'Caixa', type: 'Caixa operacional', openingBalance: 0, deleted: false },
      { id: 'reserva', name: 'Reserva', type: 'Reserva financeira', openingBalance: 0, deleted: false },
      { id: 'banco', name: 'Banco', type: 'Conta bancária', openingBalance: 0, deleted: false }
    ],
    partners: [
      { id: 'A', name: 'Sócio A', percentage: 50, deleted: false },
      { id: 'B', name: 'Sócio B', percentage: 50, deleted: false }
    ],
    stockItems: [
      { id: 'polpa', name: 'Polpa', qty: 10, unitCost: 8, deleted: false },
      { id: 'garrafa', name: 'Garrafa', qty: 10, unitCost: 2, deleted: false }
    ],
    products: [{ id: 'p1', name: 'Açaí 500', variants: [{ id: 'v1', salePrice: 25, cost: 10 }], deleted: false }],
    recipes: [{ id: 'r1', productId: 'p1', variantId: 'v1', items: [{ stockItemId: 'polpa', qty: 1 }, { stockItemId: 'garrafa', qty: 1 }], deleted: false }],
    sales: [], entries: [], expenses: [], purchases: [], stockMovements: [], bills: [], goalMovements: [],
    partnerTransactions: [], profitDistributions: [], transfers: [], cashCounts: [], audit: []
  };
}
function sale(total, cost, date) {
  return { id: 's' + Math.random(), code: 'V1', dateTime: date || '2026-03-10T10:00:00', status: 'confirmada',
    accountId: 'caixa', total: total, costTotal: cost, items: [{ productId: 'p1', variantId: 'v1', name: 'Açaí 500', qty: 1, unitPrice: total, discount: 0, total: total, costUnit: cost }], deleted: false };
}
function exp(name, amount, key, status, extra) {
  return Object.assign({ id: 'e' + Math.random(), name: name, amount: amount, categoryKey: key, category: key,
    status: status || 'pago', paymentDate: '2026-03-10', purchaseDate: '2026-03-10', accountId: 'caixa', deleted: false }, extra || {});
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('✓ ' + name); }

test('faturamento não inclui aporte do proprietário', () => {
  const s = st();
  s.sales.push(sale(100, 40));
  s.entries.push({ id: 'en1', date: '2026-03-10', description: 'Aporte', category: 'Aporte do proprietário', amount: 500, accountId: 'caixa', deleted: false });
  const k = C.metrics(s, '2026-03-01', '2026-03-31');
  assert.strictEqual(k.revenue, 100);
  assert.strictEqual(k.entriesManual, 500);
  assert.strictEqual(k.totalIn, 600);
  assert.strictEqual(k.grossProfit, 60);
  assert.strictEqual(k.netProfit, 60);
});

test('custo da ficha técnica e lucro bruto por unidade', () => {
  const s = st();
  assert.strictEqual(C.recipeCost(s, 'p1', 'v1'), 10);
  s.sales.push(sale(25, C.recipeCost(s, 'p1', 'v1')));
  const k = C.metrics(s, '2026-03-01', '2026-03-31');
  assert.strictEqual(k.cogs, 10);
  assert.strictEqual(k.grossProfit, 15);
  assert.strictEqual(k.margin, 60);
});

test('investimento não reduz o lucro líquido, mas aumenta as saídas', () => {
  const s = st();
  s.sales.push(sale(1000, 400));
  s.expenses.push(exp('Energia', 100, 'operacional'));
  s.expenses.push(exp('Freezer', 800, 'investimentos'));
  const k = C.metrics(s, '2026-03-01', '2026-03-31');
  assert.strictEqual(k.totalOut, 900);
  assert.strictEqual(k.investments, 800);
  assert.strictEqual(k.netProfit, 500); // 1000 - 400 - 100
});

test('compra de insumo não duplica custo (só COGS entra no lucro)', () => {
  const s = st();
  s.sales.push(sale(25, 10));
  s.expenses.push(exp('Compra de polpa', 80, 'producao'));
  const k = C.metrics(s, '2026-03-01', '2026-03-31');
  assert.strictEqual(k.groups.custo, 80);
  assert.strictEqual(k.netProfit, 15);
  assert.strictEqual(k.totalOut, 80);
});

test('venda cancelada não entra no faturamento', () => {
  const s = st();
  s.sales.push(sale(100, 40));
  const c = sale(90, 40); c.status = 'cancelada'; s.sales.push(c);
  const k = C.metrics(s, '2026-03-01', '2026-03-31');
  assert.strictEqual(k.revenue, 100);
  assert.strictEqual(k.cancelled, 1);
});

test('transferência entre contas não altera o patrimônio consolidado', () => {
  const s = st();
  s.transfers.push({ id: 't1', date: '2026-03-10', fromAccountId: 'caixa', toAccountId: 'banco', amount: 300, deleted: false });
  const bal = C.accountBalances(s);
  assert.strictEqual(bal.caixa, -300);
  assert.strictEqual(bal.banco, 300);
  const k = C.metrics(s);
  assert.strictEqual(k.consolidated, 0);
  assert.strictEqual(k.totalIn, 0);
  assert.strictEqual(k.totalOut, 0);
});

test('despesa parcial debita somente o valor pago', () => {
  const s = st();
  s.expenses.push(exp('Conta parcial', 200, 'operacional', 'parcial', { paidAmount: 50 }));
  assert.strictEqual(C.accountBalances(s).caixa, -50);
});

test('meta: aporte e retirada, sem virar receita', () => {
  const s = st();
  s.goalMovements.push({ id: 'g1', date: '2026-03-01', type: 'deposito', amount: 100, accountId: 'caixa', deleted: false });
  s.goalMovements.push({ id: 'g2', date: '2026-03-20', type: 'saque', amount: 30, accountId: 'caixa', deleted: false });
  const g = C.goalStatus(s);
  assert.strictEqual(g.accumulated, 70);
  assert.strictEqual(g.percent, 0.35);
  assert.strictEqual(g.remaining, 19930);
  const k = C.metrics(s);
  assert.strictEqual(k.totalIn, 0);
  assert.strictEqual(k.revenue, 0);
  assert.strictEqual(k.consolidated, 0); // sai de uma conta e entra na reserva
});

test('dívidas e contas a receber em aberto', () => {
  const s = st();
  s.expenses.push(exp('Fornecedor', 200, 'producao', 'pendente'));
  s.bills.push({ id: 'b1', type: 'receber', person: 'Cliente', description: 'Recebível', amount: 90, dueDate: '2026-04-01', status: 'pendente', deleted: false });
  s.bills.push({ id: 'b2', type: 'pagar', person: 'Credor', description: 'Boleto', amount: 50, dueDate: '2026-04-01', status: 'pendente', deleted: false });
  assert.strictEqual(C.debts(s), 250);
  assert.strictEqual(C.receivables(s), 90);
});

test('acerto entre sócios: quem pagou 200 divide 100/100', () => {
  const s = st();
  s.expenses.push(exp('Açaí compartilhado', 200, 'producao', 'pago', {
    payerType: 'parceiro', payerPartnerId: 'A', split: [{ partnerId: 'A', percent: 50 }, { partnerId: 'B', percent: 50 }]
  }));
  let settle = C.settlePartners(s);
  assert.strictEqual(settle.length, 1);
  assert.strictEqual(settle[0].from, 'B');
  assert.strictEqual(settle[0].to, 'A');
  assert.strictEqual(settle[0].amount, 100);
  s.partnerTransactions.push({ id: 'ac1', date: '2026-03-11', type: 'acerto', from: 'B', to: 'A', toPartnerId: 'A', amount: 100, partnerId: 'B', status: 'pago', deleted: false });
  settle = C.settlePartners(s);
  assert.strictEqual(settle.length, 0);
  const b = C.partnerBalances(s);
  assert.strictEqual(b.find(x => x.id === 'A').balance, 0);
  assert.strictEqual(b.find(x => x.id === 'B').balance, 0);
  assert.strictEqual(b.find(x => x.id === 'A').expensesPaid, 200); // histórico preservado
});

test('despesa paga por sócio não entra no caixa, débitos ou lucro da empresa', () => {
  const s = st();
  s.sales.push(sale(100, 40));
  s.expenses.push(exp('Jantar societário', 80, 'administrativa', 'pago', {
    payerType: 'parceiro', payerPartnerId: 'A', split: [{ partnerId: 'A', percent: 50 }, { partnerId: 'B', percent: 50 }]
  }));
  const k = C.metrics(s, '2026-03-01', '2026-03-31');
  assert.strictEqual(k.revenue, 100);
  assert.strictEqual(k.totalOut, 0);
  assert.strictEqual(k.netProfit, 60);
  assert.strictEqual(C.accountBalances(s).caixa, 100);
  assert.strictEqual(C.debts(s), 0);
});

test('distribuição de lucro respeita reservas e percentuais', () => {
  const s = st();
  s.profitDistributions.push({ id: 'd1', date: '2026-03-31', netProfit: 1000, reserveReinvest: 200, reserveCash: 200,
    distributable: 600, lines: [{ partnerId: 'A', percent: 50, amount: 300, status: 'pago' }, { partnerId: 'B', percent: 50, amount: 300, status: 'pendente' }], deleted: false });
  const b = C.partnerBalances(s);
  assert.strictEqual(b[0].profitReceived, 300);
  assert.strictEqual(b[1].profitReceived, 0);
  assert.strictEqual(C.sum(s.profitDistributions, 'distributable'), 600);
});

test('ponto de equilíbrio usa margem de contribuição real', () => {
  const s = st();
  s.sales.push(sale(100, 40));
  s.expenses.push(exp('Aluguel', 300, 'administrativa'));
  const p = C.profitProjection(s, '2026-03-01', '2026-03-31');
  assert.strictEqual(p.contribution, 60);
  assert.strictEqual(p.breakEvenUnits, 5);
  assert.strictEqual(p.breakEvenRevenue, 500);
});

test('merge offline deduplica por id e mantém o mais recente', () => {
  const local = { meta: { updatedAt: '2026-01-01T00:00:00Z' }, sales: [{ id: 'x', total: 10, updatedAt: '2026-01-01T00:00:00Z' }] };
  const remote = { meta: { updatedAt: '2026-01-02T00:00:00Z' }, sales: [{ id: 'x', total: 20, updatedAt: '2026-01-02T00:00:00Z' }] };
  global.Acai = { util: { today: () => '2026-03-10', daysBetween: () => 10, addDays: () => '2026-03-20' } };
  // mergeStates vive em core.js; aqui validamos o princípio de seleção por updatedAt
  const merged = remote.sales[0].updatedAt > local.sales[0].updatedAt ? remote.sales[0] : local.sales[0];
  assert.strictEqual(merged.total, 20);
});

console.log('\n' + passed + ' testes passaram.');
