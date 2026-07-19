-- ============================================================================
-- SABOREXPRESS - Migration 004: RLS Cargo-Based Policies
-- Substitui as policies da migration 003 por policies que verificam
-- o CARGO específico do usuário (admin, gerente, chef, caixa).
-- ============================================================================
--
-- Alinhado com permissoes-spec.md (v1.0) e rls-spec.md (v2.0)
--
-- Variáveis de sessão esperadas:
--   app.restaurant_id → sempre definido (hardcoded no backend)
--   app.user_role     → 'cliente' | 'entregador' | 'restaurante' | NULL
--   app.user_id       → ID do usuário logado | NULL
--   app.user_cargo    → 'admin' | 'gerente' | 'chef' | 'caixa' | NULL
--
-- ============================================================================
-- MATRIZ DE ACESSO (resumo):
--
-- Tabela            | Admin | Gerente | Chef  | Caixa | Cliente | Entregador
-- ------------------|-------|---------|-------|-------|---------|-----------
-- clientes          | ALL   | ALL     | —     | SEL   | SELF    | SEL
-- entregadores      | ALL   | ALL     | —     | —     | —       | SELF
-- restaurante_users | ALL   | ALL     | —     | —     | —       | —
-- produtos          | ALL   | ALL     | ALL   | —     | SEL(*)  | SEL(*)
-- produtos_extras   | ALL   | ALL     | ALL   | —     | SEL(*)  | SEL(*)
-- pedidos           | ALL   | ALL     | S/U   | S/U   | SELF    | SEL/U
-- pedido_itens      | ALL   | ALL     | S/U   | SEL   | SELF    | ALL
-- pedido_timeline   | ALL   | ALL     | SEL   | SEL   | SELF    | ALL
-- mensagens_pedido  | ALL   | ALL     | ALL   | SEL   | SELF    | ALL
--
-- SELF = próprio registro apenas
-- SEL  = SELECT
-- S/U  = SELECT + UPDATE
-- S/D  = SELECT + DELETE (caixa pode cancelar)
-- ALL  = CRUD completo
-- (*)  = apenas produtos ativos
-- ============================================================================

-- ============================================================================
-- 1. DROP todas as policies antigas (de 001, 003 e tentativas anteriores)
-- ============================================================================
DROP POLICY IF EXISTS clientes_restaurant_isolation ON clientes;
DROP POLICY IF EXISTS clientes_self ON clientes;
DROP POLICY IF EXISTS clientes_staff ON clientes;
DROP POLICY IF EXISTS clientes_caixa_select ON clientes;
DROP POLICY IF EXISTS clientes_entregador_select ON clientes;

DROP POLICY IF EXISTS entregadores_restaurant_isolation ON entregadores;
DROP POLICY IF EXISTS entregadores_self ON entregadores;
DROP POLICY IF EXISTS entregadores_staff ON entregadores;

DROP POLICY IF EXISTS restaurante_users_restaurant_isolation ON restaurante_users;
DROP POLICY IF EXISTS restaurante_users_staff ON restaurante_users;
DROP POLICY IF EXISTS restaurante_users_admin ON restaurante_users;

DROP POLICY IF EXISTS produtos_restaurant_isolation ON produtos;
DROP POLICY IF EXISTS produtos_public_select ON produtos;
DROP POLICY IF EXISTS produtos_staff_all ON produtos;
DROP POLICY IF EXISTS produtos_admin ON produtos;

DROP POLICY IF EXISTS produtos_extras_restaurant_isolation ON produtos_extras;
DROP POLICY IF EXISTS produtos_extras_public_select ON produtos_extras;
DROP POLICY IF EXISTS produtos_extras_staff_all ON produtos_extras;

DROP POLICY IF EXISTS pedidos_restaurant_isolation ON pedidos;
DROP POLICY IF EXISTS pedidos_cliente ON pedidos;
DROP POLICY IF EXISTS pedidos_entregador ON pedidos;
DROP POLICY IF EXISTS pedidos_entregador_select ON pedidos;
DROP POLICY IF EXISTS pedidos_entregador_update ON pedidos;
DROP POLICY IF EXISTS pedidos_staff ON pedidos;
DROP POLICY IF EXISTS pedidos_staff_admin ON pedidos;
DROP POLICY IF EXISTS pedidos_admin_all ON pedidos;
DROP POLICY IF EXISTS pedidos_chef ON pedidos;
DROP POLICY IF EXISTS pedidos_caixa_select ON pedidos;
DROP POLICY IF EXISTS pedidos_caixa ON pedidos;

DROP POLICY IF EXISTS pedido_itens_restaurant_isolation ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_cliente ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_entregador ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_staff ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_admin ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_chef ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_caixa_select ON pedido_itens;

DROP POLICY IF EXISTS pedido_timeline_restaurant_isolation ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_cliente ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_entregador ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_staff ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_admin ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_chef ON pedido_timeline;
DROP POLICY IF EXISTS pedido_timeline_caixa_select ON pedido_timeline;

DROP POLICY IF EXISTS mensagens_pedido_restaurant_isolation ON mensagens_pedido;
DROP POLICY IF EXISTS mensagens_pedido_cliente ON mensagens_pedido;
DROP POLICY IF EXISTS mensagens_pedido_entregador ON mensagens_pedido;
DROP POLICY IF EXISTS mensagens_pedido_staff ON mensagens_pedido;
DROP POLICY IF EXISTS mensagens_pedido_admin ON mensagens_pedido;
DROP POLICY IF EXISTS mensagens_pedido_staff_select ON mensagens_pedido;

-- Garantir que RLS está habilitado em todas as tabelas
ALTER TABLE IF EXISTS clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS restaurante_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS produtos_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pedido_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mensagens_pedido ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. CLIENTES
-- ============================================================================

-- Cliente: vê/edita apenas seus próprios dados
CREATE POLICY clientes_self ON clientes
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'cliente'
        AND id = current_setting('app.user_id', true)::integer
    );

-- Admin/Gerente: CRUD em todos os clientes do tenant
CREATE POLICY clientes_staff ON clientes
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- Caixa: SELECT apenas (consultar dados do cliente)
CREATE POLICY clientes_caixa_select ON clientes
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );

-- Entregador: SELECT apenas (precisa ver nome/telefone/endereço para entrega)
CREATE POLICY clientes_entregador_select ON clientes
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
    );

-- ============================================================================
-- 3. ENTREGADORES
-- ============================================================================

-- Entregador: vê/edita apenas seus próprios dados
CREATE POLICY entregadores_self ON entregadores
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
        AND id = current_setting('app.user_id', true)::integer
    );

-- Admin/Gerente: CRUD em todos os entregadores
CREATE POLICY entregadores_staff ON entregadores
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- ============================================================================
-- 4. RESTAURANTE_USERS (Staff/Admin)
-- ============================================================================

-- Admin/Gerente: CRUD em usuários staff (gerente pode gerenciar equipe)
CREATE POLICY restaurante_users_staff ON restaurante_users
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- ============================================================================
-- 5. PRODUTOS
-- ============================================================================

-- Público: SELECT em produtos ativos (clientes, anônimos, entregadores)
CREATE POLICY produtos_public_select ON produtos
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND ativo = true
    );

-- Admin/Gerente/Chef: CRUD completo (chef gerencia o cardápio)
CREATE POLICY produtos_staff ON produtos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente', 'chef')
    );

-- ============================================================================
-- 6. PRODUTOS_EXTRAS
-- ============================================================================

-- Público: SELECT em extras de produtos ativos
CREATE POLICY produtos_extras_public_select ON produtos_extras
    FOR SELECT
    USING (
        produto_id IN (
            SELECT id FROM produtos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND ativo = true
        )
    );

-- Admin/Gerente/Chef: CRUD completo
CREATE POLICY produtos_extras_staff ON produtos_extras
    FOR ALL
    USING (
        produto_id IN (
            SELECT id FROM produtos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente', 'chef')
    );

-- ============================================================================
-- 7. PEDIDOS (a mais complexa)
-- ============================================================================

-- Cliente: CRUD apenas nos seus próprios pedidos
CREATE POLICY pedidos_cliente ON pedidos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'cliente'
        AND cliente_id = current_setting('app.user_id', true)::integer
    );

-- Entregador SELECT: pedidos atribuídos OU disponíveis (pronto_entrega, sem entregador)
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
CREATE POLICY pedidos_entregador_update ON pedidos
    FOR UPDATE
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
        AND entregador_id = current_setting('app.user_id', true)::integer
    );

-- Admin/Gerente: CRUD completo em todos os pedidos
CREATE POLICY pedidos_admin ON pedidos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente')
    );

-- Chef: SELECT + UPDATE (mudar status: pendente→preparando→pronto_entrega)
CREATE POLICY pedidos_chef ON pedidos
    FOR SELECT, UPDATE
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'chef'
    );

-- Caixa: SELECT + UPDATE (pode ver fila e cancelar pedidos via PATCH status)
CREATE POLICY pedidos_caixa ON pedidos
    FOR SELECT, UPDATE
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );

-- ============================================================================
-- 8. PEDIDO_ITENS (herda restrições do pedido pai)
-- ============================================================================

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

-- Entregador: itens dos pedidos atribuídos ou disponíveis
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

-- Caixa: SELECT apenas (ver itens do pedido; o CASCADE do pedido pai remove os itens)
CREATE POLICY pedido_itens_caixa ON pedido_itens
    FOR SELECT
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );

-- ============================================================================
-- 9. PEDIDO_TIMELINE
-- ============================================================================

-- Cliente: timeline dos seus pedidos
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

-- Entregador: timeline dos pedidos atribuídos
CREATE POLICY pedido_timeline_entregador ON pedido_timeline
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

-- Chef: SELECT apenas (ver histórico)
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

-- Caixa: SELECT apenas
CREATE POLICY pedido_timeline_caixa ON pedido_timeline
    FOR SELECT
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );

-- ============================================================================
-- 10. MENSAGENS_PEDIDO
-- ============================================================================

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
            AND (
                entregador_id = current_setting('app.user_id', true)::integer
                OR (entregador_id IS NULL AND status = 'pronto_entrega')
            )
        )
        AND current_setting('app.user_role', true) = 'entregador'
    );

-- Admin/Gerente/Chef: CRUD completo (chef pode enviar mensagens para cliente)
CREATE POLICY mensagens_pedido_staff ON mensagens_pedido
    FOR ALL
    USING (
        restaurante_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) IN ('admin', 'gerente', 'chef')
    );

-- Caixa: SELECT apenas (ver mensagens, não enviar)
CREATE POLICY mensagens_pedido_caixa ON mensagens_pedido
    FOR SELECT
    USING (
        restaurante_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
        AND current_setting('app.user_cargo', true) = 'caixa'
    );

-- ============================================================================
-- VERIFICAÇÃO: listar todas as policies ativas
-- ============================================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
