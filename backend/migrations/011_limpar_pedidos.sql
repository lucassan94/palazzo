-- ============================================================================
-- SABOREXPRESS - Migration 011: Procedimento para limpar pedidos
-- Cria uma função reutilizável para limpar todos os pedidos e dados
-- relacionados de forma segura (respeitando FKs e resetando sequences)
--
-- Uso: SELECT * FROM limpar_pedidos();
-- ============================================================================

-- Remove função se já existir (para ser idempotente)
DROP FUNCTION IF EXISTS limpar_pedidos();

-- Cria função de limpeza
CREATE OR REPLACE FUNCTION limpar_pedidos()
RETURNS TABLE(tabela TEXT, registros_antes BIGINT, registros_deletados BIGINT) AS $$
DECLARE
    v_count BIGINT;
BEGIN
    -- Ordem de exclusão respeitando chaves estrangeiras (FK-safe)

    -- 1. Webhook events
    SELECT COUNT(*) INTO v_count FROM webhook_events;
    tabela := 'webhook_events'; registros_antes := v_count;
    DELETE FROM webhook_events;
    GET DIAGNOSTICS registros_deletados = ROW_COUNT;
    RETURN NEXT;

    -- 2. Mensagens
    SELECT COUNT(*) INTO v_count FROM mensagens_pedido;
    tabela := 'mensagens_pedido'; registros_antes := v_count;
    DELETE FROM mensagens_pedido;
    GET DIAGNOSTICS registros_deletados = ROW_COUNT;
    RETURN NEXT;

    -- 3. Timeline
    SELECT COUNT(*) INTO v_count FROM pedido_timeline;
    tabela := 'pedido_timeline'; registros_antes := v_count;
    DELETE FROM pedido_timeline;
    GET DIAGNOSTICS registros_deletados = ROW_COUNT;
    RETURN NEXT;

    -- 4. Itens do pedido
    SELECT COUNT(*) INTO v_count FROM pedido_itens;
    tabela := 'pedido_itens'; registros_antes := v_count;
    DELETE FROM pedido_itens;
    GET DIAGNOSTICS registros_deletados = ROW_COUNT;
    RETURN NEXT;

    -- 5. Pagamentos
    SELECT COUNT(*) INTO v_count FROM pagamentos;
    tabela := 'pagamentos'; registros_antes := v_count;
    DELETE FROM pagamentos;
    GET DIAGNOSTICS registros_deletados = ROW_COUNT;
    RETURN NEXT;

    -- 6. Pedidos
    SELECT COUNT(*) INTO v_count FROM pedidos;
    tabela := 'pedidos'; registros_antes := v_count;
    DELETE FROM pedidos;
    GET DIAGNOSTICS registros_deletados = ROW_COUNT;
    RETURN NEXT;

    -- Resetar sequences
    PERFORM setval('pedidos_id_seq', (SELECT COALESCE(MAX(id), 1000) FROM pedidos));
    PERFORM setval('pedido_itens_id_seq', (SELECT COALESCE(MAX(id), 0) FROM pedido_itens));
    PERFORM setval('pedido_timeline_id_seq', (SELECT COALESCE(MAX(id), 0) FROM pedido_timeline));
    PERFORM setval('mensagens_pedido_id_seq', (SELECT COALESCE(MAX(id), 0) FROM mensagens_pedido));

END;
$$ LANGUAGE plpgsql;

-- Exemplo de execução:
-- SELECT * FROM limpar_pedidos();
