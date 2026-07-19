# 🛡️ SaborExpress — Permissões por Cargo (Permissions Spec)

> **Data:** 18/07/2026
> **Versão:** 1.0
> **Objetivo:** Definir exatamente o que cada cargo (admin, gerente, chef, caixa) pode fazer no sistema, tanto no frontend quanto no backend.

---

## 1. Cargos

Mantidos os 4 cargos atuais:

| Cargo | Descrição | Tabela |
|-------|-----------|--------|
| **Admin** | Dono/proprietário do restaurante | `restaurante_users.cargo = 'admin'` |
| **Gerente** | Gerente operacional do dia-a-dia | `restaurante_users.cargo = 'gerente'` |
| **Chef** | Cozinheiro responsável pela produção | `restaurante_users.cargo = 'chef'` |
| **Caixa** | Atendente de balcão/telefone | `restaurante_users.cargo = 'caixa'` |

---

## 2. Matriz de Permissões — Visão Geral

| Funcionalidade | Admin | Gerente | Chef | Caixa |
|---------------|-------|---------|------|-------|
| **Pedidos** | | | | |
| Ver fila de pedidos | ✅ | ✅ | ✅ | ✅ |
| Aceitar (pendente→preparando) | ✅ | ✅ | ✅ | ❌ |
| Marcar pronto (preparando→pronto_entrega) | ✅ | ✅ | ✅ | ❌ |
| Recusar pedido | ✅ | ✅ | ❌ | ❌ |
| Cancelar pedido | ✅ | ✅ | ❌ | ✅ |
| Atribuir entregador | ✅ | ✅ | ❌ | ❌ |
| Ver detalhes do pedido | ✅ | ✅ | ✅ | ✅ |
| Imprimir comanda | ✅ | ✅ | ✅ | ✅ |
| Enviar mensagem ao cliente | ✅ | ✅ | ✅ | ❌ |
| Ver resumo do dia (sidebar) | ✅ | ✅ | ❌ | ❌ |
| **Produtos** | | | | |
| Listar produtos | ✅ | ✅ | ✅ | ❌ |
| Criar produto | ✅ | ✅ | ✅ | ❌ |
| Editar produto | ✅ | ✅ | ✅ | ❌ |
| Excluir produto | ✅ | ✅ | ✅ | ❌ |
| **Clientes** | | | | |
| Listar clientes | ✅ | ✅ | ❌ | ✅ |
| Ver detalhes do cliente | ✅ | ✅ | ❌ | ✅ |
| **Entregadores** | | | | |
| Listar entregadores | ✅ | ✅ | ❌ | ❌ |
| Criar entregador | ✅ | ✅ | ❌ | ❌ |
| Editar entregador | ✅ | ✅ | ❌ | ❌ |
| Inativar/ativar | ✅ | ✅ | ❌ | ❌ |
| **Relatório Entregas** | | | | |
| Ver relatório de entregas | ✅ | ✅ | ❌ | ❌ |
| **Dashboard** | | | | |
| KPIs financeiros | ✅ | ✅ | ❌ | ❌ |
| Gráficos (status, pagamentos) | ✅ | ✅ | ❌ | ❌ |
| Produtos mais vendidos | ✅ | ✅ | ❌ | ❌ |
| Tempos médios | ✅ | ✅ | ❌ | ❌ |
| Resumo do dia (totais) | ✅ | ✅ | ❌ | ✅ |
| **Configurações** | | | | |
| Status loja (abrir/fechar) | ✅ | ✅ | ❌ | ❌ |
| Dados do restaurante | ✅ | ✅ | ❌ | ❌ |
| Raios de entrega (CRUD) | ✅ | ✅ | ❌ | ❌ |
| Gestão de equipe (CRUD) | ✅ | ✅ | ❌ | ❌ |
| Segurança (alterar senha/email) | ✅ | ❌ | ❌ | ❌ |
| **Módulo Cliente** | | | | |
| Cancelar próprio pedido pendente | N/A | N/A | N/A | N/A |

---

## 3. Detalhamento por Cargo

### 3.1 👑 Admin

**Quem é:** Dono/proprietário do restaurante.

**Acesso:** TOTAL — nenhuma restrição. Pode fazer absolutamente tudo no sistema.

**Sidebar:** Todas as 7 seções visíveis.

### 3.2 👔 Gerente

**Quem é:** Gerente operacional responsável pelo dia-a-dia do restaurante.

**Acesso:** Quase total, com exceção apenas da parte de Segurança (alterar própria senha/email é exclusivo do admin).

**Sidebar:** Todas as 7 seções visíveis — **igual ao admin**.

**Diferenças do admin:**
| O que gerente NÃO pode | Detalhes |
|------------------------|----------|
| Alterar email do admin | Rota `PUT /restaurante/seguranca` — exclusiva admin |
| Alterar senha do admin | Rota `PUT /restaurante/seguranca` — exclusiva admin |

**Obs:** Gerente pode criar/excluir outros usuários staff (inclusive outros gerentes). Isso é intencional para operação do dia-a-dia.

### 3.3 👨‍🍳 Chef

**Quem é:** Chef de cozinha responsável pela produção dos pedidos e gestão do cardápio.

**Sidebar:** 2 seções visíveis:
| # | Seção | Motivo |
|---|-------|--------|
| 1 | **Fila de Pedidos** | Ver pedidos pendentes, aceitar, marcar pronto, enviar mensagem |
| 2 | **Gerenciar Produtos** | CRUD completo — chef precisa manter cardápio |

**Permissões específicas:**

| Ação | Permissão | Detalhes |
|------|-----------|----------|
| Ver fila de pedidos | ✅ | RLS permite SELECT em todos pedidos do tenant |
| Aceitar pedido (pendente→preparando) | ✅ | Chef inicia produção |
| Marcar pronto (preparando→pronto_entrega) | ✅ | Chef finaliza produção |
| Recusar pedido | ❌ | Decisão gerencial |
| Cancelar pedido | ❌ | Decisão gerencial |
| Atribuir entregador | ❌ | Logística é do admin/gerente |
| Enviar mensagem ao cliente | ✅ | Chef pode avisar sobre substituições de ingredientes |
| Ver detalhes do pedido | ✅ | Precisa ver itens e observações |
| Imprimir comanda | ✅ | Para a cozinha |
| Ver resumo do dia | ❌ | Métricas financeiras não são da cozinha |
| CRUD produtos | ✅ | Chef mantém o cardápio |
| Ver clientes | ❌ | Não precisa de dados de clientes |
| Gerenciar entregadores | ❌ | Não é função da cozinha |
| Ver relatório entregas | ❌ | Não é função da cozinha |
| Dashboard financeiro | ❌ | Não é função da cozinha |
| Configurações | ❌ | Não é função da cozinha |

### 3.4 🧾 Caixa

**Quem é:** Atendente responsável por receber pedidos (presencial/telefone) e dar suporte ao cliente.

**Sidebar:** 3 seções visíveis:
| # | Seção | Motivo |
|---|-------|--------|
| 1 | **Fila de Pedidos** | Acompanhar status dos pedidos, cancelar se necessário |
| 2 | **Clientes / CRM** | Consultar dados de clientes |
| 3 | **Dashboard** | Ver resumo básico do dia (apenas resumo do dia) |

**Permissões específicas:**

| Ação | Permissão | Detalhes |
|------|-----------|----------|
| Ver fila de pedidos | ✅ | Atendente precisa informar clientes |
| Aceitar/Recusar/Marcar pronto | ❌ | Fluxo de produção não é do caixa |
| Cancelar pedido | ✅ | Cliente pode desistir no balcão/telefone |
| Atribuir entregador | ❌ | Logística é do admin/gerente |
| Enviar mensagem ao cliente | ❌ | Só admin/gerente/chef enviam mensagens |
| Ver detalhes do pedido | ✅ | Precisa consultar informações |
| Imprimir comanda | ✅ | Para entregar nota ao cliente |
| Ver resumo do dia | ✅ | Só dashboard com resumo básico (pedidos entregues, faturamento estimado) |
| Dashboard completo (KPIs, gráficos) | ❌ | Informação financeira sensível |
| CRUD produtos | ❌ | Não é função |
| Ver clientes | ✅ | Consultar dados para atendimento |
| Gerenciar entregadores | ❌ | Não é função |
| Ver relatório entregas | ❌ | Não é função |
| Configurações | ❌ | Não é função |

---

## 4. Sidebar Dinâmica

O frontend admin (`App.vue`) deve esconder seções do sidebar baseado no `cargo` do usuário logado.

### 4.1 Lógica da Sidebar

```javascript
// Admin e Gerente: veem tudo (7 seções)
// Chef: vê só pedidos + produtos (2 seções)
// Caixa: vê só pedidos + clientes + dashboard resumo (3 seções)

const menuItems = computed(() => {
  const cargo = authStore.user?.cargo;
  const itens = [
    { id: 'pedidos', label: 'Fila de Pedidos', icon: 'fas fa-clipboard-list', cargos: ['admin', 'gerente', 'chef', 'caixa'] },
    { id: 'produtos', label: 'Gerenciar Produtos', icon: 'fas fa-hamburger', cargos: ['admin', 'gerente', 'chef'] },
    { id: 'clientes', label: 'Clientes / CRM', icon: 'fas fa-users', cargos: ['admin', 'gerente', 'caixa'] },
    { id: 'entregadores', label: 'Entregadores', icon: 'fas fa-motorcycle', cargos: ['admin', 'gerente'] },
    { id: 'relatorios', label: 'Rel. Entregas', icon: 'fas fa-chart-bar', cargos: ['admin', 'gerente'] },
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-pie', cargos: ['admin', 'gerente', 'caixa'] },
    { id: 'config', label: 'Configurações', icon: 'fas fa-cog', cargos: ['admin', 'gerente'] },
  ];
  return itens.filter(item => item.cargos.includes(cargo));
});
```

### 4.2 Componente Dashboard para Caixa

O caixa vê uma versão simplificada do dashboard, apenas com:
- Pedidos Entregues (contagem do dia)
- Faturamento Estimado (R$ do dia)
- Pedidos Ativos (em andamento)

Isso corresponde à rota `GET /dashboard/resumo-dia`. A rota `GET /dashboard` (completa) deve retornar 403 para caixa.

### 4.3 Componente OrdersView para Chef/Caixa

O `OrdersView.vue` já renderiza botões de ação condicionalmente baseado no `order.status`. A lógica adicional deve:

**Chef:**
- ❌ Ocultar botão "Recusar" (só admin/gerente)
- ❌ Ocultar botão "Cancelar" quando em preparando (só admin/gerente)
- ❌ Bloquear arrastar no Kanban para colunas que não deveria mexer

**Caixa:**
- ❌ Ocultar botão "Aceitar", "Pronto para Entrega"
- ❌ Ocultar botão "💬 Mensagem"
- ✅ Manter botão "Cancelar" quando aplicável
- ✅ Manter botão "Detalhes"
- ✅ Manter botão "Imprimir"

---

## 5. Backend — Middleware authorize()

### 5.1 Problema Atual

```javascript
// ATUAL (bug): QUALQUER staff passa, independente do cargo
if (req.user.role === 'restaurante') {
  return next(); // Chef e Caixa passam em rotas de admin!
}
```

### 5.2 Correção Necessária

O middleware `authorize()` deve verificar o `cargo` explicitamente:

```javascript
export function authorize(...allowedRolesOrCargos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const allowed = allowedRolesOrCargos.map(r => r.toLowerCase());
    const userRole = (req.user.role || '').toLowerCase();
    const userCargo = (req.user.cargo || '').toLowerCase();

    if (allowed.includes(userRole) || allowed.includes(userCargo)) {
      return next();
    }

    return res.status(403).json({
      error: 'Acesso não autorizado para esta função.',
      required: allowedRolesOrCargos,
      userCargo,
    });
  };
}
```

### 5.3 authorize() por Rota

| Módulo | Rota | authorize() Atual | authorize() Novo |
|--------|------|-------------------|------------------|
| **entregadores** | `GET /` | `'admin','gerente','restaurante'` | `'admin','gerente'` |
| **entregadores** | `POST /` | `'admin','gerente','restaurante'` | `'admin','gerente'` |
| **entregadores** | `PUT /:id` | `'admin','gerente','restaurante'` | `'admin','gerente'` |
| **entregadores** | `GET /relatorio` | `'admin','gerente','restaurante'` | `'admin','gerente'` |
| **produtos** | `POST /` | `'admin','gerente','restaurante'` | `'admin','gerente','chef'` |
| **produtos** | `PUT /:id` | `'admin','gerente','restaurante'` | `'admin','gerente','chef'` |
| **produtos** | `DELETE /:id` | `'admin','gerente','restaurante'` | `'admin','gerente','chef'` |
| **pedidos** | `PATCH /:id/status` | `authenticate` (sem authorize) | Adicionar authorize('admin','gerente','chef') |
| **pedidos** | `POST /pedidos` | `optionalAuth` | Manter (cliente cria) |
| **restaurante** | `PUT /` | `'admin','restaurante'` | `'admin','gerente'` |
| **restaurante** | `POST /toggle-loja` | `'admin','gerente','restaurante'` | `'admin','gerente'` |
| **restaurante** | raios-entrega | `'admin','gerente','restaurante'` | `'admin','gerente'` |
| **restaurante** | `POST /mensagens` | `'admin','gerente','chef','restaurante'` | `'admin','gerente','chef'` |
| **restaurante** | `GET /equipe` | `'admin','restaurante'` | `'admin','gerente'` |
| **restaurante** | `POST /equipe` | `'admin','restaurante'` | `'admin','gerente'` |
| **restaurante** | `DELETE /equipe/:id` | `'admin','restaurante'` | `'admin','gerente'` |
| **restaurante** | `PUT /seguranca` | `'admin','restaurante'` | `'admin'` |
| **dashboard** | `GET /` | `'admin','gerente','restaurante'` | `'admin','gerente'` |
| **dashboard** | `GET /resumo-dia` | `'admin','gerente','restaurante'` | `'admin','gerente','caixa'` |

### 5.4 Rotas sem authorize() explícito (protegidas apenas pelo RLS)

Estas rotas usam apenas `authenticate`. O RLS no banco de dados impede INSERT/UPDATE/DELETE não autorizados:

| Módulo | Rota | Quem acessa | Proteção |
|--------|------|-------------|----------|
| pedidos | `GET /` | Todos autenticados | RLS: cada um vê o que pode |
| pedidos | `GET /:id` | Todos autenticados | RLS: só vê se tem acesso |
| clientes | `GET /` | admin, gerente, caixa | authorize('admin','gerente','caixa') |
| clientes | `GET /:id` | admin, gerente, caixa | authorize('admin','gerente','caixa') |

---

## 6. RLS Policies (Banco de Dados)

As policies no PostgreSQL garantem a segurança em nível de banco, mesmo se o middleware for bypassado.

### 6.1 clientes

```sql
-- Admin/Gerente: CRUD
CREATE POLICY clientes_staff ON clientes FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente'));

-- Caixa: SELECT apenas
CREATE POLICY clientes_caixa_select ON clientes FOR SELECT
    USING (restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa');
```

### 6.2 pedidos

```sql
-- Chef: SELECT + UPDATE (mudar status)
CREATE POLICY pedidos_chef ON pedidos FOR SELECT, UPDATE
    USING (restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'chef');

-- Caixa: SELECT + DELETE (cancelar)
CREATE POLICY pedidos_caixa ON pedidos FOR SELECT, DELETE
    USING (restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa');
```

### 6.3 produtos

```sql
-- Chef: CRUD completo (igual admin/gerente)
CREATE POLICY produtos_staff ON produtos FOR ALL
    USING (restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente', 'chef'));
```

### 6.4 mensagens_pedido

```sql
-- Chef: pode INSERT (enviar mensagens) e SELECT
CREATE POLICY mensagens_pedido_chef ON mensagens_pedido FOR ALL
    USING (restaurante_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente', 'chef'));
```

---

## 7. Fluxo de Cancelamento pelo Cliente

### 7.1 Regra

Cliente pode cancelar o próprio pedido **enquanto o status for 'pendente'** (antes do restaurante aceitar).

### 7.2 Rota Nova (ou modificação existente)

```javascript
// PATCH /api/pedidos/:id/cancelar-cliente
router.patch('/:id/cancelar-cliente', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user;

    if (role !== 'cliente') {
      throw new AppError('Apenas clientes podem usar esta função.', 403);
    }

    const result = await transaction(async (client) => {
      const pedido = await client.query(
        'SELECT id, status, cliente_id FROM pedidos WHERE id = $1',
        [id]
      );

      if (pedido.rows.length === 0) throw new AppError('Pedido não encontrado.', 404);
      if (pedido.rows[0].cliente_id !== userId) {
        throw new AppError('Este pedido não pertence a você.', 403);
      }
      if (pedido.rows[0].status !== 'pendente') {
        throw new AppError('Só é possível cancelar pedidos com status "pendente".', 400);
      }

      await client.query(
        `UPDATE pedidos SET status = 'cancelado', motivo_cancelamento = 'Cancelado pelo cliente', cancelado_em = NOW() WHERE id = $1`,
        [id]
      );

      await client.query(
        `INSERT INTO pedido_timeline (pedido_id, status_anterior, status_novo, usuario_tipo, notas)
         VALUES ($1, 'pendente', 'cancelado', 'cliente', 'Cancelado pelo cliente')`,
        [id]
      );

      const updated = await client.query('SELECT * FROM pedidos WHERE id = $1', [id]);
      return updated.rows[0];
    });

    emitPedidoAtualizado(result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

---

## 8. Resumo do Dashboard por Cargo

| Componente | Admin | Gerente | Chef | Caixa |
|---|---|---|---|---|
| Faturamento Total | ✅ | ✅ | ❌ | ❌ |
| Total de Pedidos | ✅ | ✅ | ❌ | ❌ |
| Ticket Médio | ✅ | ✅ | ❌ | ❌ |
| Pedidos Entregues | ✅ | ✅ | ❌ | ❌ |
| Cancelados | ✅ | ✅ | ❌ | ❌ |
| Taxa Cancelamento | ✅ | ✅ | ❌ | ❌ |
| Tempos Médios | ✅ | ✅ | ❌ | ❌ |
| Status Distribuição | ✅ | ✅ | ❌ | ❌ |
| Top Produtos | ✅ | ✅ | ❌ | ❌ |
| Meios Pagamento | ✅ | ✅ | ❌ | ❌ |
| **Resumo do Dia** | ✅ | ✅ | ❌ | ✅ |

O caixa vê APENAS a rota `GET /dashboard/resumo-dia`, que retorna:
```json
{
  "pedidos_entregues": 42,
  "faturamento_estimado": 2850.00,
  "pedidos_ativos": 8
}
```

---

## 9. Arquivos a Modificar

### 9.1 Backend

| Arquivo | Mudança |
|---------|---------|
| `backend/src/middleware/auth.js` | Corrigir `authorize()` para não liberar todo role='restaurante' |
| `backend/src/modules/entregadores/index.js` | Atualizar authorize() calls |
| `backend/src/modules/produtos/index.js` | Atualizar authorize() calls para incluir 'chef' |
| `backend/src/modules/pedidos/index.js` | Adicionar authorize() no PATCH /status. Adicionar rota cancelar-cliente |
| `backend/src/modules/restaurante/index.js` | Atualizar authorize() calls |
| `backend/src/modules/dashboard/index.js` | Atualizar authorize() calls. Adicionar 'caixa' no resumo-dia |
| `backend/src/modules/clientes/index.js` | Adicionar authorize('admin','gerente','caixa') |
| `backend/migrations/004_rls_fix.sql` | Policies com cargo granular |
| `backend/src/seed.js` | Adicionar usuários de teste: gerente, chef, caixa |

### 9.2 Frontend Admin

| Arquivo | Mudança |
|---------|---------|
| `admin/src/App.vue` | Sidebar dinâmica baseada no cargo |
| `admin/src/views/OrdersView.vue` | Ocultar botões não permitidos por cargo |
| `admin/src/views/DashboardView.vue` | Caixa vê apenas versão resumo |

---

## 10. Seed Data: Usuários de Teste

```javascript
const users = [
  { nome: 'Admin Geral', email: 'admin@saborexpress.com', password: 'admin123', cargo: 'admin' },
  { nome: 'Gerente', email: 'gerente@saborexpress.com', password: 'gerente123', cargo: 'gerente' },
  { nome: 'Chef', email: 'chef@saborexpress.com', password: 'chef123', cargo: 'chef' },
  { nome: 'Caixa', email: 'caixa@saborexpress.com', password: 'caixa123', cargo: 'caixa' },
];

for (const u of users) {
  const hash = await bcrypt.hash(u.password, 12);
  await query(
    `INSERT INTO restaurante_users (restaurant_id, nome, email, senha_hash, cargo)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET cargo = $5`,
    [config.restaurantId, u.nome, u.email, hash, u.cargo]
  );
}
```

---

## 11. Testes de Permissões

Para cada cargo, verificar:

### 11.1 Admin
- ✅ Acessa todas as 7 rotas do admin
- ✅ Consegue criar/editar/excluir em todas as entidades

### 11.2 Gerente
- ✅ Acessa todas as 7 seções do sidebar
- ✅ CRUD em clientes, entregadores, produtos, pedidos
- ✅ Gerencia equipe (criar/excluir staff)
- ❌ PUT /restaurante/seguranca → 403

### 11.3 Chef
- ✅ Sidebar mostra só Pedidos e Produtos
- ✅ PATCH /pedidos/:id/status (preparando, pronto_entrega) → 200
- ✅ POST/PUT/DELETE /produtos → 200
- ✅ POST /restaurante/mensagens → 200
- ❌ GET /clientes → 403 (via middleware) ou array vazio (via RLS)
- ❌ GET /entregadores → 403
- ❌ GET /dashboard → 403
- ❌ GET /restaurante/equipe → 403
- ❌ PATCH /pedidos/:id/status (cancelado, recusado) → 403

### 11.4 Caixa
- ✅ Sidebar mostra só Pedidos, Clientes e Dashboard
- ✅ GET /pedidos → 200
- ✅ GET /clientes → 200
- ✅ GET /dashboard/resumo-dia → 200
- ✅ PATCH /pedidos/:id/status (cancelado) → 200
- ❌ POST /produtos → 403
- ❌ GET /entregadores → 403
- ❌ GET /dashboard (completo) → 403
- ❌ POST /restaurante/mensagens → 403
- ❌ PATCH /pedidos/:id/status (preparando) → 403

### 11.5 Cliente (módulo cliente)
- ✅ PATCH /pedidos/:id/cancelar-cliente (enquanto pendente) → 200
- ❌ PATCH /pedidos/:id/cancelar-cliente (depois de aceito) → 400
- ❌ PATCH /pedidos/:id/cancelar-cliente (pedido de outro cliente) → 403
