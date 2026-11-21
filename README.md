# Acai ERP

PWA (Progressive Web App) **offline-first** para gestão de um negócio de açaí: vendas, estoque, produtos com custos, despesas, sócios, metas e caixa, com sincronização opcional via Supabase.

## Visão geral

- **Funciona sem internet.** O estado inteiro do negócio vive no navegador e é salvo localmente; a interface continua operando offline.
- **Sincronização simples.** Quando há rede, o estado é enviado para uma única linha por usuário na tabela `acai_data` do Supabase. O merge é feito no cliente, registro a registro, comparando `updatedAt` (ISO) com *last-write-wins*.
- **Sem build e sem framework.** São arquivos estáticos (HTML/CSS/JS) servidos por qualquer servidor simples ou pelo GitHub Pages.
- **Isolamento dos dados.** O projeto Supabase é o mesmo do `painel-vida`; todas as tabelas deste app usam o prefixo `acai_`.
- **Segurança por RLS.** Cada usuário autenticado só acessa a própria linha. A chave publishable é pública por design; `service_role` é terminantemente proibida no navegador.

## Arquitetura

| Arquivo | Função |
|---|---|
| `index.html` | Casca da aplicação e das telas |
| `js/icons.js` | Conjunto único de ícones SVG (traço de 1,8px, `currentColor`) usado em toda a interface |
| Arquivos `.js` | Estado, regras de negócio, persistência local, merge/sync e interface |
| Arquivos `.css` | Tema, layout responsivo e impressão |
| `manifest.json` | Nome, ícones e `display: standalone` — habilita a instalação como app |
| `sw.js` | Service worker: cache dos arquivos estáticos para funcionamento offline |
| `SUPABASE.sql` | Tabelas `acai_data` e `acai_audit`, RLS, trigger, índice e bloco de verificação |
| `CONFIGURE.md` | Passo a passo de configuração, uso e publicação |
| `README.md` | Visão geral, regras e limitações (este arquivo) |

> Os nomes exatos dos arquivos `.js`/`.css` podem variar entre versões do app; o modelo é sempre o mesmo: estáticos + service worker + manifest, sem etapa de compilação.

O objeto raiz `state` contém: `meta`, `accounts`, `partners`, `suppliers`, `stockItems`, `products`, `recipes`, `sales`, `entries`, `expenses`, `purchases`, `stockMovements`, `bills`, `goalMovements`, `partnerTransactions`, `profitDistributions`, `transfers`, `cashCounts` e `audit`. Toda entidade possui `id`, `updatedAt` (ISO) e `deleted` (booleano de exclusão lógica). Entidades excluídas viram *tombstones* e permanecem no JSON para que a exclusão não seja desfeita em outro dispositivo.

## Módulos do primeiro ciclo

| Módulo | O que faz |
|---|---|
| **Dashboard** | Visão consolidada de faturamento, despesas, resultado, saldo das contas, metas e alertas de estoque mínimo. |
| **Vendas** | Registro de vendas com itens, variantes, descontos, forma de pagamento, local, status e cancelamento com motivo; baixa de estoque pela receita do produto. |
| **Entradas** | Entradas manuais de caixa com categoria, conta, método e anexos. A categoria `Vendas` é somente leitura e derivada de `sales`. |
| **Despesas** | Despesas com categoria/subcategoria, fornecedor, status, recorrência, pagador (sócio ou empresa), rateio entre sócios e anexos. |
| **Fluxo de caixa** | Entradas e saídas por conta e período, com saldo inicial e projeção; transferências não alteram o total consolidado. |
| **Estoque** | Itens com unidade, quantidade, mínimo, custo, fornecedor e validade; compras, movimentações e alertas de reposição. |
| **Produtos e custos** | Produtos com variantes (volume, preço, custo, SKU) e receitas que ligam variantes a itens de estoque para calcular o custo da venda. |
| **Metas** | Meta de faturamento com período e movimentos de depósito/retirada (`goalMovements`). |
| **Sócios** | Cadastro, percentual, data de entrada, aportes totais e observações; transações e histórico de participação. |
| **Contas** | Contas de caixa/banco com saldo inicial e saldo atual; transferências e conferências de caixa (`cashCounts`). |
| **Contas a pagar/receber** | Títulos com tipo, pessoa, descrição, valor, vencimento, status, parcelas, data de pagamento e vínculo com despesa (`bills`). |
| **Configurações** | Dados do negócio, moeda, fuso horário, tema, integração Supabase (URL/chave), sincronização, backup/exportação e importação. |
| **Auditoria** | Registro de `before`/`after`, ação, motivo, data e usuário para alterações relevantes; espelho opcional em `acai_audit`. |
| **Relatórios** | Exportação em **CSV** e **JSON** e impressão para **PDF** pelo navegador. Exportação **XLSX fica para o próximo ciclo**. |

## Regras contábeis implementadas

- **Faturamento, lucro, saldo e patrimônio são coisas diferentes.**
  - *Faturamento*: soma das vendas não canceladas no período.
  - *Lucro*: faturamento − custo dos produtos vendidos (calculado pelas receitas e movimentações de estoque) − despesas do período.
  - *Saldo*: dinheiro disponível nas contas (`openingBalance` + entradas − saídas).
  - *Patrimônio financeiro consolidado*: soma dos saldos das contas, incluindo a reserva da meta. O estoque é ativo separado (mostrado em "Estoque em valor") e não é somado ao saldo de caixa.
- **Aportes não são receita.** Aportes registrados em **Entradas** (categoria `Aporte do proprietário` ou `Investimento externo`) aumentam o saldo e o patrimônio financeiro, mas não entram em faturamento nem em lucro. Os aportes cadastrados em **Sócios** representam o capital societário; para refletir o dinheiro na conta, registre também a entrada correspondente.
- **Transferências não são receita nem despesa.** Movem valor de `fromAccountId` para `toAccountId`: uma conta diminui, outra aumenta; o resultado e o fluxo consolidado permanecem inalterados.
- **Compras não duplicam despesa.** Compra para estoque vira `stockItems`/`stockMovements` e só se torna custo (CMV) quando o produto é vendido. Compra de uso imediato baixada como despesa usa `expenseId` e é reconhecida uma única vez. O mesmo valor nunca aparece como despesa e como CMV simultaneamente.
- **Vendas canceladas não faturam.** O estorno da baixa de estoque é registrado em `stockMovements` com `refType`/`refId` apontando para a venda e motivo de cancelamento.
- **Categoria `Vendas` em `entries` é derivada e somente leitura.** Nunca crie entrada manual com essa categoria: isso duplicaria o faturamento.
- **Histórico preservado.** Nada é apagado fisicamente: exclusões usam `deleted: true`, e a auditoria guarda `before`, `after`, `at`, `reason` e `userId`. Editar um lançamento não reescreve sua data original.
- **Metas são reserva, não receita.** `goalMovements` (`deposito`/`saque`) movem dinheiro entre a conta escolhida e a conta `Reserva financeira`: medem o progresso de `meta.goal` sem virar faturamento, despesa ou novo patrimônio.
- **Rateios e distribuições.** `expenses[].split` distribui percentuais entre sócios (somando 100) e define quem pagou; `profitDistributions` calcula `netProfit`, reservas e valor distribuível com confirmação por linha. Distribuição de lucro não é despesa operacional.

## Como rodar localmente

Dentro da pasta do projeto:

```bash
cd "C:\Users\55139\Documents\Projeto Padrão\acai-erp"
npx serve .
# acesse http://localhost:3000
```

Ou com Python:

```bash
python -m http.server 8080
# acesse http://localhost:8080
# em Linux/macOS: python3 -m http.server 8080
```

Depois de abrir no navegador, configure a integração em **Configurações** se necessário, faça login e clique em **Sincronizar**. Evite abrir o `index.html` via `file://`: service worker e autenticação podem não funcionar. Veja `CONFIGURE.md` para o passo a passo completo do Supabase.

Para rodar com o servidor incluído nesta pasta (sem dependências):

```bash
node serve.js
# acesse http://127.0.0.1:4174
```

Para validar as regras de cálculo:

```bash
node tests/calc.test.js
```

## Como instalar como PWA

- **Chrome/Edge (Windows ou Android)**: abra o site em HTTPS (ou `localhost`) e use o ícone de instalação na barra de endereço; no Android, **Menu → Adicionar à tela inicial / Instalar app**.
- **Safari (iPhone/iPad)**: **Compartilhar → Adicionar à Tela de Início**.
- Após instalar, abra o app uma vez com internet para popular o cache. Nas versões seguintes, o service worker atualiza o cache automaticamente; se algo parecer desatualizado, recarregue a página.

## Limitações conhecidas do primeiro ciclo

- **XLSX não está incluído**; estão disponíveis CSV, JSON e impressão para PDF.
- **Conflito é last-write-wins por registro**: se o mesmo registro for editado em dois dispositivos offline, vence o `updatedAt` maior. Não há merge campo a campo nem tela de resolução manual; mantenha o relógio dos dispositivos ajustado automaticamente.
- **Anexos ficam dentro do JSON** (`attachments`, `attachment`). Arquivos grandes em base64 podem deixar a linha pesada e o sync lento. Não há integração com Supabase Storage neste ciclo.
- **Escopo de um usuário por conta Supabase**: não há permissões por loja/filial, edição colaborativa em tempo real nem histórico de versões campo a campo.
- **Relatórios são básicos**: sem gráficos avançados, conciliação bancária automática, emissão de NF-e/SEFAZ ou integração com gateways de pagamento.
- **Auditoria espelhada é dependente do app**: `acai_audit` só contém o que o aplicativo enviar; o histórico completo permanece em `state.audit` dentro do JSON.
- **Sem migração automática de esquema**: mudanças na estrutura do `state` exigem atenção a `meta.version` e, se necessário, conversão manual dos JSONs antigos.
- **GitHub Pages é somente estático**: não existe backend no navegador e nenhum segredo pode ser deixado no código. A chave `service_role` nunca deve ser usada no cliente — apenas a chave publishable, protegida por RLS.
