-- ============================================================================
-- SABOREXPRESS - Migration 003: RLS Role-Based Policies
-- Substitui as policies antigas (tenant isolation apenas) por policies
-- que também verificam o papel do usuário (cliente, entregador, staff)
-- ============================================================================
--
-- Variáveis de sessão esperadas (sempre definidas via database.js mesma conexão):
--   app.restaurant_id  → sempre definido (hardcoded no backend)
--   app.user_role      → 'cliente' | 'entregador' | 'restaurante' | NULL
--   app.user_id        → ID do usuário logado | NULL
--   app.user_cargo     → 'admin' | 'gerente' | 'chef' | 'caixa' | NULL
--
-- USAMOS current_setting('nome', true) → retorna NULL se não definido
-- em vez de lançar erro. Isso permite requests não autenticadas
-- (ex: listar cardápio) funcionarem sem contexto de usuário.
-- ============================================================================

-- ============================================================================
-- 1. DROP policies antigas (FOR ALL TO {public} sem role check)
-- ============================================================================
DROP POLICY IF EXISTS clientes_restaurant_isolation ON clientes;
DROP POLICY IF EXISTS entregadores_restaurant_isolation ON entregadores;
DROP POLICY IF EXISTS restaurante_users_restaurant_isolation ON restaurante_users;
DROP POLICY IF EXISTS produtos_restaurant_isolation ON produtos;
DROP POLICY IF EXISTS produtos_extras_restaurant_isolation ON produtos_extras;
DROP POLICY IF EXISTS pedidos_restaurant_isolation ON pedidos;
DROP POLICY IF EXISTS pedido_itens_restaurant_isolation ON pedido_itens;
DROP POLICY IF EXISTS pedido_timeline_restaurant_isolation ON pedido_timeline;
DROP POLICY IF EXISTS mensagens_pedido_restaurant_isolation ON mensagens_pedido;

-- ============================================================================
-- 2. CLIENTES
-- ============================================================================
-- Cliente: vê apenas seus próprios dados
-- Staff: vê todos os clientes do tenant
CREATE POLICY clientes_self ON clientes
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND (
            current_setting('app.user_role', true) = 'cliente'
            AND id = current_setting('app.user_id', true)::integer
        )
    );

CREATE POLICY clientes_staff ON clientes
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- Entregadores precisam ver nome/telefone do cliente para entrega
CREATE POLICY clientes_entregador_select ON clientes
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
    );

-- ============================================================================
-- 3. ENTREGADORES
-- ============================================================================
-- Entregador: vê apenas seus próprios dados
-- Staff: vê todos os entregadores do tenant
CREATE POLICY entregadores_self ON entregadores
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND (
            current_setting('app.user_role', true) = 'entregador'
            AND id = current_setting('app.user_id', true)::integer
        )
    );

CREATE POLICY entregadores_staff ON entregadores
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- ============================================================================
-- 4. RESTAURANTE_USERS (Staff/Admin)
-- ============================================================================
-- Apenas staff pode ver dados de outros staff
CREATE POLICY restaurante_users_staff ON restaurante_users
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- ============================================================================
-- 5. PRODUTOS (público dentro do tenant)
-- ============================================================================
-- Produtos ativos são visíveis para todos (clientes, entregadores, staff, anônimos)
CREATE POLICY produtos_public_select ON produtos
    FOR SELECT
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND ativo = true
    );

-- Staff pode gerenciar produtos (incluir inativos)
CREATE POLICY produtos_staff_all ON produtos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- ============================================================================
-- 6. PRODUTOS_EXTRAS
-- ============================================================================
CREATE POLICY produtos_extras_public_select ON produtos_extras
    FOR SELECT
    USING (
        produto_id IN (
            SELECT id FROM produtos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND ativo = true
        )
    );

CREATE POLICY produtos_extras_staff_all ON produtos_extras
    FOR ALL
    USING (
        produto_id IN (
            SELECT id FROM produtos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- ============================================================================
-- 7. PEDIDOS
-- ============================================================================
-- Cliente: vê apenas seus próprios pedidos
-- Entregador: vê pedidos atribuídos a ele
-- Staff: vê todos os pedidos do tenant
CREATE POLICY pedidos_cliente ON pedidos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'cliente'
        AND cliente_id = current_setting('app.user_id', true)::integer
    );

CREATE POLICY pedidos_entregador ON pedidos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'entregador'
        AND entregador_id = current_setting('app.user_id', true)::integer
    );

CREATE POLICY pedidos_staff ON pedidos
    FOR ALL
    USING (
        restaurant_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- ============================================================================
-- 8. PEDIDO_ITENS (acompanha as policies do pedido pai)
-- ============================================================================
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

CREATE POLICY pedido_itens_entregador ON pedido_itens
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
            AND entregador_id = current_setting('app.user_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'entregador'
    );

CREATE POLICY pedido_itens_staff ON pedido_itens
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- ============================================================================
-- 9. PEDIDO_TIMELINE
-- ============================================================================
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

CREATE POLICY pedido_timeline_staff ON pedido_timeline
    FOR ALL
    USING (
        pedido_id IN (
            SELECT id FROM pedidos
            WHERE restaurant_id = current_setting('app.restaurant_id', true)::integer
        )
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- ============================================================================
-- 10. MENSAGENS_PEDIDO
-- ============================================================================
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

CREATE POLICY mensagens_pedido_staff ON mensagens_pedido
    FOR ALL
    USING (
        restaurante_id = current_setting('app.restaurant_id', true)::integer
        AND current_setting('app.user_role', true) = 'restaurante'
    );

-- ============================================================================
-- VERIFICAÇÃO: listar todas as policies ativas
-- ============================================================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
