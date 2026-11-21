/* ===== Açaí ERP — ações, formulários e persistência de registros ===== */
(function (global) {
  'use strict';
  var A = global.Acai, U = A.util, C = global.AcaiCalc, V = global.AcaiViews;
  var $ = U.$, esc = U.esc, m = U.money;
  var Act = {};

  function openModal(html) {
    $('#modal-root').innerHTML = '<div class="modal-back" data-act="close-modal-bg"><div class="modal" id="modal-box">' + html + '</div></div>';
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('#modal-root').innerHTML = '';
    document.body.style.overflow = '';
  }
  function modalHead(title) {
    return '<div class="modal-head"><h2>' + esc(title) + '</h2><button type="button" class="icon-btn" data-act="close-modal" aria-label="Fechar">' + Icon('close', 16) + '</button></div>';
  }
  function confirmDialog(title, msg, onYes, yesLabel) {
    openModal(modalHead(title) + '<div class="hintbox" style="font-size:13px">' + msg + '</div>' +
      '<div class="form-actions"><button class="btn ghost" data-act="close-modal">Cancelar</button>' +
      '<button class="btn ' + (yesLabel === 'Excluir' ? 'danger' : '') + '" id="confirm-yes">' + esc(yesLabel || 'Confirmar') + '</button></div>');
    $('#confirm-yes').onclick = function () { closeModal(); onYes(); };
  }
  function fieldHTML(f, v) {
    var val = v === undefined || v === null ? '' : v;
    var lab = '<label>' + esc(f.label) + '</label>';
    var cls = 'field' + (f.full ? ' full' : '');
    var common = ' name="' + f.name + '"' + (f.required ? ' required' : '');
    var input;
    if (f.type === 'select') input = '<select' + common + '>' + U.options(f.options || [], val) + '</select>';
    else if (f.type === 'textarea') input = '<textarea' + common + ' rows="' + (f.rows || 3) + '">' + esc(val) + '</textarea>';
    else if (f.type === 'checkbox') input = '<label class="checkline"><input type="checkbox"' + common + (val ? ' checked' : '') + '> ' + esc(f.checkLabel || f.label) + '</label>';
    else if (f.type === 'file') input = '<input type="file"' + common + (f.accept ? ' accept="' + f.accept + '"' : '') + '>';
    else input = '<input type="' + (f.type || 'text') + '"' + common + ' value="' + esc(val) + '"' +
      (f.step ? ' step="' + f.step + '"' : '') + (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
    if (f.type === 'checkbox') return '<div class="' + cls + '">' + input + '</div>';
    return '<div class="' + cls + '">' + lab + input + (f.help ? '<div class="tiny muted">' + esc(f.help) + '</div>' : '') + '</div>';
  }
  function formModal(title, fields, values, onSubmit, submitLabel) {
    values = values || {};
    var html = modalHead(title) + '<form id="modal-form"><div class="form-grid">' +
      fields.map(function (f) { return fieldHTML(f, values[f.name]); }).join('') + '</div>' +
      '<div class="form-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancelar</button>' +
      '<button class="btn" type="submit">' + esc(submitLabel || 'Salvar') + '</button></div></form>';
    openModal(html);
    $('#modal-form').onsubmit = function (ev) {
      ev.preventDefault();
      var form = ev.target, out = {};
      fields.forEach(function (f) {
        var el = form.elements[f.name];
        if (!el) return;
        if (f.type === 'checkbox') out[f.name] = el.checked;
        else if (f.type === 'number') out[f.name] = U.round2(el.value);
        else out[f.name] = el.value;
      });
      var files = [];
      fields.filter(function (f) { return f.type === 'file'; }).forEach(function (f) {
        var el = form.elements[f.name];
        if (el && el.files && el.files[0]) files.push(el.files[0]);
      });
      var done = function () {
        if (files.length) {
          Promise.all(files.map(function (file) {
            if (file.size > 900000) throw new Error('Anexo muito grande (máx. 900 KB): ' + file.name);
            return U.readFileAsDataURL(file);
          })).then(function (urls) {
            out.attachments = urls; onSubmit(out);
          }).catch(function (e) { U.toast(e.message, true); });
        } else { out.attachments = []; onSubmit(out); }
      };
      done();
    };
  }
  function optsActive(entity, labelKey) {
    return A.list(entity).map(function (x) { return { v: x.id, l: x[labelKey || 'name'] }; });
  }
  function accountOpts() { return optsActive('accounts'); }
  function partnerOpts() { return optsActive('partners'); }
  function supplierOpts() { return optsActive('suppliers'); }
  function stockOpts() { return optsActive('stockItems'); }
  function paymentOpts() { return U.options ? U.options(A.PAYMENTS) : A.PAYMENTS; }
  function partnerName(id) { return (A.get('partners', id) || {}).name || '—'; }
  function todayF() { return U.today(); }
  function dtF() { return U.nowDT(); }
  function normalizeDT(v) { return v && v.length === 10 ? v + 'T12:00:00' : v; }

  /* ---------- Vendas ---------- */
  var saleDraft = [];
  function productVariantOpts() {
    var out = [];
    A.list('products').forEach(function (p) {
      (p.variants || []).forEach(function (v) {
        out.push({ v: p.id + '|' + v.id, l: p.name + ' — ' + v.name + (v.volume ? ' (' + v.volume + ')' : '') });
      });
      if (!(p.variants || []).length) out.push({ v: p.id + '|', l: p.name });
    });
    return out;
  }
  function saleLineHTML(line, idx) {
    var pvs = productVariantOpts();
    return '<div class="line-item" data-line="' + idx + '">' +
      '<select class="li-pv">' + U.options(pvs, line.pv) + '</select>' +
      '<input class="li-qty" type="number" min="0.001" step="0.001" value="' + (line.qty || 1) + '" title="Qtd">' +
      '<input class="li-price" type="number" min="0" step="0.01" value="' + (line.unitPrice || 0) + '" title="Preço unit.">' +
      '<input class="li-disc" type="number" min="0" step="0.01" value="' + (line.discount || 0) + '" title="Desconto">' +
      '<button type="button" class="x" data-act="remove-sale-line" data-idx="' + idx + '">' + Icon('close', 14) + '</button></div>';
  }
  function renderSaleLines() {
    var box = $('#sale-lines');
    if (!box) return;
    box.innerHTML = '<div class="line-head"><span>Produto</span><span>Qtd</span><span>Preço</span><span>Desc.</span><span></span></div>' +
      saleDraft.map(saleLineHTML).join('');
    box.querySelectorAll('.li-pv').forEach(function (el, i) { el.onchange = function () {
      var parts = el.value.split('|');
      saleDraft[i].pv = el.value;
      var p = A.get('products', parts[0]), v = p && (p.variants || []).find(function (x) { return x.id === parts[1]; });
      if (v) { saleDraft[i].unitPrice = v.salePrice; saleDraft[i].name = p.name + ' — ' + v.name; }
      else if (p) { saleDraft[i].unitPrice = 0; saleDraft[i].name = p.name; }
      renderSaleLines();
    }; });
    ['qty', 'price', 'disc'].forEach(function (k) {
      box.querySelectorAll('.li-' + (k === 'qty' ? 'qty' : k === 'price' ? 'price' : 'disc')).forEach(function (el, i) {
        el.oninput = function () {
          saleDraft[i][{ qty: 'qty', price: 'unitPrice', disc: 'discount' }[k]] = U.round2(el.value);
          updateSaleTotals();
        };
      });
    });
    updateSaleTotals();
  }
  function saleTotals() {
    var sub = 0, disc = 0, cost = 0;
    saleDraft.forEach(function (l) {
      var q = Number(l.qty) || 0, p = Number(l.unitPrice) || 0, dsc = Number(l.discount) || 0;
      sub += q * p; disc += dsc;
      var parts = String(l.pv || '').split('|');
      cost += q * C.recipeCost(A.state, parts[0], parts[1]);
    });
    var globalDisc = Number(($('#s-discount') || {}).value) || 0;
    return { subtotal: U.round2(sub), itemDisc: U.round2(disc), discount: U.round2(disc + globalDisc), cost: U.round2(cost), total: U.round2(sub - disc - globalDisc) };
  }
  function updateSaleTotals() {
    var t = saleTotals(), box = $('#sale-totals');
    if (!box) return;
    box.innerHTML = '<div><span>Subtotal</span><b>' + m(t.subtotal) + '</b></div>' +
      '<div><span>Descontos</span><b>− ' + m(t.discount) + '</b></div>' +
      '<div><span>Custo estimado</span><b>' + m(t.cost) + '</b></div>' +
      '<div><span>Lucro bruto</span><b>' + m(t.total - t.cost) + '</b></div>' +
      '<div class="grand"><span>Total</span><span>' + m(t.total) + '</span></div>';
  }
  function openSaleForm(quick, editId) {
    var existing = editId ? A.get('sales', editId) : null;
    if (existing) saleDraft = (existing.items || []).map(function (it) { return { pv: it.productId + '|' + it.variantId, name: it.name, qty: it.qty, unitPrice: it.unitPrice, discount: it.discount }; });
    else if (quick && productVariantOpts().length) {
      var pv = productVariantOpts()[0].v, parts = pv.split('|');
      var pr = A.get('products', parts[0]), v = pr && (pr.variants || []).find(function (x) { return x.id === parts[1]; });
      saleDraft = [{ pv: pv, name: pr ? pr.name : '', qty: 1, unitPrice: v ? v.salePrice : 0, discount: 0 }];
    } else saleDraft = [];
    var fields = quick ? [
      { name: 'dateTime', label: 'Data e hora', type: 'datetime-local' },
      { name: 'location', label: 'Local da venda', ph: 'Praia, rua, ponto…' },
      { name: 'paymentMethod', label: 'Pagamento', type: 'select', options: A.PAYMENTS },
      { name: 'accountId', label: 'Conta creditada', type: 'select', options: accountOpts() }
    ] : [
      { name: 'dateTime', label: 'Data e hora', type: 'datetime-local', required: true },
      { name: 'location', label: 'Local da venda', ph: 'Praia, rua, ponto…' },
      { name: 'paymentMethod', label: 'Pagamento', type: 'select', options: A.PAYMENTS },
      { name: 'accountId', label: 'Conta creditada', type: 'select', options: accountOpts() },
      { name: 'partnerId', label: 'Sócio responsável', type: 'select', options: [{ v: '', l: 'Não informado' }].concat(partnerOpts()) },
      { name: 'discount', label: 'Desconto extra (R$)', type: 'number', step: '0.01' }
    ];
    var html = modalHead(quick ? 'Venda rápida' : (existing ? 'Editar venda' : 'Nova venda')) +
      '<form id="sale-form"><div class="form-grid">' + fields.map(function (f) { return fieldHTML(f, existing ? existing[f.name] : (f.name === 'dateTime' ? dtF() : f.name === 'accountId' ? 'acc-caixa' : f.name === 'paymentMethod' ? 'Dinheiro' : '')); }).join('') + '</div>' +
      '<h3 style="margin-top:16px">Itens</h3><div id="sale-lines"></div>' +
      '<button type="button" class="btn ghost small" data-act="add-sale-line">' + Icon('plus', 14) + ' Adicionar item</button>' +
      '<div class="totals-box" id="sale-totals"></div>' +
      (!quick ? '<div class="field" style="margin-top:10px"><label>Observações</label><textarea name="notes">' + esc(existing ? existing.notes : '') + '</textarea></div>' : '') +
      '<div class="form-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn">' + (quick ? 'Registrar venda' : 'Salvar venda') + '</button></div></form>';
    openModal(html);
    renderSaleLines();
    if ($('#s-discount')) $('#s-discount').oninput = updateSaleTotals;
    $('#sale-form').onsubmit = function (ev) {
      ev.preventDefault();
      var form = ev.target;
      if (!saleDraft.length) return U.toast('Adicione ao menos um item.', true);
      var t = saleTotals();
      if (t.total <= 0) return U.toast('O total da venda deve ser maior que zero.', true);
      var items = saleDraft.map(function (l) {
        var parts = String(l.pv || '').split('|');
        var pr = A.get('products', parts[0]), v = pr && (pr.variants || []).find(function (x) { return x.id === parts[1]; });
        return {
          productId: parts[0], variantId: parts[1] || null, name: l.name || (pr ? pr.name : 'Produto'),
          qty: Number(l.qty) || 0, unitPrice: Number(l.unitPrice) || 0, discount: Number(l.discount) || 0,
          total: U.round2((Number(l.qty) || 0) * (Number(l.unitPrice) || 0) - (Number(l.discount) || 0)),
          costUnit: C.recipeCost(A.state, parts[0], parts[1])
        };
      });
      var rec = {
        code: 'V' + Date.now().toString(36).toUpperCase(),
        dateTime: normalizeDT(form.elements.dateTime.value || dtF()), location: form.elements.location.value,
        paymentMethod: form.elements.paymentMethod.value, accountId: form.elements.accountId.value || 'acc-caixa',
        partnerId: form.elements.partnerId ? form.elements.partnerId.value : '',
        partnerName: form.elements.partnerId && form.elements.partnerId.value ? partnerName(form.elements.partnerId.value) : '',
        discount: Number(form.elements.discount ? form.elements.discount.value : 0) || 0,
        notes: form.elements.notes ? form.elements.notes.value : '',
        items: items, subtotal: t.subtotal, total: t.total, costTotal: t.cost,
        status: 'confirmada'
      };
      if (existing) {
        A.update('sales', existing.id, rec, 'Correção de venda');
        U.toast('Venda atualizada');
      } else {
        var created = A.insert('sales', rec, 'Venda registrada');
        applySaleStock(created, 'Venda #' + String(created.code).slice(-6));
        U.toast('Venda registrada: ' + m(created.total));
      }
      closeModal();
      global.AcaiApp.render();
    };
  }
  function applySaleStock(sale, reason) {
    (sale.items || []).forEach(function (it) {
      var parts = [it.productId, it.variantId];
      var rec = A.list('recipes').find(function (r) { return r.productId === parts[0] && (!r.variantId || r.variantId === parts[1]); });
      if (rec && rec.items) {
        rec.items.forEach(function (ri) {
          var item = A.get('stockItems', ri.stockItemId);
          if (!item) return;
          var q = Number(ri.qty) * (Number(it.qty) || 0);
          A.update('stockItems', item.id, { qty: U.round2((Number(item.qty) || 0) - q) }, 'Baixa por venda');
          A.insert('stockMovements', { date: String(sale.dateTime).slice(0, 10), itemId: item.id, type: 'venda', qty: -q, unitCost: item.unitCost, reason: reason, refType: 'sale', refId: sale.id }, 'Baixa automática da venda');
        });
      } else {
        var prod = A.get('products', it.productId);
        var stockId = prod && prod.stockItemId;
        if (stockId && A.get('stockItems', stockId)) {
          var si = A.get('stockItems', stockId), q2 = Number(it.qty) || 0;
          A.update('stockItems', si.id, { qty: U.round2((Number(si.qty) || 0) - q2) }, 'Baixa por venda');
          A.insert('stockMovements', { date: String(sale.dateTime).slice(0, 10), itemId: si.id, type: 'venda', qty: -q2, unitCost: si.unitCost, reason: reason, refType: 'sale', refId: sale.id }, 'Baixa automática da venda');
        }
      }
    });
  }
  Act['new-sale'] = function () { openSaleForm(false); };
  Act['quick-sale'] = function () { openSaleForm(true); };
  Act['add-sale-line'] = function () {
    saleDraft.push({ pv: (productVariantOpts()[0] || {}).v || '', qty: 1, unitPrice: 0, discount: 0, name: '' });
    renderSaleLines();
  };
  Act['remove-sale-line'] = function (el) { saleDraft.splice(Number(el.dataset.idx), 1); renderSaleLines(); };
  Act['cancel-sale'] = function (el) {
    var sale = A.get('sales', el.dataset.id);
    if (!sale) return;
    formModal('Cancelar venda', [
      { name: 'reason', label: 'Justificativa do cancelamento', type: 'textarea', required: true, full: true }
    ], {}, function (v) {
      A.update('sales', sale.id, { status: 'cancelada', cancelReason: v.reason, cancelledAt: U.nowDT() }, 'Cancelamento: ' + v.reason);
      (sale.items || []).forEach(function (it) {
        var parts = [it.productId, it.variantId];
        var rec = A.list('recipes').find(function (r) { return r.productId === parts[0] && (!r.variantId || r.variantId === parts[1]); });
        var targets = [];
        if (rec && rec.items) rec.items.forEach(function (ri) { targets.push([ri.stockItemId, Number(ri.qty) * it.qty]); });
        else { var p = A.get('products', it.productId); if (p && p.stockItemId) targets.push([p.stockItemId, it.qty]); }
        targets.forEach(function (t) {
          var item = A.get('stockItems', t[0]); if (!item) return;
          A.update('stockItems', item.id, { qty: U.round2((Number(item.qty) || 0) + t[1]) }, 'Estorno de cancelamento');
          A.insert('stockMovements', { date: todayF(), itemId: item.id, type: 'devolucao', qty: t[1], unitCost: item.unitCost, reason: 'Cancelamento venda #' + String(sale.code).slice(-6), refType: 'sale', refId: sale.id }, 'Estorno de cancelamento');
        });
      });
      U.toast('Venda cancelada e estoque estornado');
      global.AcaiApp.render();
    }, 'Cancelar venda');
  };
  Act.receipt = function (el) {
    var s = A.get('sales', el.dataset.id); if (!s) return;
    openModal(modalHead('Resumo da venda #' + String(s.code || s.id).slice(-8)) +
      '<div class="card soft"><b>' + esc(A.state.meta.businessName) + '</b><div class="tiny muted">' + U.dateTimeBR(s.dateTime) + ' · ' + esc(s.location || '') + '</div>' +
      '<div class="list" style="margin-top:10px">' + (s.items || []).map(function (i) {
        return '<div class="row"><span class="grow"><b>' + esc(i.name) + '</b><div class="meta">' + U.num(i.qty) + ' × ' + m(i.unitPrice) + (i.discount ? ' − ' + m(i.discount) : '') + '</div></span><span class="amount">' + m(i.total) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="totals-box"><div><span>Subtotal</span><b>' + m(s.subtotal) + '</b></div><div><span>Desconto extra</span><b>' + m(s.discount) + '</b></div>' +
      '<div><span>Pagamento</span><b>' + esc(s.paymentMethod) + '</b></div><div><span>Situação</span><b>' + esc(s.status) + '</b></div>' +
      '<div class="grand"><span>Total</span><span>' + m(s.total) + '</span></div></div></div>' +
      (s.cancelReason ? '<div class="badge bad">Cancelada: ' + esc(s.cancelReason) + '</div>' : '') +
      '<div class="form-actions"><button class="btn ghost" data-act="close-modal">Fechar</button><button class="btn" data-act="print-report">Imprimir / PDF</button></div>');
  };

  /* ---------- Entradas e despesas ---------- */
  function entryForm(id) {
    var e = id ? A.get('entries', id) : null;
    formModal(e ? 'Editar entrada' : 'Nova entrada', [
      { name: 'date', label: 'Data', type: 'date', required: true },
      { name: 'description', label: 'Descrição', required: true, full: true },
      { name: 'category', label: 'Categoria', type: 'select', options: A.ENTRY_CATEGORIES.filter(function (x) { return x.indexOf('Vendas') !== 0; }) },
      { name: 'amount', label: 'Valor (R$)', type: 'number', step: '0.01', min: '0', required: true },
      { name: 'method', label: 'Forma de recebimento', type: 'select', options: A.PAYMENTS },
      { name: 'source', label: 'Origem do dinheiro', ph: 'Quem entregou, de onde veio…' },
      { name: 'accountId', label: 'Conta creditada', type: 'select', options: accountOpts() },
      { name: 'notes', label: 'Observações', type: 'textarea', full: true },
      { name: 'attachment', label: 'Comprovante (até 900 KB)', type: 'file', full: true }
    ], e || { date: todayF(), category: 'Aporte do proprietário', method: 'Dinheiro', accountId: 'acc-caixa' }, function (v) {
      v.amount = Math.abs(v.amount);
      if (e) { A.update('entries', e.id, v, 'Correção de entrada'); U.toast('Entrada atualizada'); }
      else { A.insert('entries', v, 'Entrada registrada'); U.toast('Entrada registrada'); }
      closeModal(); global.AcaiApp.render();
    });
  }
  Act['new-entry'] = function () { entryForm(); };
  Act['edit-entry'] = function (el) { entryForm(el.dataset.id); };

  function expenseForm(id) {
    var e = id ? A.get('expenses', id) : null;
    var partners = A.list('partners');
    var def = e || {
      purchaseDate: todayF(), paymentDate: todayF(), status: 'pago', payerType: 'empresa',
      categoryKey: 'producao', method: 'Dinheiro', accountId: 'acc-caixa'
    };
    var html = modalHead(e ? 'Editar despesa' : 'Nova despesa') + '<form id="expense-form"><div class="form-grid">' +
      fieldHTML({ name: 'name', label: 'Nome da despesa', required: true, full: true }, def.name) +
      fieldHTML({ name: 'categoryKey', label: 'Categoria', type: 'select', options: Object.keys(A.CATEGORIES).map(function (k) { return { v: k, l: A.CATEGORIES[k].label }; }) }, def.categoryKey) +
      fieldHTML({ name: 'subcategory', label: 'Subcategoria', type: 'select', options: A.CATEGORIES.producao.items }, def.subcategory) +
      fieldHTML({ name: 'amount', label: 'Valor (R$)', type: 'number', step: '0.01', min: '0', required: true }, def.amount) +
      fieldHTML({ name: 'purchaseDate', label: 'Data da compra', type: 'date', required: true }, def.purchaseDate) +
      fieldHTML({ name: 'paymentDate', label: 'Data do pagamento', type: 'date' }, def.paymentDate) +
      fieldHTML({ name: 'status', label: 'Status', type: 'select', options: ['pago', 'pendente', 'parcial'] }, def.status) +
      fieldHTML({ name: 'method', label: 'Forma de pagamento', type: 'select', options: A.PAYMENTS }, def.method) +
      fieldHTML({ name: 'supplierId', label: 'Fornecedor', type: 'select', options: [{ v: '', l: 'Nenhum' }].concat(supplierOpts()) }, def.supplierId) +
      fieldHTML({ name: 'accountId', label: 'Conta debitada', type: 'select', options: accountOpts() }, def.accountId) +
      fieldHTML({ name: 'payerType', label: 'Pago por', type: 'select', options: [{ v: 'empresa', l: 'Caixa da empresa' }, { v: 'parceiro', l: 'Sócio individualmente' }] }, def.payerType) +
      fieldHTML({ name: 'payerPartnerId', label: 'Sócio pagador', type: 'select', options: [{ v: '', l: '—' }].concat(partnerOpts()) }, def.payerPartnerId) +
      fieldHTML({ name: 'recurrence', label: 'Recorrência', type: 'select', options: ['Nenhuma', 'Diária', 'Semanal', 'Mensal'] }, def.recurrence || 'Nenhuma') +
      fieldHTML({ name: 'notes', label: 'Observações', type: 'textarea', full: true }, def.notes) +
      fieldHTML({ name: 'attachment', label: 'Comprovante (até 900 KB)', type: 'file', full: true }) +
      '</div><div id="split-box" class="hintbox" style="margin-top:10px"></div>' +
      '<div class="form-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn">Salvar despesa</button></div></form>';
    openModal(html);
    var form = $('#expense-form');
    var catEl = form.elements.categoryKey, subEl = form.elements.subcategory, payerEl = form.elements.payerType;
    function refreshSub() { subEl.innerHTML = U.options(A.CATEGORIES[catEl.value].items, def.subcategory); }
    function refreshSplit() {
      var box = $('#split-box');
      if (payerEl.value !== 'parceiro' || !partners.length) { box.innerHTML = 'Despesa paga pelo caixa da empresa — sem acerto entre sócios.'; return; }
      var spl = def.split || partners.map(function (p) { return { partnerId: p.id, percent: 100 / partners.length }; });
      box.innerHTML = '<b>Divisão da responsabilidade (%)</b><div class="grid g2" style="margin-top:6px">' +
        partners.map(function (p) {
          var line = (spl || []).find(function (x) { return x.partnerId === p.id; }) || { percent: 0 };
          return '<div class="field"><label>' + esc(p.name) + '</label><input type="number" min="0" max="100" step="0.01" class="split-input" data-id="' + p.id + '" value="' + line.percent + '"></div>';
        }).join('') + '</div><div class="tiny muted">A soma deve ser 100%. O acerto entre sócios não gera nova despesa para o negócio.</div>';
    }
    catEl.onchange = refreshSub; payerEl.onchange = refreshSplit;
    refreshSub(); refreshSplit();
    form.onsubmit = function (ev) {
      ev.preventDefault();
      var f = ev.target, amount = U.round2(f.elements.amount.value);
      if (!(amount > 0)) return U.toast('Informe um valor maior que zero.', true);
      var split = [];
      if (f.elements.payerType.value === 'parceiro' && partners.length) {
        U.$$('.split-input').forEach(function (el) { split.push({ partnerId: el.dataset.id, percent: U.round2(el.value) }); });
        var totalPct = C.sum(split, 'percent');
        if (Math.abs(totalPct - 100) > 0.01) return U.toast('A divisão entre sócios deve somar 100%.', true);
      }
      var file = f.elements.attachment.files[0];
      var save = function (attachments) {
        var v = {
          name: f.elements.name.value, categoryKey: f.elements.categoryKey.value,
          category: A.CATEGORIES[f.elements.categoryKey.value].label, subcategory: f.elements.subcategory.value,
          amount: amount, purchaseDate: f.elements.purchaseDate.value,
          paymentDate: f.elements.paymentDate.value || f.elements.purchaseDate.value,
          status: f.elements.status.value, method: f.elements.method.value,
          supplierId: f.elements.supplierId.value, supplierName: (A.get('suppliers', f.elements.supplierId.value) || {}).name || '',
          accountId: f.elements.accountId.value, payerType: f.elements.payerType.value,
          payerPartnerId: f.elements.payerType.value === 'parceiro' ? f.elements.payerPartnerId.value : '',
          split: split, recurrence: f.elements.recurrence.value, notes: f.elements.notes.value,
          attachments: attachments || []
        };
        if (e) { A.update('expenses', e.id, v, 'Correção de despesa'); U.toast('Despesa atualizada'); }
        else { A.insert('expenses', v, 'Despesa registrada'); U.toast('Despesa registrada'); }
        closeModal(); global.AcaiApp.render();
      };
      if (file) {
        if (file.size > 900000) return U.toast('Anexo muito grande (máx. 900 KB).', true);
        U.readFileAsDataURL(file).then(save);
      } else save([]);
    };
  }
  Act['new-expense'] = function () { expenseForm(); };
  Act['edit-expense'] = function (el) { expenseForm(el.dataset.id); };
  Act['pay-expense'] = function (el) {
    var e = A.get('expenses', el.dataset.id); if (!e) return;
    formModal('Baixa da despesa', [
      { name: 'paymentDate', label: 'Data do pagamento', type: 'date', required: true },
      { name: 'accountId', label: 'Conta debitada', type: 'select', options: accountOpts() },
      { name: 'status', label: 'Status', type: 'select', options: ['pago', 'parcial'] },
      { name: 'paidAmount', label: 'Valor pago agora (R$)', type: 'number', step: '0.01', min: '0' }
    ], { paymentDate: todayF(), accountId: e.accountId || 'acc-caixa', status: 'pago', paidAmount: e.amount }, function (v) {
      A.update('expenses', e.id, { paymentDate: v.paymentDate, accountId: v.accountId, status: v.status, paidAmount: v.paidAmount }, 'Baixa de pagamento');
      U.toast('Pagamento registrado'); global.AcaiApp.render();
    }, ' registrar');
  };

  /* ---------- Estoque e produção ---------- */
  function stockForm(id) {
    var i = id ? A.get('stockItems', id) : null;
    formModal(i ? 'Editar item' : 'Novo item de estoque', [
      { name: 'name', label: 'Nome do item', required: true, full: true },
      { name: 'category', label: 'Categoria', type: 'select', options: A.STOCK_CATEGORIES },
      { name: 'unit', label: 'Unidade', type: 'select', options: A.UNITS },
      { name: 'qty', label: 'Quantidade atual', type: 'number', step: '0.001', min: '0' },
      { name: 'minQty', label: 'Estoque mínimo', type: 'number', step: '0.001', min: '0' },
      { name: 'unitCost', label: 'Custo unitário (R$)', type: 'number', step: '0.01', min: '0' },
      { name: 'supplierId', label: 'Fornecedor', type: 'select', options: [{ v: '', l: 'Nenhum' }].concat(supplierOpts()) },
      { name: 'expiry', label: 'Validade', type: 'date' }
    ], i || { category: 'Matéria-prima', unit: 'kg', qty: 0, minQty: 0, unitCost: 0 }, function (v) {
      if (i) { A.update('stockItems', i.id, v, 'Correção de estoque'); U.toast('Item atualizado'); }
      else { A.insert('stockItems', v, 'Item de estoque criado'); U.toast('Item criado'); }
      closeModal(); global.AcaiApp.render();
    });
  }
  Act['new-stock-item'] = function () { stockForm(); };
  Act['edit-stock-item'] = function (el) { stockForm(el.dataset.id); };
  Act['new-movement'] = function () {
    formModal('Movimentar estoque', [
      { name: 'date', label: 'Data', type: 'date', required: true },
      { name: 'itemId', label: 'Item', type: 'select', options: stockOpts() },
      { name: 'type', label: 'Tipo', type: 'select', options: ['entrada', 'saida', 'perda', 'ajuste'] },
      { name: 'qty', label: 'Quantidade', type: 'number', step: '0.001', required: true },
      { name: 'unitCost', label: 'Custo unitário (R$)', type: 'number', step: '0.01' },
      { name: 'reason', label: 'Motivo', required: true, full: true }
    ], { date: todayF(), type: 'entrada', unitCost: 0 }, function (v) {
      var item = A.get('stockItems', v.itemId); if (!item) return U.toast('Selecione um item.', true);
      var delta = v.type === 'entrada' ? Math.abs(v.qty) : v.type === 'ajuste' ? v.qty : -Math.abs(v.qty);
      var newQty = U.round2((Number(item.qty) || 0) + delta);
      A.update('stockItems', item.id, { qty: newQty, unitCost: v.unitCost || item.unitCost }, 'Movimentação: ' + v.reason);
      A.insert('stockMovements', v, 'Movimentação de estoque');
      U.toast('Estoque atualizado'); closeModal(); global.AcaiApp.render();
    });
  };
  Act['new-production'] = function () {
    var prods = A.list('products').filter(function (p) { return A.list('recipes').some(function (r) { return r.productId === p.id; }); });
    if (!prods.length) return U.toast('Cadastre uma ficha técnica antes de produzir.', true);
    function variantsOf(pid) {
      var p = A.get('products', pid) || {};
      return (p.variants || []).map(function (v) { return { v: v.id, l: v.name }; });
    }
    openModal(modalHead('Produzir açaí') + '<form id="prod-form"><div class="form-grid">' +
      fieldHTML({ name: 'date', label: 'Data', type: 'date', required: true }, todayF()) +
      fieldHTML({ name: 'productId', label: 'Produto', type: 'select', options: prods.map(function (p) { return { v: p.id, l: p.name }; }) }) +
      fieldHTML({ name: 'variantId', label: 'Versão', type: 'select', options: variantsOf(prods[0].id) }) +
      fieldHTML({ name: 'units', label: 'Quantidade produzida', type: 'number', step: '1', min: '1', required: true }, 1) +
      '</div><div id="prod-preview" class="hintbox"></div><div class="form-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn">Produzir</button></div></form>');
    var f = $('#prod-form');
    function preview() {
      var rec = A.list('recipes').find(function (r) { return r.productId === f.elements.productId.value && r.variantId === f.elements.variantId.value; });
      var units = Number(f.elements.units.value) || 0;
      $('#prod-preview').innerHTML = rec ? '<b>Insumos necessários:</b><div class="list" style="margin-top:6px">' + (rec.items || []).map(function (i) {
        var it = A.get('stockItems', i.stockItemId) || {};
        var need = Number(i.qty) * units;
        return '<div class="row"><span class="grow">' + esc(it.name || '—') + '</span><span class="' + (it.qty < need ? 'bad' : '') + '">' + U.num(need) + ' ' + esc(it.unit || '') + ' / disp.: ' + U.num(it.qty || 0) + '</span></div>';
      }).join('') + '</div>' : 'Sem ficha técnica para esta versão.';
    }
    f.elements.productId.onchange = function () { f.elements.variantId.innerHTML = U.options(variantsOf(f.elements.productId.value)); preview(); };
    f.elements.variantId.onchange = preview; f.elements.units.oninput = preview; preview();
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var rec = A.list('recipes').find(function (r) { return r.productId === f.elements.productId.value && r.variantId === f.elements.variantId.value; });
      var units = Number(f.elements.units.value) || 0;
      if (!rec || !rec.items) return U.toast('Ficha técnica não encontrada.', true);
      var lack = (rec.items || []).some(function (i) {
        var it = A.get('stockItems', i.stockItemId);
        return !it || (Number(it.qty) || 0) < Number(i.qty) * units;
      });
      if (lack && !confirm('Alguns insumos não têm saldo suficiente. Continuar mesmo assim?')) return;
      rec.items.forEach(function (i) {
        var it = A.get('stockItems', i.stockItemId); if (!it) return;
        var q = Number(i.qty) * units;
        A.update('stockItems', it.id, { qty: U.round2((Number(it.qty) || 0) - q) }, 'Produção');
        A.insert('stockMovements', { date: f.elements.date.value, itemId: it.id, type: 'producao', qty: -q, unitCost: it.unitCost, reason: 'Produção de ' + units + ' un.', refType: 'production', refId: rec.id }, 'Produção');
      });
      var prod = A.get('products', f.elements.productId.value);
      if (prod && prod.stockItemId && A.get('stockItems', prod.stockItemId)) {
        var si = A.get('stockItems', prod.stockItemId);
        A.update('stockItems', si.id, { qty: U.round2((Number(si.qty) || 0) + units) }, 'Produção');
        A.insert('stockMovements', { date: f.elements.date.value, itemId: si.id, type: 'producao', qty: units, unitCost: C.recipeCost(A.state, prod.id, f.elements.variantId.value), reason: 'Produção de ' + units + ' un.', refType: 'production', refId: rec.id }, 'Produção');
      }
      U.toast('Produção registrada'); closeModal(); global.AcaiApp.render();
    };
  };

  /* ---------- Produtos e fichas técnicas ---------- */
  function productForm(id) {
    var p = id ? A.get('products', id) : null;
    var variants = p ? JSON.parse(JSON.stringify(p.variants || [])) : [{ name: '500 ml', volume: '500 ml', salePrice: 0, sku: '' }];
    function renderVariants() {
      $('#variant-rows').innerHTML = '<div class="line-head"><span>Nome</span><span>Volume</span><span>Preço</span><span>SKU</span><span></span></div>' +
        variants.map(function (v, i) {
          return '<div class="line-item" data-vi="' + i + '"><input class="v-name" value="' + esc(v.name) + '"><input class="v-vol" value="' + esc(v.volume) + '"><input class="v-price" type="number" step="0.01" value="' + (v.salePrice || 0) + '"><input class="v-sku" value="' + esc(v.sku) + '"><button type="button" class="x" data-act="remove-variant" data-idx="' + i + '">' + Icon('close', 14) + '</button></div>';
        }).join('');
      U.$$('#variant-rows .line-item').forEach(function (row, i) {
        ['name', 'vol', 'price', 'sku'].forEach(function (k) {
          var el = row.querySelector('.v-' + k);
          el.oninput = function () {
            variants[i][{ name: 'name', vol: 'volume', price: 'salePrice', sku: 'sku' }[k]] = k === 'price' ? U.round2(el.value) : el.value;
          };
        });
      });
    }
    openModal(modalHead(p ? 'Editar produto' : 'Novo produto') + '<form id="product-form"><div class="form-grid">' +
      fieldHTML({ name: 'name', label: 'Nome do produto', required: true, full: true }, p && p.name) +
      fieldHTML({ name: 'category', label: 'Categoria', type: 'select', options: ['Produto acabado', 'Acompanhamento', 'Outros'] }, p && p.category) +
      fieldHTML({ name: 'stockItemId', label: 'Item de estoque correspondente', type: 'select', options: [{ v: '', l: 'Nenhum' }].concat(stockOpts()) }, p && p.stockItemId) +
      '</div><h3 style="margin-top:14px">Versões / tamanhos</h3><div id="variant-rows"></div>' +
      '<button type="button" class="btn ghost small" data-act="add-variant">' + Icon('plus', 14) + ' Adicionar versão</button>' +
      '<div class="form-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn">Salvar produto</button></div></form>');
    renderVariants();
    Act['add-variant'] = function () { variants.push({ name: '', volume: '', salePrice: 0, sku: '' }); renderVariants(); };
    Act['remove-variant'] = function (el) { variants.splice(Number(el.dataset.idx), 1); renderVariants(); };
    $('#product-form').onsubmit = function (ev) {
      ev.preventDefault();
      var f = ev.target;
      if (!variants.length) return U.toast('Adicione ao menos uma versão.', true);
      var data = {
        name: f.elements.name.value, category: f.elements.category.value, stockItemId: f.elements.stockItemId.value,
        variants: variants.map(function (v) { return { id: v.id || U.uid(), name: v.name || 'Padrão', volume: v.volume, salePrice: Number(v.salePrice) || 0, cost: Number(v.cost) || 0, sku: v.sku }; })
      };
      if (p) { A.update('products', p.id, data, 'Correção de produto'); U.toast('Produto atualizado'); }
      else { A.insert('products', data, 'Produto criado'); U.toast('Produto criado'); }
      closeModal(); global.AcaiApp.render();
    };
  }
  Act['new-product'] = function () { productForm(); };
  Act['edit-product'] = function (el) { productForm(el.dataset.id); };
  Act['recalc-costs'] = function () {
    C.recalcCosts(A.state);
    A.list('products').forEach(function (p) { A.update('products', p.id, { variants: p.variants }, 'Recálculo de custos'); });
    U.toast('Custos recalculados a partir das fichas técnicas'); global.AcaiApp.render();
  };
  function recipeForm(productId, variantId) {
    var prod = A.get('products', productId);
    if (!prod) return;
    var v = (prod.variants || []).find(function (x) { return x.id === variantId; }) || {};
    var rec = A.list('recipes').find(function (r) { return r.productId === productId && r.variantId === variantId; });
    var rows = rec ? JSON.parse(JSON.stringify(rec.items || [])) : [];
    function renderRows() {
      $('#recipe-rows').innerHTML = '<div class="line-head"><span>Insumo</span><span>Qtd. por unidade</span><span></span><span></span><span></span></div>' +
        rows.map(function (r, i) {
          return '<div class="line-item" style="grid-template-columns:2fr 1fr 32px"><select class="r-item">' + U.options(stockOpts(), r.stockItemId) + '</select>' +
            '<input class="r-qty" type="number" step="0.001" min="0" value="' + (r.qty || 0) + '"><button type="button" class="x" data-act="remove-recipe-row" data-idx="' + i + '">' + Icon('close', 14) + '</button></div>';
        }).join('');
      U.$$('#recipe-rows .line-item').forEach(function (row, i) {
        row.querySelector('.r-item').onchange = function () { rows[i].stockItemId = this.value; };
        row.querySelector('.r-qty').oninput = function () { rows[i].qty = U.round2(this.value); updateRecipeCost(); };
      });
      updateRecipeCost();
    }
    function updateRecipeCost() {
      var cost = C.sum(rows, function (r) {
        var it = A.get('stockItems', r.stockItemId);
        return (Number(r.qty) || 0) * (it ? Number(it.unitCost) || 0 : 0);
      });
      var box = $('#recipe-cost');
      if (box) box.innerHTML = '<div class="totals-box"><div><span>Custo por unidade</span><b>' + m(cost) + '</b></div>' +
        '<div><span>Preço de venda</span><b>' + m(v.salePrice) + '</b></div>' +
        '<div><span>Lucro bruto/un</span><b>' + m(v.salePrice - cost) + '</b></div>' +
        '<div><span>Margem</span><b>' + (v.salePrice ? U.pct((v.salePrice - cost) / v.salePrice * 100) : '—') + '</b></div></div>';
    }
    openModal(modalHead('Ficha técnica — ' + prod.name + ' / ' + (v.name || '')) +
      '<div class="form-grid"><div class="field"><label>Item de estoque do produto acabado</label><select id="r-finished">' + U.options([{ v: '', l: 'Nenhum' }].concat(stockOpts()), prod.stockItemId) + '</select></div></div>' +
      '<h3 style="margin-top:14px">Ingredientes / insumos</h3><div id="recipe-rows"></div>' +
      '<button type="button" class="btn ghost small" data-act="add-recipe-row">' + Icon('plus', 14) + ' Adicionar insumo</button><div id="recipe-cost"></div>' +
      '<div class="form-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn" id="save-recipe">Salvar ficha</button></div>');
    renderRows();
    Act['add-recipe-row'] = function () { rows.push({ stockItemId: (stockOpts()[0] || {}).v || '', qty: 0 }); renderRows(); };
    Act['remove-recipe-row'] = function (el) { rows.splice(Number(el.dataset.idx), 1); renderRows(); };
    $('#save-recipe').onclick = function () {
      var finished = $('#r-finished').value;
      if (prod.stockItemId !== finished) A.update('products', prod.id, { stockItemId: finished }, 'Vinculação de estoque na ficha técnica');
      var cost = C.sum(rows, function (r) {
        var it = A.get('stockItems', r.stockItemId);
        return (Number(r.qty) || 0) * (it ? Number(it.unitCost) || 0 : 0);
      });
      if (rec) A.update('recipes', rec.id, { items: rows, cost: cost }, 'Correção de ficha técnica');
      else A.insert('recipes', { productId: productId, variantId: variantId, items: rows, cost: cost }, 'Ficha técnica criada');
      var pv = JSON.parse(JSON.stringify(prod.variants));
      var target = pv.find(function (x) { return x.id === variantId; });
      if (target) { target.cost = cost; A.update('products', prod.id, { variants: pv }, 'Custo atualizado pela ficha técnica'); }
      U.toast('Ficha técnica salva'); closeModal(); global.AcaiApp.render();
    };
  }
  Act['edit-recipe'] = function (el) { recipeForm(el.dataset.product, el.dataset.variant); };

  /* ---------- Compras e fornecedores ---------- */
  function supplierForm(id) {
    var x = id ? A.get('suppliers', id) : null;
    formModal(x ? 'Editar fornecedor' : 'Novo fornecedor', [
      { name: 'name', label: 'Nome', required: true, full: true },
      { name: 'contact', label: 'Contato' }, { name: 'phone', label: 'Telefone' },
      { name: 'products', label: 'Produtos fornecidos', full: true },
      { name: 'paymentTerms', label: 'Condições de pagamento' },
      { name: 'notes', label: 'Observações', type: 'textarea', full: true }
    ], x, function (v) {
      if (x) { A.update('suppliers', x.id, v, 'Correção de fornecedor'); U.toast('Fornecedor atualizado'); }
      else { A.insert('suppliers', v, 'Fornecedor criado'); U.toast('Fornecedor criado'); }
      closeModal(); global.AcaiApp.render();
    });
  }
  Act['new-supplier'] = function () { supplierForm(); };
  Act['edit-supplier'] = function (el) { supplierForm(el.dataset.id); };
  Act['new-purchase'] = function () {
    var rows = [{ stockItemId: (stockOpts()[0] || {}).v || '', qty: 1, unitCost: 0 }];
    function renderRows() {
      $('#purchase-rows').innerHTML = '<div class="line-head"><span>Item de estoque</span><span>Qtd</span><span>Custo unit.</span><span>Total</span><span></span></div>' +
        rows.map(function (r, i) {
          return '<div class="line-item" data-pr="' + i + '"><select class="p-item">' + U.options(stockOpts(), r.stockItemId) + '</select>' +
            '<input class="p-qty" type="number" step="0.001" value="' + (r.qty || 0) + '"><input class="p-cost" type="number" step="0.01" value="' + (r.unitCost || 0) + '">' +
            '<span class="p-total mono">' + m((r.qty || 0) * (r.unitCost || 0)) + '</span><button type="button" class="x" data-act="remove-purchase-row" data-idx="' + i + '">' + Icon('close', 14) + '</button></div>';
        }).join('');
      U.$$('#purchase-rows .line-item').forEach(function (row, i) {
        row.querySelector('.p-item').onchange = function () {
          rows[i].stockItemId = this.value;
          var it = A.get('stockItems', this.value);
          if (it) { rows[i].unitCost = it.unitCost; renderRows(); }
        };
        row.querySelector('.p-qty').oninput = function () { rows[i].qty = U.round2(this.value); renderRows(); };
        row.querySelector('.p-cost').oninput = function () { rows[i].unitCost = U.round2(this.value); row.querySelector('.p-total').textContent = m(rows[i].qty * rows[i].unitCost); updatePurchaseTotal(); };
      });
      updatePurchaseTotal();
    }
    function updatePurchaseTotal() {
      var t = C.sum(rows, function (r) { return (Number(r.qty) || 0) * (Number(r.unitCost) || 0); });
      var el = $('#purchase-total'); if (el) el.textContent = m(t);
      return t;
    }
    openModal(modalHead('Nova compra') + '<form id="purchase-form"><div class="form-grid">' +
      fieldHTML({ name: 'date', label: 'Data da compra', type: 'date', required: true }, todayF()) +
      fieldHTML({ name: 'supplierId', label: 'Fornecedor', type: 'select', options: [{ v: '', l: 'Nenhum' }].concat(supplierOpts()) }) +
      fieldHTML({ name: 'categoryKey', label: 'Categoria da despesa', type: 'select', options: Object.keys(A.CATEGORIES).map(function (k) { return { v: k, l: A.CATEGORIES[k].label }; }) }, 'producao') +
      fieldHTML({ name: 'status', label: 'Status do pagamento', type: 'select', options: ['pago', 'pendente', 'parcial'] }, 'pago') +
      '</div><h3 style="margin-top:14px">Itens</h3><div id="purchase-rows"></div>' +
      '<button type="button" class="btn ghost small" data-act="add-purchase-row">' + Icon('plus', 14) + ' Adicionar item</button>' +
      '<div class="totals-box"><div class="grand"><span>Total da compra</span><span id="purchase-total">R$ 0,00</span></div></div>' +
      '<label class="checkline" style="margin-top:10px"><input type="checkbox" id="p-make-expense" checked> Gerar despesa vinculada (evita duplicidade de lançamento)</label>' +
      '<div class="form-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn">Registrar compra</button></div></form>');
    renderRows();
    Act['add-purchase-row'] = function () { rows.push({ stockItemId: (stockOpts()[0] || {}).v || '', qty: 1, unitCost: 0 }); renderRows(); };
    Act['remove-purchase-row'] = function (el) { rows.splice(Number(el.dataset.idx), 1); renderRows(); };
    $('#purchase-form').onsubmit = function (ev) {
      ev.preventDefault();
      var f = ev.target, total = updatePurchaseTotal();
      if (!(total > 0)) return U.toast('Informe itens com valor.', true);
      var p = A.insert('purchases', {
        date: f.elements.date.value, supplierId: f.elements.supplierId.value,
        supplierName: (A.get('suppliers', f.elements.supplierId.value) || {}).name || '',
        items: rows, total: total, expenseId: null
      }, 'Compra registrada');
      rows.forEach(function (r) {
        var it = A.get('stockItems', r.stockItemId); if (!it) return;
        A.update('stockItems', it.id, { qty: U.round2((Number(it.qty) || 0) + Number(r.qty)), unitCost: r.unitCost }, 'Entrada por compra');
        A.insert('stockMovements', { date: f.elements.date.value, itemId: it.id, type: 'entrada', qty: Number(r.qty), unitCost: Number(r.unitCost), reason: 'Compra ' + String(p.id).slice(-6), refType: 'purchase', refId: p.id }, 'Entrada por compra');
      });
      if ($('#p-make-expense').checked) {
        var key = f.elements.categoryKey.value;
        var e = A.insert('expenses', {
          name: 'Compra de ' + ((A.get('suppliers', p.supplierId) || {}).name || 'insumos'),
          categoryKey: key, category: A.CATEGORIES[key].label, subcategory: A.CATEGORIES[key].items[0],
          amount: total, purchaseDate: f.elements.date.value, paymentDate: f.elements.date.value,
          status: f.elements.status.value, method: 'Dinheiro', supplierId: p.supplierId, supplierName: p.supplierName,
          accountId: 'acc-caixa', payerType: 'empresa', payerPartnerId: '', split: [], recurrence: 'Nenhuma',
          purchaseId: p.id, attachments: [], notes: 'Gerada automaticamente pela compra ' + String(p.id).slice(-6)
        }, 'Despesa vinculada à compra');
        A.update('purchases', p.id, { expenseId: e.id }, 'Vinculação da despesa');
      }
      U.toast('Compra registrada'); closeModal(); global.AcaiApp.render();
    };
  };

  /* ---------- Contas, caixa, contas a pagar ---------- */
  function accountForm(id) {
    var a = id ? A.get('accounts', id) : null;
    formModal(a ? 'Editar conta / carteira' : 'Nova conta / carteira', [
      { name: 'name', label: 'Nome da conta', required: true, full: true },
      { name: 'type', label: 'Tipo', type: 'select', options: A.ACCOUNT_TYPES },
      { name: 'openingBalance', label: 'Saldo inicial (R$)', type: 'number', step: '0.01', min: '0' },
      { name: 'notes', label: 'Observações', type: 'textarea', full: true }
    ], a || { type: 'Conta bancária', openingBalance: 0 }, function (v) {
      if (a) { A.update('accounts', a.id, v, 'Correção de conta'); U.toast('Conta atualizada'); }
      else { A.insert('accounts', v, 'Conta criada'); U.toast('Conta criada'); }
      closeModal(); global.AcaiApp.render();
    });
  }
  Act['new-account'] = function () { accountForm(); };
  Act['edit-account'] = function (el) { accountForm(el.dataset.id); };
  Act['new-transfer'] = function () {
    var accs = A.list('accounts');
    if (accs.length < 2) return U.toast('Cadaste duas contas em Configurações.', true);
    formModal('Transferência entre contas', [
      { name: 'date', label: 'Data', type: 'date', required: true },
      { name: 'fromAccountId', label: 'Conta de origem', type: 'select', options: accs.map(function (a) { return { v: a.id, l: a.name }; }) },
      { name: 'toAccountId', label: 'Conta de destino', type: 'select', options: accs.map(function (a) { return { v: a.id, l: a.name }; }) },
      { name: 'amount', label: 'Valor (R$)', type: 'number', step: '0.01', min: '0', required: true },
      { name: 'description', label: 'Descrição', full: true }
    ], { date: todayF() }, function (v) {
      if (v.fromAccountId === v.toAccountId) return U.toast('Escolha contas diferentes.', true);
      if (!(v.amount > 0)) return U.toast('Valor inválido.', true);
      A.insert('transfers', v, 'Transferência interna');
      U.toast('Transferência registrada — não conta como receita ou despesa'); closeModal(); global.AcaiApp.render();
    });
  };
  Act['new-count'] = function () {
    var bal = C.accountBalances(A.state);
    formModal('Conciliação de caixa', [
      { name: 'date', label: 'Data', type: 'date', required: true },
      { name: 'accountId', label: 'Conta', type: 'select', options: accountOpts() },
      { name: 'countedBalance', label: 'Valor efetivamente contado (R$)', type: 'number', step: '0.01', required: true },
      { name: 'notes', label: 'Observações', type: 'textarea', full: true }
    ], { date: todayF(), accountId: 'acc-caixa', countedBalance: bal['acc-caixa'] || 0 }, function (v) {
      A.insert('cashCounts', Object.assign(v, { systemBalance: bal[v.accountId] || 0 }), 'Conciliação registrada');
      U.toast('Conciliação registrada'); closeModal(); global.AcaiApp.render();
    });
  };
  Act['new-bill'] = function () {
    var type = global.AcaiApp.UI.billType || 'pagar';
    formModal(type === 'pagar' ? 'Nova conta a pagar' : 'Nova conta a receber', [
      { name: 'person', label: type === 'pagar' ? 'Fornecedor / credor' : 'Cliente / devedor', required: true },
      { name: 'description', label: 'Descrição', required: true, full: true },
      { name: 'amount', label: 'Valor (R$)', type: 'number', step: '0.01', min: '0', required: true },
      { name: 'dueDate', label: 'Vencimento', type: 'date', required: true },
      { name: 'installments', label: 'Parcelas', type: 'number', step: '1', min: '1' },
      { name: 'accountId', label: 'Conta', type: 'select', options: accountOpts() },
      { name: 'notes', label: 'Observações', type: 'textarea', full: true }
    ], { dueDate: todayF(), installments: 1, accountId: 'acc-caixa' }, function (v) {
      v.type = type; v.status = 'pendente';
      A.insert('bills', v, 'Conta cadastrada'); U.toast('Conta cadastrada'); closeModal(); global.AcaiApp.render();
    });
  };
  Act['pay-bill'] = function (el) {
    var b = A.get('bills', el.dataset.id); if (!b) return;
    formModal(b.type === 'pagar' ? 'Pagar conta' : 'Receber conta', [
      { name: 'paidDate', label: 'Data', type: 'date', required: true },
      { name: 'accountId', label: 'Conta', type: 'select', options: accountOpts() }
    ], { paidDate: todayF(), accountId: b.accountId || 'acc-caixa' }, function (v) {
      A.update('bills', b.id, Object.assign(v, { status: 'pago' }), 'Baixa da conta');
      U.toast('Conta baixada'); closeModal(); global.AcaiApp.render();
    });
  };

  /* ---------- Meta ---------- */
  Act['edit-goal'] = function () {
    var g = A.state.meta.goal;
    formModal('Configurar meta', [
      { name: 'amount', label: 'Valor da meta (R$)', type: 'number', step: '0.01', min: '0', required: true },
      { name: 'startDate', label: 'Data inicial', type: 'date', required: true },
      { name: 'endDate', label: 'Prazo final', type: 'date', required: true }
    ], g, function (v) {
      if (v.endDate <= v.startDate) return U.toast('O prazo final deve ser posterior ao início.', true);
      A.state.meta.goal = v; A.saveState(); A.audit('meta', 'goal', 'editar', g, v, 'Configuração da meta');
      U.toast('Meta atualizada'); closeModal(); global.AcaiApp.render();
    });
  };
  function goalMove(type) {
    formModal(type === 'deposito' ? 'Aporte na meta' : 'Retirada da meta', [
      { name: 'date', label: 'Data', type: 'date', required: true },
      { name: 'amount', label: 'Valor (R$)', type: 'number', step: '0.01', min: '0', required: true },
      { name: 'accountId', label: type === 'deposito' ? 'Conta de origem' : 'Conta de destino', type: 'select', options: accountOpts() },
      { name: 'description', label: 'Descrição', full: true },
      { name: 'attachment', label: 'Comprovante', type: 'file', full: true }
    ], { date: todayF(), accountId: 'acc-caixa' }, function (v) {
      if (!(v.amount > 0)) return U.toast('Valor inválido.', true);
      v.type = type;
      A.insert('goalMovements', v, type === 'deposito' ? 'Aporte na meta' : 'Retirada da meta');
      U.toast(type === 'deposito' ? 'Aporte registrado na reserva' : 'Retirada registrada'); closeModal(); global.AcaiApp.render();
    });
  }
  Act['goal-deposit'] = function () { goalMove('deposito'); };
  Act['goal-withdraw'] = function () { goalMove('saque'); };

  /* ---------- Sócios ---------- */
  function partnerForm(id) {
    var p = id ? A.get('partners', id) : null;
    formModal(p ? 'Editar sócio' : 'Novo sócio', [
      { name: 'name', label: 'Nome', required: true, full: true },
      { name: 'percentage', label: 'Participação (%)', type: 'number', step: '0.01', min: '0', max: '100', required: true },
      { name: 'joinDate', label: 'Data de entrada', type: 'date', required: true },
      { name: 'notes', label: 'Observações', type: 'textarea', full: true }
    ], p || { joinDate: todayF(), percentage: A.list('partners').length ? 0 : 100 }, function (v) {
      if (v.percentage < 0 || v.percentage > 100) return U.toast('Percentual inválido.', true);
      if (p) { A.update('partners', p.id, v, 'Correção de sócio'); U.toast('Sócio atualizado'); }
      else { A.insert('partners', v, 'Sócio cadastrado'); U.toast('Sócio cadastrado'); }
      closeModal(); global.AcaiApp.render();
    });
  }
  Act['new-partner'] = function () { partnerForm(); };
  Act['edit-partner'] = function (el) { partnerForm(el.dataset.id); };
  Act['new-partner-tx'] = function () {
    var ps = A.list('partners');
    if (!ps.length) return U.toast('Cadastre um sócio primeiro.', true);
    formModal('Movimentação societária', [
      { name: 'date', label: 'Data', type: 'date', required: true },
      { name: 'partnerId', label: 'Sócio', type: 'select', options: ps.map(function (p) { return { v: p.id, l: p.name }; }) },
      { name: 'type', label: 'Tipo', type: 'select', options: [
        { v: 'investimento', l: 'Investimento' }, { v: 'capital_giro', l: 'Aporte para capital de giro' },
        { v: 'emprestimo', l: 'Empréstimo do sócio' }, { v: 'reembolso', l: 'Reembolso recebido' },
        { v: 'retirada', l: 'Retirada' }, { v: 'dividendo', l: 'Lucro recebido' }
      ] },
      { name: 'amount', label: 'Valor (R$)', type: 'number', step: '0.01', min: '0', required: true },
      { name: 'description', label: 'Descrição / finalidade', full: true },
      { name: 'status', label: 'Status', type: 'select', options: ['pago', 'pendente'] },
      { name: 'attachment', label: 'Comprovante', type: 'file', full: true }
    ], { date: todayF(), status: 'pago' }, function (v) {
      A.insert('partnerTransactions', v, 'Movimentação societária');
      U.toast('Movimentação registrada'); closeModal(); global.AcaiApp.render();
    });
  };
  Act['settle-partners'] = function (el) {
    var from = el.dataset.from, to = el.dataset.to, amount = U.round2(el.dataset.amount);
    formModal('Quitar acerto entre sócios', [
      { name: 'date', label: 'Data', type: 'date', required: true },
      { name: 'description', label: 'Descrição', value: '' }
    ], { date: todayF() }, function (v) {
      A.insert('partnerTransactions', {
        date: v.date, partnerId: from, toPartnerId: to, type: 'acerto', amount: amount,
        description: v.description || 'Acerto de despesas compartilhadas', status: 'pago'
      }, 'Acerto entre sócios quitado');
      U.toast('Acerto registrado — sem impacto nas despesas do negócio'); closeModal(); global.AcaiApp.render();
    });
  };
  Act['new-distribution'] = function () {
    var ps = A.list('partners');
    if (!ps.length) return U.toast('Cadastre os sócios primeiro.', true);
    var pctSum = C.sum(ps, 'percentage');
    if (Math.abs(pctSum - 100) > 0.01) return U.toast('Os percentuais dos sócios devem somar 100% (atual: ' + U.num(pctSum) + '%).', true);
    var today = U.today(), from = today.slice(0, 7) + '-01';
    var metrics = C.metrics(A.state, from, today);
    openModal(modalHead('Distribuir lucro') + '<form id="dist-form"><div class="form-grid">' +
      fieldHTML({ name: 'periodStart', label: 'Início do período', type: 'date', required: true }, from) +
      fieldHTML({ name: 'periodEnd', label: 'Fim do período', type: 'date', required: true }, today) +
      fieldHTML({ name: 'netProfit', label: 'Lucro líquido do período (R$)', type: 'number', step: '0.01' }, metrics.netProfit) +
      fieldHTML({ name: 'reserveReinvest', label: 'Reserva para reinvestimento (R$)', type: 'number', step: '0.01' }, 0) +
      fieldHTML({ name: 'reserveCash', label: 'Reserva de caixa / giro (R$)', type: 'number', step: '0.01' }, 0) +
      '</div><div class="totals-box" id="dist-preview"></div>' +
      '<h3 style="margin-top:14px">Rateio por sócio</h3><div id="dist-lines"></div>' +
      '<div class="form-actions"><button type="button" class="btn ghost" data-act="close-modal">Cancelar</button><button class="btn">Registrar distribuição</button></div></form>');
    var f = $('#dist-form');
    function refresh() {
      var net = Number(f.elements.netProfit.value) || 0;
      var rr = Number(f.elements.reserveReinvest.value) || 0, rc = Number(f.elements.reserveCash.value) || 0;
      var dist = U.round2(net - rr - rc);
      $('#dist-preview').innerHTML = '<div><span>Lucro líquido</span><b>' + m(net) + '</b></div><div><span>Reservas</span><b>' + m(rr + rc) + '</b></div>' +
        '<div><span>Distribuível</span><b>' + m(dist) + '</b></div><div><span>Saldo disponível no caixa</span><b>' + m(C.metrics(A.state).available) + '</b></div>';
      $('#dist-lines').innerHTML = ps.map(function (p) {
        return '<div class="row"><span class="grow"><b>' + esc(p.name) + '</b><div class="meta">' + U.pct(p.percentage, 0) + '</div></span>' +
          '<span class="amount">' + m(dist * Number(p.percentage) / 100) + '</span></div>';
      }).join('');
      f._dist = dist;
    }
    ['netProfit', 'reserveReinvest', 'reserveCash'].forEach(function (n) { f.elements[n].oninput = refresh; });
    refresh();
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var dist = f._dist;
      if (dist < 0) return U.toast('Reservas maiores que o lucro líquido.', true);
      if (dist > C.metrics(A.state).available) return U.toast('Não há dinheiro disponível para distribuir esse valor.', true);
      A.insert('profitDistributions', {
        date: todayF(), periodStart: f.elements.periodStart.value, periodEnd: f.elements.periodEnd.value,
        netProfit: U.round2(f.elements.netProfit.value), reserveReinvest: U.round2(f.elements.reserveReinvest.value),
        reserveCash: U.round2(f.elements.reserveCash.value), distributable: dist,
        lines: ps.map(function (p) { return { partnerId: p.id, percent: Number(p.percentage), amount: U.round2(dist * Number(p.percentage) / 100), status: 'pendente' }; }),
        approvedBy: A.currentUser()
      }, 'Distribuição de lucro');
      U.toast('Distribuição registrada'); closeModal(); global.AcaiApp.render();
    };
  };

  /* ---------- Exclusão genérica, exportações e nuvem ---------- */
  Act['delete-record'] = function (el) {
    var entity = el.dataset.entity, id = el.dataset.id;
    var rec = A.get(entity, id); if (!rec) return;
    if (entity === 'accounts' && A.list('accounts').length <= 1) return U.toast('Mantenha ao menos uma conta para registrar movimentações.', true);
    confirmDialog('Excluir registro', 'O registro será marcado como excluído e permanecerá no histórico de auditoria. Deseja continuar?', function () {
      A.remove(entity, id, 'Exclusão solicitada pelo usuário');
      U.toast('Registro excluído com auditoria'); global.AcaiApp.render();
    }, 'Excluir');
  };
  Act['go'] = function (el) { global.AcaiApp.navigate(el.dataset.route); };
  Act['settings-section'] = function (el) {
    global.AcaiApp.UI.settingsSection = el.dataset.section || 'general';
    global.AcaiApp.UI.saveState = null;
    global.AcaiApp.render();
  };
  Act['segment'] = function (el) {
    var app = global.AcaiApp;
    if (el.dataset.group === 'period') app.UI.period = el.dataset.value;
    if (el.dataset.group === 'cashPeriod') app.UI.cashPeriod = el.dataset.value;
    if (el.dataset.group === 'billType') app.UI.billType = el.dataset.value;
    app.render();
  };
  Act['toggle-derived'] = function () { global.AcaiApp.UI.showDerived = !global.AcaiApp.UI.showDerived; global.AcaiApp.render(); };
  Act['toggle-theme'] = function () {
    var order = ['light', 'dark', 'auto'], i = order.indexOf(A.state.meta.theme);
    A.state.meta.theme = order[(i + 1) % order.length];
    global.AcaiApp.applyTheme(); A.saveState(); global.AcaiApp.render();
  };
  Act['close-modal'] = closeModal;
  Act['close-modal-bg'] = function (el, ev) { if (ev.target.classList.contains('modal-back')) closeModal(); };

  Act['export-sales'] = function () {
    var rows = [['Código', 'Data/hora', 'Produto', 'Qtd', 'Valor unit.', 'Desconto', 'Total', 'Pagamento', 'Local', 'Situação']];
    A.list('sales').forEach(function (s) { (s.items || []).forEach(function (i) {
      rows.push([s.code, s.dateTime, i.name, i.qty, i.unitPrice, i.discount, i.total, s.paymentMethod, s.location, s.status]);
    }); });
    U.exportCSV('vendas', rows);
  };
  Act['export-entries'] = function () {
    var rows = [['Data', 'Descrição', 'Categoria', 'Valor', 'Forma', 'Origem', 'Observações']];
    A.list('entries').forEach(function (e) { rows.push([e.date, e.description, e.category, e.amount, e.method, e.source, e.notes]); });
    U.exportCSV('entradas', rows);
  };
  Act['export-expenses'] = function () {
    var rows = [['Nome', 'Categoria', 'Valor', 'Compra', 'Pagamento', 'Status', 'Pagador', 'Fornecedor', 'Observações']];
    A.list('expenses').forEach(function (e) { rows.push([e.name, e.category, e.amount, e.purchaseDate, e.paymentDate, e.status, e.payerPartnerId ? partnerName(e.payerPartnerId) : 'Empresa', e.supplierName, e.notes]); });
    U.exportCSV('despesas', rows);
  };
  function ledgerRows(from, to) {
    var rows = [['Data', 'Tipo', 'Descrição', 'Conta', 'Valor']];
    var push = function (dt, type, label, acc, amount) { rows.push([dt, type, label, (A.get('accounts', acc) || {}).name || '', amount]); };
    A.list('sales').forEach(function (x) { if (x.status !== 'cancelada') push(x.dateTime, 'entrada', 'Venda ' + x.code, x.accountId, x.total); });
    A.list('entries').forEach(function (x) { push(x.date, 'entrada', x.description, x.accountId, x.amount); });
    A.list('expenses').forEach(function (x) { if (x.status === 'pago') push(x.paymentDate || x.purchaseDate, 'saída', x.name, x.accountId, -x.amount); });
    A.list('transfers').forEach(function (x) { push(x.date, 'transferência', 'De ' + ((A.get('accounts', x.fromAccountId) || {}).name || ''), x.fromAccountId, -x.amount); push(x.date, 'transferência', 'Para ' + ((A.get('accounts', x.toAccountId) || {}).name || ''), x.toAccountId, x.amount); });
    return rows;
  }
  Act['export-cashflow'] = function () { U.exportCSV('fluxo-de-caixa', ledgerRows()); };
  Act['export-dash'] = function () {
    var k = C.metrics(A.state);
    U.exportCSV('indicadores', [['Indicador', 'Valor'], ['Faturamento', k.revenue], ['Lucro bruto', k.grossProfit], ['Lucro líquido', k.netProfit], ['Total de entradas', k.totalIn], ['Total de saídas', k.totalOut], ['Saldo disponível', k.available], ['Dívidas', k.debts], ['Acumulado da meta', k.accumulated], ['Margem %', k.margin]]);
  };
  Act['export-json'] = Act.backup = function () {
    U.download('acai-erp-backup-' + U.today() + '.json', JSON.stringify({ app: 'acai-erp', exportedAt: U.isoNow(), state: A.state }, null, 2), 'application/json');
    U.toast('Backup exportado');
  };
  Act['restore'] = function () {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.onchange = function () {
      var file = input.files[0]; if (!file) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var obj = JSON.parse(r.result);
          var incoming = obj.state || obj;
          if (!incoming.meta || !Array.isArray(incoming.sales)) throw new Error('Arquivo inválido.');
          confirmDialog('Restaurar backup', 'Os registros serão mesclados por ID e data de atualização. Registros mais recentes no aparelho serão preservados. Continuar?', function () {
            A.replaceState(A.mergeStates(A.state, incoming));
            U.toast('Backup restaurado'); global.AcaiApp.render();
          }, 'Restaurar');
        } catch (e) { U.toast('Erro ao restaurar: ' + e.message, true); }
      };
      r.readAsText(file);
    };
    input.click();
  };
  Act['clear-all'] = function () {
    confirmDialog('Excluir todos os dados', 'Esta ação apaga todos os registros, incluindo o histórico de auditoria, e sincroniza a exclusão se você estiver conectado. Deseja continuar?', function () {
      A.resetState();
      U.toast('Dados locais excluídos'); global.AcaiApp.render();
    }, 'Excluir');
  };
  Act['print-report'] = function () { setTimeout(function () { global.print(); }, 80); };
  Act['export-report-csv'] = function () {
    var ui = global.AcaiApp.UI, k = C.metrics(A.state, ui.f.from, ui.f.to);
    var kind = ui.report || 'dre';
    var rows = [['Relatório', kind], ['Período', (ui.f.from || '') + ' a ' + (ui.f.to || '')], ['Gerado em', U.nowDT()], []];
    if (kind === 'dre') C.dre(A.state, ui.f.from, ui.f.to).forEach(function (x) { rows.push([x[0], x[1]]); });
    else if (kind === 'topproducts' || kind === 'byproduct' || kind === 'performance') {
      rows.push(['Produto', 'Qtd', 'Faturamento', 'Custo', 'Lucro', 'Margem %']);
      Object.keys(k.byProduct).forEach(function (x) { var p = k.byProduct[x]; rows.push([x, p.qty, p.revenue, p.cost, p.profit, p.margin]); });
    } else if (kind === 'location') { rows.push(['Local', 'Valor']); Object.keys(k.byLocation).forEach(function (x) { rows.push([x, k.byLocation[x]]); }); }
    else if (kind === 'payment') { rows.push(['Pagamento', 'Valor']); Object.keys(k.byPayment).forEach(function (x) { rows.push([x, k.byPayment[x]]); }); }
    else if (kind === 'saledays') { rows.push(['Data', 'Valor']); Object.keys(k.byDay).forEach(function (x) { rows.push([x, k.byDay[x]]); }); }
    else rows = rows.concat(ledgerRows());
    U.exportCSV('relatorio-' + kind, rows);
  };
  Act['sync-now'] = function () {
    if (!A.cloud.status.session) return U.toast('Entre em uma conta para sincronizar.', true);
    U.toast('Sincronizando…'); A.cloud.push().then(function (ok) { U.toast(ok ? 'Sincronizado' : 'Falha na sincronização', !ok); });
  };
  Act['sign-out'] = function () {
    confirmDialog('Sair da conta', 'Os dados locais permanecem neste aparelho. Deseja sair?', function () {
      A.cloud.signOut().then(function () { U.toast('Sessão encerrada'); global.AcaiApp.render(); });
    }, 'Sair');
  };
  Act['local-mode'] = function () {
    var on = !A.cloud.status.localMode;
    A.cloud.setLocalMode(on);
    U.toast(on ? 'Modo somente local ativado' : 'Sincronização reativada');
    global.AcaiApp.render();
    if (!on) A.cloud.init().then(function () { global.AcaiApp.render(); });
  };
  Act['open-auth'] = function () {
    openModal(modalHead('Conta e sincronização') + V.authScreen().replace('<div class="auth-wrap">', '<div>').replace('<h1>Açaí ERP</h1>', ''));
  };
  Act['open-sync'] = function () { global.AcaiApp.navigate('settings'); };
  Act['continue-local'] = function () { A.cloud.setLocalMode(true); closeModal(); global.AcaiApp.render(); U.toast('Modo local ativado'); };
  Act['forgot'] = function () {
    formModal('Recuperar senha', [{ name: 'email', label: 'E-mail', type: 'email', required: true, full: true }], {}, function (v) {
      A.cloud.resetPassword(v.email).then(function () { U.toast('Link de recuperação enviado'); closeModal(); }).catch(function (e) { U.toast(e.message, true); });
    }, 'Enviar link');
  };
  function doAuth(kind) {
    var f = $('#form-login'); if (!f) return;
    var email = f.elements.email.value, pass = f.elements.password.value;
    var promise = kind === 'signup' ? A.cloud.signUp(email, pass) : A.cloud.signIn(email, pass);
    promise.then(function (res) {
      if (res === 'confirm') { U.toast('Confirme seu e-mail antes de entrar.'); return; }
      closeModal(); U.toast(kind === 'signup' ? 'Conta criada' : 'Conectado'); global.AcaiApp.render();
    }).catch(function (e) { U.toast(e.message || 'Falha na autenticação', true); });
  }
  Act['signup'] = function () { doAuth('signup'); };
  Act['login'] = doAuth;

  global.AcaiActions = Act;
})(window);
