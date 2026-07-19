# 📋 Plano de Correção — SaborExpress V2

**Prioridades:** 🔴 Crítico → 🟡 Alto → 🟠 Médio → 🔵 Baixo → ⚪ Cosméticos

---

## FASE 1 🔴 — Corrigir SQL Injection (2 itens)

### 1.1 Corrigir Dashboard SQL Injection
**Arquivo:** `backend/src/modules/dashboard/index.js`  
**O que:** Substituir interpolação direta de `data_inicio`/`data_fim` por parameterized queries.  
**Como:** Passar datas como parâmetros `$1`, `$2` em vez de `${}`. Usar COALESCE no SQL.  
**Risco:** Média — SQL injection ativo.  

### 1.2 Corrigir extras SQL Injection
**Arquivo:** `backend/src/modules/produtos/index.js`  
**O que:** Substituir string concatenation dos extras por INSERT com parâmetros.  
**Como:** Usar `unnest()` ou múltiplos `INSERT` com `$1, $2, $3` etc.  
**Risco:** Baixa — escape manual já existe mas é frágil.  

---

## FASE 2 🟡 — Segurança (5 itens)

### 2.1 Tornar CSP mais restritiva
**Arquivo:** `backend/src/index.js`  
**O que:** Remover `unsafe-inline` e `unsafe-eval` se possível. Alternativa: nonce/hash.  

### 2.2 Adicionar rate limiting nos logins
**Arquivo:** `backend/src/modules/auth/index.js`  
**O que:** Usar `express-rate-limit` nos 3 endpoints de login.  
**Como:** 5 tentativas por IP em 15 minutos.  

### 2.3 Remover JWT default secret de produção
**Arquivo:** `backend/src/config/index.js`  
**O que:** Em produção, forçar variável de ambiente JWT_SECRET.  

### 2.4 Endpoint de revogação de refresh token
**Arquivo:** `backend/src/modules/auth/index.js`  
**O que:** Adicionar tabela `refresh_tokens` para permitir revogação. Alternativa: blacklist.  

---

## FASE 3 🟠 — Desempenho (2 itens prioritários)

### 3.1 Otimizar Dashboard queries
**Arquivo:** `backend/src/modules/dashboard/index.js`  
**O que:** Combinar as 6 queries em 2-3 usando CTEs.  
**Como:** Usar `WITH` clauses para reutilizar o filtro de data.  

### 3.2 Adicionar extras_count na query de produtos
**Arquivo:** `backend/src/modules/produtos/index.js`  
**O que:** Substituir N+1 queries por subquery na SELECT principal.  
**Como:** `SELECT p.*, (SELECT COUNT(*) FROM produtos_extras WHERE produto_id = p.id) as extras_count`  

---

## FASE 4 🔵 — Limpeza (5 itens)

### 4.1 Remover style.css não usado
**Arquivo:** `cliente/src/assets/style.css` (1218 linhas)  
**O que:** Deletar o arquivo. Confirmar que nenhum componente o importa.  

### 4.2 Limpar CSS morto do header
**Arquivo:** `cliente/src/assets/main.css`  
**O que:** Remover blocos `.app-header`, `.brand`, `.brand-logo`, `.header-status`, `.header-user`, `.avatar`, `.btn-logout`.  

### 4.3 Remover CSS duplicado de status badges
**Arquivo:** `admin/src/views/OrdersView.vue`  
**O que:** Remover os `.status-badge` scoped (já existem no main.css).  

### 4.4 Remover código morto (_imgError)
**Arquivo:** `cliente/src/views/HomeView.vue`  
**O que:** Remover `product._imgError = true` do handler @error do modal.  

### 4.5 Simplificar admin router
**Arquivo:** `admin/src/router/index.js`  
**O que:** Router não faz nada útil. Manter apenas rota raiz ou remover.  

---

## FASE 5 ⚪ — Cosméticos (3 itens)

### 5.1 Padronizar alert() → addToast no admin
**Arquivo:** `admin/src/views/OrdersView.vue`, `EntregadoresView.vue`  
**O que:** Substituir `alert()` por sistema de toasts.  

### 5.2 Melhorar logout do cliente
**Arquivo:** `cliente/src/stores/auth.js`  
**O que:** Substituir `location.reload()` por redirect suave ao /auth.  

### 5.3 Parâmetro extra no @error
**Arquivo:** `cliente/src/views/HomeView.vue`  
**O que:** Remover `product` do template `@error="onImgError($event, product)"`.

---

## 🎯 Prioridade Final

| Ordem | Item | Esforço | Impacto |
|-------|------|---------|---------|
| 1 | 1.1 Dashboard SQL Injection 🔴 | 30min | 🔴 Crítico |
| 2 | 1.2 Extras SQL Injection 🔴 | 15min | 🔴 Crítico |
| 3 | 2.2 Rate limiting nos logins 🟡 | 20min | 🟡 Alto |
| 4 | 2.1 CSP mais restritiva 🟡 | 15min | 🟡 Alto |
| 5 | 2.3 JWT secret obrigatório 🟡 | 5min | 🟡 Alto |
| 6 | 3.2 extras_count na query 🟠 | 10min | 🟠 Médio |
| 7 | 3.1 Otimizar Dashboard 🟠 | 20min | 🟠 Médio |
| 8 | 4.1-4.5 Limpeza 🔵 | 30min | 🔵 Baixo |
| 9 | 5.1-5.3 Cosméticos ⚪ | 20min | ⚪ Cosméticos |
