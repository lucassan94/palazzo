# 🔍 Superrevisão de Código — SaborExpress V2

**Data:** 19/07/2026  
**Analisados:** ~6.500 linhas em 60+ arquivos (backend, admin, cliente, entregador)

---

## 🔴 CRÍTICOS — Corrigir imediatamente

### C1. SQL Injection no Dashboard (backend/src/modules/dashboard/index.js)
```js
const hoje = data_inicio || 'CURRENT_DATE';
// ...
AND criado_em >= ${typeof hoje === 'string' && hoje.includes('-') ? `'${hoje}'` : hoje}
```
O parâmetro `data_inicio` vindo da query string é interpolado **diretamente** no SQL sem parameterized query. Um atacante pode injetar SQL modificando `data_inicio`. Mesmo com a checagem `includes('-')`, ainda é inseguro.

**Arquivo:** `backend/src/modules/dashboard/index.js` (linhas ~20-70, múltiplas ocorrências)

### C2. SQL Injection na criação/atualização de produtos (backend/src/modules/produtos/index.js)
```js
const extrasValues = data.extras.map(e =>
  `(${produto.id}, '${e.nome.replace(/'/g, "''")}', ${e.preco}, ${e.maximo ?? 1})`
).join(',');
```
Nome do extra é escapado manualmente com `replace(/'/g, "''")` em vez de usar parameterized query. Embora isso impeça SQL injection básico, ainda é frágil — falha em edge cases de encoding.

### C3. JWT Secret padrão em produção
`config.jwt.secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production'`  
Se a variável de ambiente não for configurada em produção, o secret é um valor hardcoded.

### C4. CORS permite todas as origens em dev
```js
callback(null, true); // Allow all origins in dev
```
O fallback permite qualquer origem. Em produção, deve ser restrito.

---

## 🟡 SEGURANÇA — Graves

### S1. XSS via Content-Security-Policy permissiva
```js
scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
```
`unsafe-inline` + `unsafe-eval` anula grande parte da proteção CSP.

### S2. Rate limiting ausente
Endpoints de login (`/auth/cliente/login`, `/auth/entregador/login`, `/auth/restaurante/login`) não têm rate limiting. Permite brute force.

### S3. Webhook token válido por header apenas
```js
const token = req.headers['asaas-access-token'];
if (!token || token !== config.asaas.webhookToken) { /* ... */ }
```
Usa comparação de string estática. Sem assinatura HMAC ou validação adicional.

### S4. Nenhum CSRF protection
Cookies são httpOnly mas não há token CSRF em formulários. Qualquer site malicioso pode fazer POST para a API se o usuário estiver logado.

### S5. Refresh token sem revogação
O refresh token é apenas um JWT sem armazenamento no banco. Não é possível revogar sessões individualmente.

---

## 🟠 DESEMPENHO

### D1. Imagens em base64 no banco de dados
42 imagens de ~60KB cada armazenadas como `TEXT` na coluna `imagem_base64`. Isso:
- Aumenta o tráfego de rede (base64 ~33% maior que binary)
- Impede cache HTTP (não usa `/uploads/`)
- Impede lazy loading eficiente
- Aumenta o tamanho do banco (~2.5MB para 42 imagens)

**Solução:** Servir imagens via `/uploads/` e manter URL no banco.

### D2. N+1 queries no Dashboard
O endpoint `/api/dashboard` faz **6 queries separadas** ao banco (resumo, status, pagamentos, top produtos, tempos médios, totais). Poderiam ser combinadas em 2-3 queries com CTEs.

### D3. N+1 queries em ProdutosView (já parcialmente corrigido)
Admin carrega 44 produtos e depois faz 44 chamadas API extras. Foi corrigido com `Promise.allSettled` mas o ideal é incluir `extras_count` na query principal.

### D4. Sem paginação em alguns endpoints
- `GET /api/pedidos` aceita `limit` mas default é 200 sem verificação de máximo
- `GET /api/clientes` não tem paginação
- `GET /api/produtos` não tem paginação

---

## 🔵 REDUNDÂNCIAS E CÓDIGO MORTO

### R1. `cliente/src/assets/style.css` — CSS duplicado e não usado
Este arquivo de 1218 linhas **não é importado** em lugar nenhum. O `main.js` importa apenas `main.css`. É lixo digital de versões anteriores.

### R2. CSS do header removido ainda presente
`main.css` do cliente ainda tem 50+ linhas de CSS para `.app-header`, `.brand`, `.brand-logo`, `.header-status`, `.header-user`, `.avatar`, `.btn-logout`. O header foi removido do template.

### R3. Status badge CSS duplicado
Admin `main.css` e `OrdersView.vue` scoped definem `.status-badge.xxx` com praticamente os mesmos estilos.

### R4. `_imgError` setado mas nunca lido
No `HomeView.vue`, o modal define `selectedProduct._imgError = true` no `@error`, mas essa propriedade nunca é verificada em lugar nenhum.

### R5. Admin router inútil
`admin/src/router/index.js` tem um catch-all que vai para uma rota fictícia. O admin todo é gerenciado via `currentView` reativa — o roteador Vue não é usado para nada.

---

## 🟣 ARQUITETURA E MANUTENIBILIDADE

### A1. Pedido ID confuso: `id` vs `pedido_id`
- `pedidos.id` = INTEGER (PK auto-increment)
- `pedidos.pedido_id` = VARCHAR no formato `#1042`
- Frontend às vezes usa `id`, às vezes `pedido_id`
- Rotas da API usam `:id` que é o INTEGER PK
- Mas logs e UI mostram `pedido_id` formatado
- Isso causa confusão e bugs potenciais

### A2. Tratamento de erro inconsistente no frontend
- `OrdersView.vue` admin usa `alert()` para erros em vez de toasts
- `EntregadoresView.vue` admin usa `alert()` também
- Cliente usa `addToast()` (correto)
- Entregador app usa `alert()` diretamente

### A3. WebSocket sem reconexão robusta
```js
reconnection: true,
```
A reconexão está ativada mas sem backoff exponencial, sem heartbeat monitoring, sem tratamento de reconnect fail.

### A4. Logout no cliente usa `location.reload()`
```js
async function logout() {
  await api.post('/auth/logout')
  user.value = null
  window.location.reload()  // ← Bruto, perde estado
}
```

---

## ⚪ QUESTÕES MENORES

### M1. Campo `motivo_cancelamento` no schema
Migração não define `motivo_cancelamento` na tabela `pedidos`. Foi adicionado em ALTER TABLE posterior.

### M2. `observacoes` truncado no backend
```js
detalhes_pagamento: '', '',
observacoes: '',  // ← String vazia, mas sem COALESCE
```

### M3. CPF validado mas não salvo no cliente
O backend valida CPF mas a migration não adicionou `cpf_cnpj` na tabela `clientes`. Está na spec mas não na migration.

### M4. Asaas dueDate hardcoded em 30 dias
```js
const dueDate = new Date();
dueDate.setDate(dueDate.getDate() + 30);
```
PIX deveria vencer em prazo menor (15 min é UX, 30 dias é o dueDate Asaas). Correto pela spec, mas confuso.

### M5. `tryDecodeBase64` removido mas template ainda passa parâmetro extra
```html
@error="onImgError($event, product)"  // product não é mais usado
```

---

## 📊 ESTATÍSTICAS

| Categoria | Qtde | Críticos |
|-----------|------|----------|
| 🔴 Críticos (SQL Injection) | 2 | C1, C2 |
| 🟡 Segurança | 5 | S1-S5 |
| 🟠 Desempenho | 4 | D1-D4 |
| 🔵 Redundâncias | 5 | R1-R5 |
| 🟣 Arquitetura | 4 | A1-A4 |
| ⚪ Menores | 5 | M1-M5 |
| **Total** | **25** | |
