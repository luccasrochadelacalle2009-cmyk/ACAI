# Configuração — Acai ERP (PWA)

Guia completo para preparar o Supabase, entender a chave de acesso, usar a sincronização no dia a dia e publicar o aplicativo no GitHub Pages.

## 1. Pré-requisitos

- Projeto Supabase já existente: **tkgdeklhkhutvgskrbgd** (`https://tkgdeklhkhutvgskrbgd.supabase.co`), o mesmo usado pelo `painel-vida`.
- Acesso de administrador a esse projeto.
- Pelo menos um usuário criado no Supabase Auth (**Authentication → Users → Add user**) — o primeiro login também pode ser feito pelo próprio app se o cadastro estiver habilitado.
- Navegador moderno acessando por HTTPS ou por `localhost` (service workers exigem contexto seguro).

## 2. Executar o SQL no Supabase

1. Acesse `https://supabase.com/dashboard` e selecione o projeto **tkgdeklhkhutvgskrbgd**.
2. No menu lateral, abra **SQL Editor**.
3. Clique em **New query** (ou no ícone `+`).
4. Copie o conteúdo integral de `SUPABASE.sql` e cole na área de edição.
5. Clique em **Run** (ou `Ctrl+Enter` / `Cmd+Enter`).
6. Role até o final do resultado e confira a seção **VERIFICAÇÃO**:
   - `tabela_estado` e `tabela_auditoria` preenchidos;
   - `rls_acai_data = true`;
   - `policies_acai_data = 4` e `policies_acai_audit = 4`;
   - `indice_updated_at = 1`;
   - `trigger_updated_at = 1`;
   - `linhas_estado` e `linhas_auditoria` começam em `0` — é o esperado.
7. Execute também o segundo `SELECT` da verificação: devem aparecer `SELECT`, `INSERT`, `UPDATE` e `DELETE` nas duas tabelas.

O script é **idempotente**: pode ser executado quantas vezes for necessário sem duplicar tabelas, policies, índice ou trigger.

### O que o script cria

| Objeto | Finalidade |
|---|---|
| `public.acai_data` | Uma linha por usuário com o estado inteiro do app em `data` (jsonb). Chave primária `user_id` referenciando `auth.users` com `ON DELETE CASCADE`. |
| `public.acai_audit` | Espelho opcional dos eventos de auditoria para consultas separadas. |
| `acai_touch_updated_at()` + trigger | Atualizam `updated_at` automaticamente a cada `UPDATE`. |
| `idx_acai_data_updated_at` | Consulta rápida das sincronizações mais recentes. |
| 4 policies por tabela | `SELECT`, `INSERT`, `UPDATE` e `DELETE` liberados somente quando `auth.uid() = user_id`. |
| `REVOKE ... FROM anon` | Remove até mesmo privilégio de tabela para usuários não autenticados. |

O prefixo `acai_` garante que nada deste aplicativo se misture às tabelas do `painel-vida` no mesmo projeto.

> No SQL Editor do Supabase, `auth.uid()` é nulo (você está autenticado como administrador, não como usuário do app). Por isso, uma consulta como `SELECT count(*) FROM public.acai_data` pode mostrar `0` linhas mesmo após o app sincronizar. Para inspecionar um usuário específico, pegue o UUID dele em **Authentication → Users** e filtre por `user_id`.

## 3. Onde encontrar URL e chave publishable

No Dashboard do projeto:

- **Project URL**: em **Project Settings → API** (em versões mais novas da interface, **Settings → API Keys**). Valor: `https://tkgdeklhkhutvgskrbgd.supabase.co`.
- **Publishable key**: no mesmo local, na seção **Project API keys**, item `publishable` (em interfaces antigas aparece como `anon key` e começa com `eyJ...`; nas novas, com `sb_publishable_...`).

A URL e a chave publishable **já vêm embutidas** no aplicativo herdado do `painel-vida` e foram mantidas nesta versão — você não precisa copiá-las para começar a usar o app. Se o projeto mudar, abra **Configurações → Integração/Supabase** dentro do app e altere URL e chave; o novo valor fica salvo localmente.

Não transcrevi a chave neste documento de propósito: ela é pública por design e pode aparecer no código-fonte sem problema. Quem protege os dados é o **RLS**, não o segredo da chave.

### Nunca use service_role

A chave `service_role` (ou `secret`) **NUNCA** pode ser usada no navegador, no PWA, em `localStorage`, em arquivos `.js`, em `CONFIGURE.md` ou em repositório Git. Ela ignora RLS: vazando-a, qualquer pessoa teria acesso de leitura e escrita ao estado de **todos** os usuários do projeto. Se ela foi exposta acidentalmente, revogue/gire a chave em **Project Settings → API Keys** imediatamente. Este aplicativo não precisa dela para nenhuma funcionalidade.

## 4. Habilitar login

1. **Authentication → Providers → Email**: mantenha habilitado.
2. **Authentication → Providers → Email → Email Confirmations**: se ficar ligado, o usuário precisa confirmar o e-mail antes do primeiro sync — confira a caixa de entrada (e o spam).
3. **Authentication → URL Configuration**:
   - **Site URL**: a URL final onde o app vai rodar (ex.: `https://seu-usuario.github.io/acai-erp/`).
   - **Redirect URLs**: inclua `http://localhost:3000/**`, `http://localhost:8080/**` e `https://seu-usuario.github.io/acai-erp/**`.
4. Crie o usuário em **Authentication → Users → Add user** ou pelo formulário do app.

Depois de entrar, o app cria automaticamente a linha em `acai_data` no primeiro sync.

## 5. Uso diário: login, sincronização e conflitos

- **Primeiro acesso**: entre com e-mail e senha. O aplicativo carrega o estado salvo no navegador (ou um estado vazio) e funciona imediatamente, sem esperar a rede.
- **Offline-first**: vendas, despesas, estoque e demais lançamentos são gravados primeiro no armazenamento local. Sem internet, tudo continua funcionando; as mudanças ficam marcadas como pendentes.
- **Sincronizar**: use o botão **Sincronizar** em **Configurações** (o app também pode sincronizar automaticamente ao voltar online). O processo faz *pull* da linha do usuário, aplica o merge e faz *push* do resultado com `version + 1` e o `device_id` atual.
- **Merge por registro**: cada entidade tem `id`, `updatedAt` (ISO) e `deleted`. A comparação é por registro, não por tabela: alterar uma despesa não sobrescreve as vendas feitas no outro dispositivo. Vence o `updatedAt` mais recente; em empate, usa-se um critério determinístico (maior `id`) para que os dois dispositivos cheguem ao mesmo resultado.
- **Exclusões**: são tombstones (`deleted: true`). Elas permanecem no JSON para que o registro excluído não volte a aparecer depois de sincronizar com um dispositivo desatualizado.
- **Conflito entre dispositivos**: se o **mesmo** registro for alterado em dois aparelhos enquanto ambos estavam offline, não há merge campo a campo — prevalece a alteração com `updatedAt` maior. Por isso mantenha **data e hora automáticas** no celular/computador. Antes de sincronizar um dispositivo que ficou muito tempo offline, use **Exportar dados** nele para guardar uma cópia; se uma edição importante for perdida, recupere-a do JSON exportado e refaça o lançamento.
- **Regra de ouro das entradas**: não crie entradas manuais com categoria `Vendas`. Essa categoria é somente leitura e derivada de `sales`; criá-la à mão duplica o faturamento.

## 6. Backup e restauração

### Pelo aplicativo (recomendado)

- **Configurações → Exportar dados (.json)**: baixa o objeto `state` completo, incluindo `meta`, todas as entidades e o histórico de `audit`. Faça isso antes de limpar o navegador, trocar de aparelho ou importar outro arquivo.
- **Configurações → Restaurar backup (.json)**: mescla os registros do arquivo com o estado atual por ID e data de atualização (`updatedAt`). Registros mais recentes no aparelho são preservados; nada é apagado. Após restaurar, clique em **Sincronizar agora** para enviar a versão mesclada ao Supabase.

### Pelo Supabase (inspeção/exportação)

No **SQL Editor**:

```sql
SELECT user_id, data, device_id, version, updated_at
  FROM public.acai_data
 ORDER BY updated_at DESC;
```

Você também pode usar o botão de download do resultado em JSON/CSV. Para restaurar via SQL, obtenha o UUID do usuário em **Authentication → Users**, copie o JSON exportado para a coluna `data` e incremente `version` — mas, na dúvida, prefira a importação pelo app, que já preserva os `updatedAt` de cada registro.

A linha do usuário também é apagada automaticamente se a conta for excluída no Supabase Auth (`ON DELETE CASCADE`).

## 7. Publicar no GitHub Pages

1. Crie um repositório no GitHub (pode ser privado para o código, mas o GitHub Pages de repositório privado exige plano adequado; para público, o conteúdo será visível — não coloque segredos nele).
2. Faça upload de **todos** os arquivos e pastas da pasta `acai-erp` para a raiz do repositório (`index.html`, `styles.css`, `manifest.json`, `sw.js`, `serve.js`, a pasta `js/` com `icons.js`, `core.js`, `calc.js`, `views.js`, `actions.js`, `app.js`, a pasta `tests/`, os ícones PNG, `SUPABASE.sql`, `CONFIGURE.md`, `README.md`) e faça o commit na branch `main`.
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**: **Source = Deploy from a branch**; **Branch = `main`**; **Folder = `/ (root)`**; clique em **Save**.
5. Aguarde alguns minutos. O endereço será `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`.
6. Abra a URL, faça login, rode o sync e Instale o app pela opção do navegador. O GitHub Pages já fornece HTTPS, necessário para o service worker e para a instalação como PWA.
7. Para atualizar: substitua os arquivos alterados e faça push; o Pages republica automaticamente. Depois de atualizar, recarregue a página duas vezes ou use a opção de atualizar do app para pegar a nova versão do cache.

Dicas:

- Não há build: o Pages serve os arquivos estáticos exatamente como estão.
- Se publicar em uma subpasta, confirme que o `manifest.json` e o registro do `sw.js` usam caminhos relativos (`./`), para que o escopo do service worker seja a pasta do app e não a raiz do domínio.
- `SUPABASE.sql`, `CONFIGURE.md` e `README.md` ficarão públicos junto com o app. Eles não contêm a chave service_role — e nunca devem conter.

## 8. Rodando localmente antes de publicar

Dentro da pasta `acai-erp`:

```bash
node serve.js
# http://127.0.0.1:4174
```

Ou, com Python:

```bash
python -m http.server 8080
# http://localhost:8080
# em Linux/macOS pode ser necessário: python3 -m http.server 8080
```

`localhost` é considerado contexto seguro, então o service worker e o login funcionam localmente. Não abra o `index.html` com `file://` — o service worker e o Supabase podem não funcionar nesse modo.

## 9. Solução de problemas

| Sintoma | Verificação |
|---|---|
| Sync falha com 401/403 | URL ou chave publishable incorretas em **Configurações**; usuário sem sessão ativa; RLS não criado (rode a verificação do SQL). |
| "Nenhum dado aparece" após o login | Outro dispositivo pode ter feito push por último; confira `updated_at`/`version` em `acai_data` no SQL Editor com o UUID do usuário. |
| Registro excluído voltou | Um dispositivo offline fez push sem o tombstone. Sincronize todos os dispositivos e confirme que `deleted: true` foi preservado. |
| PWA não instala | Verifique HTTPS (ou `localhost`), `manifest.json` acessível e `sw.js` registrado sem erro no console. |
| Faturamento duplicado | Existe entrada manual com categoria `Vendas` — apague-a; essa categoria é derivada de `sales`. |
