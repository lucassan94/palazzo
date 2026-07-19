# 🔐 SaborExpress — RLS Implementation Spec

> **Data:** 18/07/2026
> **Versão:** 2.0
> **Objetivo:** Completar e fixar a implementação de Row-Level Security (RLS) no PostgreSQL para o SaborExpress V2

---

## 1. Status Atual

### 1.1 O que já está implementado

- **Migration 001**: Habilita RLS em 9 tabelas (`clientes`, `entregadores`, `restaurante_users`, `produtos`, `produtos_extras`, `pedidos`, `pedido_itens`, `pedido_timeline`, `mensagens_pedido`) com policies básicas de isolamento por `restaurant_id`
- **Migration 003**: Substitui as policies antigas por policies **role-based** que verificam `app.user_role`, `app.user_id`, `app.user_cargo`
- **`database.js`**: Contém `setUserContext()`, `clearUserContext()`, e `getContextSQL()` que define variáveis de sessão (`app.restaurant_id`, `app.user_role`, `app.user_id`, `app.user_cargo`) antes de cada query
- **`pgContext.js`**: Middleware Express que captura `req.user` (após autenticação) e armazena no módulo `database.js`
- **`auth.js`**: JWT tokens contêm `{ id, email, nome, role, cargo, restaurantId }`

### 1.2 Tabelas com RLS habilitado

| Tabela | RLS Habilitado | Policies |
|--------|---------------|----------|
| `clientes` | ✅ | clientes_self, clientes_staff, clientes_entregador_select |
| `entregadores` | ✅ | entregadores_self, entregadores_staff |
| `restaurante_users` | ✅ | restaurante_users_staff |
| `produtos` | ✅ | produtos_public_select, produtos_staff_all |
| `produtos_extras` | ✅ | produtos_extras_public_select, produtos_extras_staff_all |
| `pedidos` | ✅ | pedidos_cliente, pedidos_entregador, pedidos_staff |
| `pedido_itens` | ✅ | pedido_itens_cliente, pedido_itens_entregador, pedido_itens_staff |
| `pedido_timeline` | ✅ | pedido_timeline_cliente, pedido_timeline_entregador, pedido_timeline_staff |
| `mensagens_pedido` | ✅ | mensagens_pedido_cliente, mensagens_pedido_entregador, mensagens_pedido_staff |
| `restaurantes` | ❌ | N/A |
| `categorias` | ❌ | N/A |
| `raios_entrega` | ❌ | N/A |
| `refresh_tokens` | ❌ | N/A |

---

## 2. Problemas Identificados

### 🔴 P1 — Race Condition no `_userContext` (CRÍTICO)

`_userContext` é uma variável **module-level** no `database.js`. Como `query()` e `transaction()` são funções `async`, o controle é cedido entre `await pool.connect()` e `await client.query(getContextSQL())`. Duas requisições concorrentes podem sobrescrever o contexto uma da outra:

```
Req A: pgContext → setUserContext(A)
Req A: query() → await pool.connect()  ← YIELD
Req B: pgContext → setUserContext(B)   ← SOBRESCREVEU!
Req A: getContextSQL() → lê B          ← CONTEXTO ERRADO!
```

**Decisão**: Usar `AsyncLocalStorage` do Node.js para tornar o contexto verdadeiramente por-requisição.

### 🟡 P2 — Política de Entregador não cobre pedidos disponíveis

A policy `pedidos_entregador` atual só permite SELECT onde `entregador_id = app.user_id`. Mas o entregador precisa **primeiro ver os pedidos disponíveis** (status `pronto_entrega`, sem entregador atribuído) para poder pegá-los.

**Decisão**: Modificar para permitir SELECT em:
- Pedidos atribuídos ao entregador (`entregador_id = app.user_id`)
- Pedidos disponíveis (`entregador_id IS NULL AND status = 'pronto_entrega'`)

Para UPDATE: apenas pedidos atribuídos.

### 🟡 P3 — Policies de Staff não diferenciam por cargo

Atualmente todo `role = 'restaurante'` tem acesso total. Precisamos de granularidade. (Detalhado na Seção 3)

**Decisão**: Implementar policies por cargo + atualizar middleware `authorize()`.

### 🟢 P4 — Filtros manuais redundantes nas queries

Muitos módulos filtram manualmente por `restaurant_id`, `cliente_id`, `entregador_id` nas queries SQL. Com RLS ativo, isso é redundante.

**Decisão**: Remover filtros manuais das queries e confiar 100% no RLS.

**Exceções**: Manter filtros manuais em **rotas públicas** (sem autenticação) onde o `pgContext` não define contexto de usuário:
- `GET /api/produtos` (cardápio público)
- `GET /api/produtos/com-extras` (cardápio com extras)
- `GET /api/produtos/:id` (detalhe do produto)
- `GET /api/produtos/categorias` (categorias)
- `GET /api/restaurante` (dados do restaurante)
- `POST /api/pedidos/calcular-frete` (cálculo de frete)
- `POST /api/auth/cliente/signup` (cadastro)

### 🟢 P5 — Migration 003 pode não ter sido aplicada

**Decisão**: Criar migration **004** que dropa e recria todas as policies do zero.

---

## 3. Matriz de Permissões por Cargo

### 3.1 Mapeamento do Admin Frontend

O painel admin tem estas seções no sidebar (mapeadas dos componentes Vue):

| # | Seção Admin | Componente | Rotas da API |
|---|-------------|-----------|-------------|
| 1 | **Fila de Pedidos** | `OrdersView.vue` | `GET /pedidos`, `PATCH /pedidos/:id/status`, `GET /dashboard/resumo-dia`, `POST /restaurante/mensagens` |
| 2 | **Gerenciar Produtos** | `ProdutosView.vue` | `GET /produtos`, `POST /produtos`, `PUT /produtos/:id`, `DELETE /produtos/:id` |
| 3 | **Clientes** | `ClientesView.vue` | `GET /clientes`, `GET /clientes/:id` |
| 4 | **Gerenciar Entregadores** | `EntregadoresView.vue` | `GET /entregadores`, `POST /entregadores`, `PUT /entregadores/:id` |
| 5 | **Relatório Entregas** | `RelatoriosView.vue` | `GET /entregadores/relatorio` |
| 6 | **Dashboard** | `DashboardView.vue` | `GET /dashboard`, `GET /dashboard/resumo-dia` |
| 7 | **Configurações** | `ConfigView.vue` | `GET /restaurante`, `PUT /restaurante`, `POST /restaurante/toggle-loja`, `GET /restaurante/raios-entrega`, `POST /restaurante/raios-entrega`, `DELETE /restaurante/raios-entrega/:id`, `GET /restaurante/equipe`, `POST /restaurante/equipe`, `DELETE /restaurante/equipe/:id`, `PUT /restaurante/seguranca` |

### 3.2 Matriz Detalhada de Acessos

#### Pedidos (OrdersView.vue)

| Operação | Admin | Gerente | Chef | Caixa |
|----------|-------|---------|------|-------|
| Ver fila de pedidos | ✅ | ✅ | ✅ | ✅ |
| Aceitar (pendente→preparando) | ✅ | ✅ | ✅ | ❌ |
| Recusar pedido | ✅ | ✅ | ❌ | ❌ |
| Marcar pronto (preparando→pronto_entrega) | ✅ | ✅ | ✅ | ❌ |
| Cancelar pedido | ✅ | ✅ | ❌ | ❌ |
| Atribuir entregador | ✅ | ✅ | ❌ | ❌ |
| Ver detalhes | ✅ | ✅ | ✅ | ✅ |
| Imprimir comanda | ✅ | ✅ | ✅ | ✅ |
| Enviar mensagem cliente | ✅ | ✅ | ❌ | ❌ |
| Ver resumo do dia (sidebar) | ✅ | ✅ | ❌ | ❌ |

#### Produtos (ProdutosView.vue)

| Operação | Admin | Gerente | Chef | Caixa |
|----------|-------|---------|------|-------|
| Listar produtos | ✅ | ✅ | ✅ | ❌ |
| Criar produto | ✅ | ✅ | ✅ | ❌ |
| Editar produto | ✅ | ✅ | ✅ | ❌ |
| Excluir produto | ✅ | ✅ | ✅ | ❌ |

#### Clientes (ClientesView.vue)

| Operação | Admin | Gerente | Chef | Caixa |
|----------|-------|---------|------|-------|
| Listar clientes | ✅ | ✅ | ❌ | ✅ |
| Ver detalhes do cliente | ✅ | ✅ | ❌ | ✅ |

#### Entregadores (EntregadoresView.vue)

| Operação | Admin | Gerente | Chef | Caixa |
|----------|-------|---------|------|-------|
| Listar entregadores | ✅ | ✅ | ❌ | ❌ |
| Criar entregador | ✅ | ✅ | ❌ | ❌ |
| Editar entregador | ✅ | ✅ | ❌ | ❌ |
| Inativar/ativar | ✅ | ✅ | ❌ | ❌ |

#### Relatório de Entregas (RelatoriosView.vue)

| Operação | Admin | Gerente | Chef | Caixa |
|----------|-------|---------|------|-------|
| Ver relatório | ✅ | ✅ | ❌ | ❌ |

#### Dashboard (DashboardView.vue)

| Operação | Admin | Gerente | Chef | Caixa |
|----------|-------|---------|------|-------|
| KPIs (faturamento, pedidos, ticket) | ✅ | ✅ | ❌ | ❌ |
| Tempos médios | ✅ | ✅ | ❌ | ❌ |
| Status dos pedidos (gráfico) | ✅ | ✅ | ❌ | ❌ |
| Produtos mais vendidos | ✅ | ✅ | ❌ | ❌ |
| Meios de pagamento | ✅ | ✅ | ❌ | ❌ |

#### Configurações (ConfigView.vue)

| Operação | Admin | Gerente | Chef | Caixa |
|----------|-------|---------|------|-------|
| Status loja (toggle) | ✅ | ✅ | ❌ | ❌ |
| Dados do restaurante | ✅ | ✅ | ❌ | ❌ |
| Raios de entrega (CRUD) | ✅ | ✅ | ❌ | ❌ |
| Gestão de equipe (CRUD) | ✅ | ❌ | ❌ | ❌ |
| Segurança (alterar senha/email) | ✅ | ❌ | ❌ | ❌ |

### 3.3 Resumo por Cargo

#### 👑 Admin
Acesso **total irrestrito** a todas as tabelas e operações.

#### 👔 Gerente
Acesso quase total, com exceção de:
- **Gestão de equipe**: ❌ (criar/excluir usuários staff)
- **Segurança**: ❌ (alterar senha/email do admin)

#### 👨‍🍳 Chef (Cozinha)
Acesso focado em **produção e cardápio**:
- Pedidos: ✅ VER + ATUALIZAR status (pendente→preparando→pronto)
- Produtos: ✅ CRUD completo
- Clientes: ❌
- Entregadores: ❌
- Relatórios: ❌
- Dashboard: ❌
- Config: ❌

#### 🧾 Caixa (Atendimento)
Acesso focado em **visualização e atendimento ao cliente**:
- Pedidos: ✅ VER + DETALHES + IMPRIMIR (read-only)
- Clientes: ✅ VER (consultar dados)
- Produtos: ❌
- Entregadores: ❌
- Relatórios: ❌
- Dashboard: ❌
- Config: ❌

---

## 4. Plano de Implementação

### 4.1 Fase 1: Fix Race Condition (AsyncLocalStorage)

**Arquivo**: `backend/src/config/database.js`

Substituir variável module-level `_userContext` por `AsyncLocalStorage`:

```javascript
import { AsyncLocalStorage } from 'async_hooks';

const als = new AsyncLocalStorage();

export function runWithContext(user, fn) {
  return als.run({ user }, fn);
}

export { als }; // Para uso em testes

function getContextSQL() {
  const store = als.getStore();
  const settings = [`SET app.restaurant_id = ${config.restaurantId}`];
  if (store?.user) {
    settings.push(`SET app.user_role = '${store.user.role}'`);
    settings.push(`SET app.user_id = ${store.user.id}`);
    if (store.user.cargo) {
      settings.push(`SET app.user_cargo = '${store.user.cargo}'`);
    }
  }
  return settings.join('; ');
}
```

**O que remover**:
- Variável `let _userContext = null`
- Funções `setUserContext()` e `clearUserContext()`

### 4.2 Fase 2: Atualizar Middleware pgContext

**Arquivo**: `backend/src/middleware/pgContext.js`

```javascript
import { runWithContext } from '../config/database.js';

export function pgContext(req, res, next) {
  if (req.user) {
    return runWithContext(req.user, next);
  }
  return next();
}
```

### 4.3 Fase 3: Migration 004 — RLS Policies Corrigidas

**Arquivo**: `backend/migrations/004_rls_fix.sql`

Estratégia:
1. `DROP POLICY IF EXISTS` para todas as policies antigas
2. Recriar com as correções de P2 (entregador vê disponíveis) e P3 (cargo granular)
3. Usar `DO $$` blocks com verificações para compatibilidade

#### 4.3.1 Política de CLIENTES

```sql
-- ============================================
-- CLIENTES
-- ============================================

-- Próprio cliente (mantém)
DROP POLICY IF EXISTS clientes_self ON clientes;
CREATE POLICY clientes_self ON clientes
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'cliente'
        AND id = current_setting('app.user_id', true)::integer
    );

-- Staff: admin/gerente têm CRUD completo
DROP POLICY IF EXISTS clientes_staff ON clientes;
CREATE POLICY clientes_staff ON clientes
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- Caixa: SELECT apenas (consultar dados do cliente)
DROP POLICY IF EXISTS clientes_caixa_select ON clientes;
CREATE POLICY clientes_caixa_select ON clientes
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );

-- Entregador: SELECT apenas nome/telefone/endereço (para entrega)
DROP POLICY IF EXISTS clientes_entregador_select ON clientes;
CREATE POLICY clientes_entregador_select ON clientes
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
    );
```

#### 4.3.2 Política de ENTREGADORES

```sql
-- ============================================
-- ENTREGADORES
-- ============================================

-- Próprio entregador (mantém)
DROP POLICY IF EXISTS entregadores_self ON entregadores;
CREATE POLICY entregadores_self ON entregadores
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
        AND id = current_setting('app.user_id', true)::integer
    );

-- Staff: admin/gerente têm CRUD completo
DROP POLICY IF EXISTS entregadores_staff ON entregadores;
CREATE POLICY entregadores_staff ON entregadores
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );
```

#### 4.3.3 Política de RESTAURANTE_USERS

```sql
-- ============================================
-- RESTAURANTE_USERS (Staff/Admin)
-- ============================================

-- Apenas admin pode ver/gerenciar outros staff (inclusive outros admins)
DROP POLICY IF EXISTS restaurante_users_staff ON restaurante_users;
DROP POLICY IF EXISTS restaurante_users_admin ON restaurante_users;
CREATE POLICY restaurante_users_admin ON restaurante_users
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'admin'
    );
```

#### 4.3.4 Política de PRODUTOS

```sql
-- ============================================
-- PRODUTOS
-- ============================================

-- Público: SELECT em produtos ativos (qualquer um pode ver)
DROP POLICY IF EXISTS produtos_public_select ON produtos;
CREATE POLICY produtos_public_select ON produtos
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND ativo = true
    );

-- Staff de cozinha/admin: CRUD completo (admin, gerente, chef)
DROP POLICY IF EXISTS produtos_staff_all ON produtos;
DROP POLICY IF EXISTS produtos_admin ON produtos;
CREATE POLICY produtos_staff_all ON produtos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente', 'chef')
    );
```

#### 4.3.5 Política de PRODUTOS_EXTRAS

```sql
-- ============================================
-- PRODUTOS_EXTRAS
-- ============================================

-- Público: SELECT (mesmo filtro dos produtos)
DROP POLICY IF EXISTS produtos_extras_public_select ON produtos_extras;
CREATE POLICY produtos_extras_public_select ON produtos_extras
    FOR SELECT
    USING (
        produto_id IN (
            SELECT id FROM produtos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND ativo = true
        )
    );

-- Staff de cozinha/admin: CRUD
DROP POLICY IF EXISTS produtos_extras_staff_all ON produtos_extras;
CREATE POLICY produtos_extras_staff_all ON produtos_extras
    FOR ALL
    USING (
        produto_id IN (
            SELECT id FROM produtos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente', 'chef')
    );
```

#### 4.3.6 Política de PEDIDOS (a mais complexa)

```sql
-- ============================================
-- PEDIDOS
-- ============================================

-- Cliente: seus próprios pedidos (mantém)
DROP POLICY IF EXISTS pedidos_cliente ON pedidos;
CREATE POLICY pedidos_cliente ON pedidos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'cliente'
        AND cliente_id = current_setting('app.user_id', true)::integer
    );

-- Entregador SELECT: pedidos atribuídos + disponíveis (CORRIGIDO - P2)
DROP POLICY IF EXISTS pedidos_entregador ON pedidos;
DROP POLICY IF EXISTS pedidos_entregador_select ON pedidos;
CREATE POLICY pedidos_entregador_select ON pedidos
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
        AND (
            entregador_id = current_setting('app.user_id', true)::integer
            OR (entregador_id IS NULL AND status = 'pronto_entrega')
        )
    );

-- Entregador UPDATE: apenas pedidos atribuídos a ele
DROP POLICY IF EXISTS pedidos_entregador_update ON pedidos;
CREATE POLICY pedidos_entregador_update ON pedidos
    FOR UPDATE
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
        AND entregador_id = current_setting('app.user_id', true)::integer
    );

-- ============================================
-- Staff policies por CARGO (P3)
-- ============================================

-- ADMIN: CRUD completo em todos os pedidos
DROP POLICY IF EXISTS pedidos_staff ON pedidos;
DROP POLICY IF EXISTS pedidos_staff_admin ON pedidos;
CREATE POLICY pedidos_admin_all ON pedidos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- GERENTE: CRUD completo (mesmo que admin para pedidos)
-- (Reutiliza a policy pedidos_admin_all acima)

-- CHEF: SELECT + UPDATE (mudar status de preparação)
DROP POLICY IF EXISTS pedidos_chef ON pedidos;
CREATE POLICY pedidos_chef ON pedidos
    FOR SELECT, UPDATE
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'chef'
    );

-- CAIXA: SELECT apenas
DROP POLICY IF EXISTS pedidos_caixa_select ON pedidos;
CREATE POLICY pedidos_caixa_select ON pedidos
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );
```

#### 4.3.7 Política de PEDIDO_ITENS (herda do pedido pai)

```sql
-- ============================================
-- PEDIDO_ITENS
-- ============================================

DROP POLICY IF EXISTS pedido_itens_cliente ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_entregador ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_staff ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_admin ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_chef ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_caixa_select ON pedido_itens;

-- Cliente: itens dos seus próprios pedidos
CREATE POLICY pedido_itens_cliente ON pedido_itens
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND cliente_id = current_setting('app.user_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'cliente'
    );

-- Entregador: itens dos pedidos atribuídos
CREATE POLICY pedido_itens_entregador ON pedido_itens
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND (
                entregador_id = current_setting('app.user_id', true)::integer
                OR (entregador_id IS NULL AND status = 'pronto_entrega')
            )
        )
        AND current_setting('app.user_role', true) = 'entregador'
    );

-- Admin/Gerente: CRUD completo
CREATE POLICY pedido_itens_admin ON pedido_itens
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- Chef: SELECT + UPDATE
CREATE POLICY pedido_itens_chef ON pedido_itens
    FOR SELECT, UPDATE
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'chef'
    );

-- Caixa: SELECT apenas
CREATE POLICY pedido_itens_caixa_select ON pedido_itens
    FOR SELECT
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );
```

#### 4.3.8 Política de PEDIDO_TIMELINE

```sql
-- ============================================
-- PEDIDO_TIMELINE
-- ============================================

DROP POLICY IF EXISTS pedido_timeline_cliente ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_entregador ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_staff ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_admin ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_chef ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_caixa_select ON pedido_timeline;

-- Cliente
CREATE POLICY pedido_timeline_cliente ON pedido_timeline
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND cliente_id = current_setting('app.user_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'cliente'
    );

-- Entregador
CREATE POLICY pedido_timeline_entregador ON pedido_timeline
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND entregador_id = current_setting('app.user_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'entregador'
    );

-- Admin/Gerente
CREATE POLICY pedido_timeline_admin ON pedido_timeline
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- Chef
CREATE POLICY pedido_timeline_chef ON pedido_timeline
    FOR SELECT
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'chef'
    );

-- Caixa
CREATE POLICY pedido_timeline_caixa_select ON pedido_timeline
    FOR SELECT
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );
```

#### 4.3.9 Política de MENSAGENS_PEDIDO

```sql
-- ============================================
-- MENSAGENS_PEDIDO
-- ============================================

DROP POLICY IF EXISTS mensagens_pedido_cliente ON mensagens_pedido;
DROP POLICY IF EXISTS mensagens_pedido_entregador ON mensagens_pedido;
DROP POLICY IF EXISTS mensagens_pedido_staff ON mensagens_pedido;

-- Cliente: mensagens dos seus pedidos
CREATE POLICY mensagens_pedido_cliente ON mensagens_pedido
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND cliente_id = current_setting('app.user_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'cliente'
    );

-- Entregador: mensagens dos pedidos atribuídos
CREATE POLICY mensagens_pedido_entregador ON mensagens_pedido
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND entregador_id = current_setting('app.user_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'entregador'
    );

-- Admin/Gerente: CRUD (podem enviar mensagens)
CREATE POLICY mensagens_pedido_admin ON mensagens_pedido
    FOR ALL
    USING (
        restaurante_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- Chef/Caixa: SELECT apenas (ver mensagens existentes)
CREATE POLICY mensagens_pedido_staff_select ON mensagens_pedido
    FOR SELECT
    USING (
        restaurante_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
    );
```

#### 4.3.10 Política de DASHBOARD

O dashboard não é uma tabela, mas sim queries agregadas. A proteção é feita via middleware `authorize()`.

### 4.4 Fase 4: Atualizar Middleware authorize()

**Arquivo**: `backend/src/middleware/auth.js`

O problema atual é que `authorize()` aceita QUALQUER staff quando o role é `'restaurante'`:

```javascript
// ATUAL (bug): TODO staff passa direto
if (req.user.role === 'restaurante') {
  return next(); // ❌ Chef e Caixa passam em rotas de admin!
}
```

**Correção**: Verificar cargo explicitamente em vez de confiar no role apenas:

```javascript
export function authorize(...allowedRolesOrCargos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    // Mapear cargos permitidos
    const allowed = allowedRolesOrCargos.map(r => r.toLowerCase());

    // Verificar se o role OU o cargo do usuário está na lista de permitidos
    const userRole = (req.user.role || '').toLowerCase();
    const userCargo = (req.user.cargo || '').toLowerCase();

    if (allowed.includes(userRole) || allowed.includes(userCargo)) {
      return next();
    }

    return res.status(403).json({
      error: 'Acesso não autorizado para esta função.',
      required: allowedRolesOrCargos,
      userRole,
      userCargo,
    });
  };
}
```

**Mudanças nas chamadas do authorize() nos módulos:**

| Módulo | Rota | authorize() Atual | authorize() Novo |
|--------|------|-------------------|------------------|
| `entregadores` | GET / | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente'` |
| `entregadores` | POST / | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente'` |
| `entregadores` | PUT /:id | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente'` |
| `entregadores` | GET /relatorio | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente'` |
| `produtos` | POST / | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente', 'chef'` |
| `produtos` | PUT /:id | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente', 'chef'` |
| `produtos` | DELETE /:id | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente', 'chef'` |
| `restaurante` | PUT / | `'admin', 'restaurante'` | `'admin', 'gerente'` |
| `restaurante` | POST /toggle-loja | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente'` |
| `restaurante` | raios-entrega | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente'` |
| `restaurante` | POST /mensagens | `'admin', 'gerente', 'chef', 'restaurante'` | `'admin', 'gerente'` |
| `restaurante` | GET /equipe | `'admin', 'restaurante'` | `'admin'` |
| `restaurante` | POST /equipe | `'admin', 'restaurante'` | `'admin'` |
| `restaurante` | DELETE /equipe/:id | `'admin', 'restaurante'` | `'admin'` |
| `restaurante` | PUT /seguranca | `'admin', 'restaurante'` | `'admin'` |
| `dashboard` | GET / | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente'` |
| `dashboard` | GET /resumo-dia | `'admin', 'gerente', 'restaurante'` | `'admin', 'gerente'` |

**Rotas que chef pode acessar:**
- `PATCH /pedidos/:id/status` — `authenticate` apenas (RLS no DB bloqueia se não for permitido)
- `POST /produtos` — `authorize('admin', 'gerente', 'chef')`
- `PUT /produtos/:id` — `authorize('admin', 'gerente', 'chef')`
- `DELETE /produtos/:id` — `authorize('admin', 'gerente', 'chef')`

**Rotas que caixa pode acessar:**
- `GET /pedidos` — `authenticate` apenas (RLS bloqueia INSERT/UPDATE/DELETE)
- `GET /pedidos/:id` — `authenticate` apenas
- `GET /clientes` — `authenticate` apenas (RLS bloqueia INSERT/UPDATE/DELETE)
- `GET /clientes/:id` — `authenticate` apenas

### 4.5 Fase 5: Remover Filtros Manuais das Queries

Para cada módulo, remover filtros redundantes de `restaurant_id`, `cliente_id`, `entregador_id` nas queries **quando a rota é autenticada**.

**Módulos afetados** (rotas autenticadas):

| Módulo | Rota | Filtro Manual Atual | Ação |
|--------|------|--------------------|------|
| `clientes` | `GET /` | `WHERE restaurant_id = $1` | Remover |
| `clientes` | `GET /:id` | `WHERE id = $1 AND restaurant_id = $2` | Remover `AND restaurant_id = $2` |
| `clientes` | `PUT /perfil` | `WHERE id = $11 AND restaurant_id = $12` | Remover `AND restaurant_id = $12` |
| `entregadores` | `GET /` | `WHERE restaurant_id = $1` | Remover |
| `entregadores` | `PUT /:id` | `WHERE id = $1 AND restaurant_id = $2` | Remover |
| `entregadores` | `GET /relatorio` | `WHERE e.restaurant_id = $1` | Remover |
| `produtos` | `POST /` | (usa `config.restaurantId` no INSERT) | Remover |
| `produtos` | `PUT /:id` | `WHERE id = $1 AND restaurant_id = $2` | Remover |
| `produtos` | `DELETE /:id` | `WHERE id = $1 AND restaurant_id = $2` | Remover |
| `pedidos` | `GET /` | Filtros por role (cliente_id, entregador_id) | Remover (RLS cuida disso) |
| `pedidos` | `PATCH /:id/status` | Busca pedido por ID (sem filtro de role) | Manter (já usa só `WHERE id = $1`) |
| `restaurante` | vários | Filtros por `restaurant_id` | Manter (rotas públicas ou específicas) |
| `dashboard` | todos | `WHERE restaurant_id = $1` | Remover |

**Rotas públicas que MANTÊM filtros manuais** (não têm RLS por falta de contexto de usuário):
- `GET /api/produtos` → `WHERE p.restaurant_id = $1`
- `GET /api/produtos/com-extras` → `WHERE p.restaurant_id = $1`
- `GET /api/produtos/:id` → `WHERE p.id = $1 AND p.restaurant_id = $2`
- `GET /api/produtos/categorias` → `WHERE restaurant_id = $1`
- `GET /api/restaurante` → `WHERE id = $1`
- `POST /api/pedidos/calcular-frete` → `WHERE restaurant_id = $1`

### 4.6 Fase 6: Script de Teste E2E de RLS

**Arquivo**: `backend/src/e2e-rls-test.js`

Testes organizados por persona, com asserts de ✅ (deve funcionar) e ❌ (deve falhar 403 ou dados vazios):

#### Teste: Anônimo (sem token)

```javascript
// ✅ Cardápio público
GET /api/produtos → 200, array com produtos
GET /api/produtos/com-extras → 200, array
GET /api/produtos/categorias → 200, array

// ❌ Rotas protegidas
GET /api/pedidos → 401
GET /api/clientes → 401
POST /api/pedidos → 401 (sem token)
```

#### Teste: Cliente (maria@email.com / cliente123)

```javascript
// Login
POST /api/auth/cliente/login → 200, token

// ✅ Pode ver cardápio
GET /api/produtos → 200

// ✅ Pode criar pedido
POST /api/pedidos → 201

// ✅ Vê apenas seus próprios pedidos
GET /api/pedidos → 200, array com seus pedidos

// ❌ Tenta ver pedido de outro cliente
GET /api/pedidos/999999 → 404 ou array vazio

// ✅ Pode atualizar próprio perfil
PUT /api/clientes/perfil → 200

// ❌ Não pode ver lista de clientes
GET /api/clientes → 403 ou array vazio
```

#### Teste: Entregador (joao.entregador@teste.com)

```javascript
// Login
POST /api/auth/entregador/login → 200, token

// ✅ Vê pedidos disponíveis (pronto_entrega, sem entregador)
GET /api/pedidos → inclui pedidos com entregador_id = NULL

// ✅ Vê seus próprios pedidos atribuídos
GET /api/pedidos → inclui pedidos com entregador_id = id dele

// ✅ Pode atualizar status do próprio pedido
PATCH /api/pedidos/:id/status → 200

// ❌ Tenta atualizar status de pedido não atribuído
PATCH /api/pedidos/:id/status → 403 (RLS bloqueia)

// ❌ Não vê clientes
GET /api/clientes → 403
```

#### Teste: Admin (admin@saborexpress.com / admin123)

```javascript
// Login
POST /api/auth/restaurante/login → 200, token, cargo='admin'

// ✅ Vê todos os pedidos
GET /api/pedidos → 200, todos os pedidos

// ✅ Vê todos os clientes
GET /api/clientes → 200, todos os clientes

// ✅ Vê todos os entregadores
GET /api/entregadores → 200, todos

// ✅ CRUD produtos
POST /api/produtos → 201
PUT /api/produtos/:id → 200
DELETE /api/produtos/:id → 200

// ✅ Dashboard
GET /api/dashboard → 200

// ✅ Gerenciar equipe
GET /api/restaurante/equipe → 200
POST /api/restaurante/equipe → 201
```

#### Teste: Gerente (gerente@saborexpress.com / gerente123)

```javascript
// Login
POST /api/auth/restaurante/login → 200, token, cargo='gerente'

// ✅ Vê todos os pedidos (mesmo que admin)
GET /api/pedidos → 200, todos

// ✅ Vê clientes
GET /api/clientes → 200

// ✅ Vê entregadores
GET /api/entregadores → 200

// ✅ CRUD produtos
POST /api/produtos → 201

// ✅ Dashboard
GET /api/dashboard → 200

// ❌ NÃO pode gerenciar equipe
GET /api/restaurante/equipe → 403
POST /api/restaurante/equipe → 403

// ❌ NÃO pode acessar segurança
PUT /api/restaurante/seguranca → 403
```

#### Teste: Chef (chef@saborexpress.com / chef123)

```javascript
// Login
POST /api/auth/restaurante/login → 200, token, cargo='chef'

// ✅ Vê pedidos
GET /api/pedidos → 200, todos os pedidos (RLS permite SELECT)

// ✅ Pode atualizar status (preparando, pronto)
PATCH /api/pedidos/:id/status → 200 (status: preparando)
PATCH /api/pedidos/:id/status → 200 (status: pronto_entrega)

// ✅ CRUD produtos
POST /api/produtos → 201
PUT /api/produtos/:id → 200

// ❌ NÃO pode recusar pedido (admin/gerente)
PATCH /api/pedidos/:id/status (recusado) → 403

// ❌ NÃO pode cancelar pedido
PATCH /api/pedidos/:id/status (cancelado) → 403

// ❌ NÃO vê clientes
GET /api/clientes → 403

// ❌ NÃO vê entregadores
GET /api/entregadores → 403

// ❌ NÃO vê dashboard
GET /api/dashboard → 403

// ❌ NÃO vê relatório
GET /api/entregadores/relatorio → 403
```

#### Teste: Caixa (caixa@saborexpress.com / caixa123)

```javascript
// Login
POST /api/auth/restaurante/login → 200, token, cargo='caixa'

// ✅ Vê pedidos
GET /api/pedidos → 200, todos os pedidos

// ✅ Vê detalhes do pedido
GET /api/pedidos/:id → 200

// ✅ Vê clientes (read-only)
GET /api/clientes → 200

// ❌ NÃO pode mudar status
PATCH /api/pedidos/:id/status → 403

// ❌ NÃO pode criar/editar produtos
POST /api/produtos → 403
PUT /api/produtos/:id → 403

// ❌ NÃO vê entregadores
GET /api/entregadores → 403

// ❌ NÃO vê dashboard
GET /api/dashboard → 403

// ❌ NÃO pode enviar mensagem
POST /api/restaurante/mensagens → 403
```

---

## 5. Estrutura dos Arquivos

### 5.1 Novos Arquivos

```
backend/
├── migrations/
│   └── 004_rls_fix.sql           # Migration com policies corrigidas
└── src/
    └── e2e-rls-test.js            # Testes E2E de RLS
```

### 5.2 Arquivos Modificados

```
backend/
├── src/
│   ├── config/
│   │   └── database.js            # Adicionar AsyncLocalStorage
│   ├── middleware/
│   │   ├── auth.js                # Corrigir authorize() p/ cargo
│   │   └── pgContext.js           # Usar runWithContext
│   ├── modules/
│   │   ├── clientes/
│   │   │   └── index.js           # Remover filtros manuais
│   │   ├── entregadores/
│   │   │   └── index.js           # Remover filtros + atualizar authorize()
│   │   ├── pedidos/
│   │   │   └── index.js           # Remover filtros manuais
│   │   ├── produtos/
│   │   │   └── index.js           # Remover filtros + atualizar authorize()
│   │   ├── dashboard/
│   │   │   └── index.js           # Remover filtros + atualizar authorize()
│   │   └── restaurante/
│   │       └── index.js           # Atualizar authorize() p/ cargo
│   └── seed.js                    # Adicionar users de teste por cargo
```

---

## 6. Variáveis de Sessão PostgreSQL

Sempre definidas antes de cada query (via `getContextSQL()`):

| Variável | Tipo | Origem | Exemplo |
|----------|------|--------|---------|
| `app.restaurant_id` | integer | `config.restaurantId` (sempre definido) | `1` |
| `app.user_role` | text | `req.user.role` (se autenticado) | `'cliente'` |
| `app.user_id` | integer | `req.user.id` (se autenticado) | `42` |
| `app.user_cargo` | text | `req.user.cargo` (se staff) | `'admin'` |

---

## 7. Sequência de Implementação

| Passo | Descrição | Arquivos | Risco |
|-------|-----------|----------|-------|
| 1 | AsyncLocalStorage no database.js | `database.js` | 🟢 Médio |
| 2 | Atualizar pgContext.js | `pgContext.js` | 🟢 Baixo |
| 3 | Migration 004 com policies corrigidas | `004_rls_fix.sql` | 🟡 Médio |
| 4 | Rodar migration (recriar policies) | — | 🟡 Médio |
| 5 | Atualizar authorize() no auth.js | `auth.js` | 🟡 Médio |
| 6 | Atualizar authorize() nas rotas | Vários `index.js` | 🟡 Médio |
| 7 | Remover filtros manuais das queries | Vários `index.js` | 🔴 Alto |
| 8 | Seed data: usuários por cargo | `seed.js` | 🟢 Baixo |
| 9 | Script de teste E2E de RLS | `e2e-rls-test.js` | 🟢 Baixo |
| 10 | Rodar E2E e corrigir problemas | — | 🔴 Alto |

---

## 8. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| AsyncLocalStorage não capturar contexto em callbacks | Dados errados | Testar com concorrência (Promise.all) |
| RLS bloquear SELECT em rotas públicas | Cardápio não carrega | Testar rotas públicas primeiro |
| Remover filtros manuais quebrar queries que RLS não cobre | Usuário vê dados de outro | Remoção gradual, testando cada módulo |
| Migration 004 conflitar com dados existentes | Erro ao migrar | Usar `IF NOT EXISTS` / `DROP IF EXISTS` |
| Chef/Caixa perderem acesso que antes tinham | Usuário reclama | Verificar seed com cargos corretos |
| authorize() com cargo quebrar rotas existentes | 403 inesperado | Testar todos os 4 perfis de staff |

---

## 9. Seed Data: Usuários de Teste por Cargo

```sql
-- Inserir no seed.js com bcrypt
-- Senhas: admin123, gerente123, chef123, caixa123

INSERT INTO restaurante_users (restaurant_id, nome, email, senha_hash, cargo) VALUES
(1, 'Admin', 'admin@saborexpress.com', '$2b$12$...', 'admin'),
(1, 'Gerente', 'gerente@saborexpress.com', '$2b$12$...', 'gerente'),
(1, 'Chef', 'chef@saborexpress.com', '$2b$12$...', 'chef'),
(1, 'Caixa', 'caixa@saborexpress.com', '$2b$12$...', 'caixa');
```
