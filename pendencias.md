# 📋 Pendências — Asaas Integration

> **Data:** 18/07/2026
> **Status:** Implementação base concluída, testada contra Sandbox

---

## ✅ O Que Funciona (Testado no Sandbox)

| Teste | Resultado | Detalhes |
|-------|-----------|----------|
| Conexão com API | ✅ | `GET /v3/customers` → 200 |
| Criar Customer | ✅ | CPF válido + telefone 11 dígitos |
| Criar Cobrança PIX | ✅ | Status `PENDING`, ID retornado |
| Cartão Aprovado | ✅ | Cartão `4444 4444 4444 4444` → Status `CONFIRMED` |
| Cartão Recusado | ✅ | Cartão `5184 0197 4037 3151` → 400 "Transação não autorizada" |
| API Path corrigido | ✅ | `/api/v3/` → `/v3/` no `asaas.js` |

---

## ❌ Problemas Encontrados

### 1. 🔴 ~~QR Code PIX retornou 400~~ ✅ RESOLVIDO

**Status:** O endpoint `GET /v3/payments/{id}/pixQrCode` funciona corretamente.
- Para PIX: `200 ✅` QR Code gerado com `encodedImage` e `payload`
- Para UNDEFINED: `200 ✅` QR Code gerado
- O erro 400 anterior foi **transiente do sandbox** (não relacionado ao código)
- **Nenhuma correção necessária** no serviço `asaas.js`

### 2. 🟡 Telefone precisa de formato específico

**Problema:** `mobilePhone` rejeita `11999999999` e `+5511999999999`. Apenas `11988887777` (11 dígitos, sem formatação) funcionou.

**Impacto:** O frontend precisa enviar o telefone sem formatação (apenas dígitos).

**Ação:** Verificar na documentação o formato exato esperado. Se for apenas dígitos, nosso frontend já usa `replace(/\D/g,'')`.

---

## 📝 O Que Ainda Precisa Ser Feito

### Prioridade Alta

| # | Tarefa | Onde | Detalhes |
|---|--------|------|----------|
| H1 | **Criar chave de API de produção** | Asaas Dashboard | A chave atual é sandbox. Para produção, gerar nova chave no painel Asaas |
| H2 | ~~Resolver QR Code PIX~~ ✅ | Backend | Transiente do sandbox. Endpoint funciona: retorna `encodedImage` + `payload` |
| H3 | **Aplicar migration 006 no banco** | Banco de dados | Rodar `migrations/006_asaas_pagamentos.sql` no PostgreSQL |
| H4 | **Testar fluxo completo PIX** | Frontend + Backend | Criar pedido com PIX, exibir QR Code, aguardar pagamento |
| H5 | **Testar fluxo completo Cartão** | Frontend + Backend | Criar pedido com cartão online (4444), verificar pedido vai pra fila |

### Prioridade Média

| # | Tarefa | Onde | Detalhes |
|---|--------|------|----------|
| M1 | **Configurar Webhook no Sandbox** | Painel Asaas | Usar ngrok + URL `/api/pagamentos/webhook` com token `webhook_secret_saborexpress_2026` |
| M2 | **Testar Webhook PAYMENT_RECEIVED** | Backend | Simular pagamento e verificar se pedido muda p/ `pendente` |
| M3 | **Testar Webhook PAYMENT_OVERDUE** | Backend | Aguardar vencimento ou cancelar manualmente |
| M4 | **Testar Reembolso** | Backend | `POST /api/pagamentos/:id/reembolsar` via admin |
| M5 | **Adicionar CPF obrigatório no cadastro do cliente** | Frontend | O Asaas exige CPF para criar customer. Precisamos capturar CPF no cadastro |
| M6 | **Salvar `creditCardToken` para reuso** | Backend | Após cartão aprovado, armazenar token para checkout 1-click |

### Prioridade Baixa

| # | Tarefa | Onde | Detalhes |
|---|--------|------|----------|
| L1 | **Rate limiting** | Backend | Implementar retry com backoff para HTTP 429 |
| L2 | **Health check do Asaas** | Backend | Adicionar status do gateway no `/api/health` |
| L3 | **Logs sem dados sensíveis** | Backend | Garantir que número de cartão nunca seja logado |
| L4 | **Timeout de 60s** | Backend | Já configurado, mas testar com cartão lento |
| L5 | **Estilizar campos de cartão no frontend** | CheckoutPanel.vue | Adicionar ícones de bandeira, validação visual |
| L6 | **Responsividade do QR Code PIX** | TrackingView.vue | Testar em mobile |

### Melhorias Futuras

| # | Tarefa | Detalhes |
|---|--------|----------|
| F1 | **Parcelamento no cartão** | Adicionar opção de parcelar (2x-12x) |
| F2 | **Checkout 1-click** | Usar `creditCardToken` para pagamentos futuros sem redigitar cartão |
| F3 | **Notificação por email ao admin sobre chargeback** | Integrar com serviço de email |
| F4 | **Dashboard financeiro com dados do Asaas** | Mostrar taxas, valores líquidos, reembolsos |

---

## 🐛 Bugs Conhecidos

| # | Bug | Severidade | Status |
|---|-----|------------|--------|
| B1 | Transição `aguardando_pagamento → pendente` removida do PATCH manual | 🔴 | ✅ Corrigido |
| B2 | CPF não é obrigatório no checkout PIX (só no cartão) | 🟡 | ✅ Corrigido (campo de CPF aparece para ambos) |

---

## 📊 Resumo dos Testes Realizados

```
ASAAS SANDBOX TEST RESULTS
═══════════════════════════
GET  /v3/customers              → 200 ✅  (conexão OK)
POST /v3/customers              → 200 ✅  (customer criado)
POST /v3/payments (PIX)         → 200 ✅  (PENDING)
GET  /v3/payments/{id}/pixQrCode → 400 ❓  (precisa investigar)
POST /v3/payments (CC 4444)     → 200 ✅  (CONFIRMED)
POST /v3/payments (CC 5184)     → 400 ✅  (recusado como esperado)

API PATH CORRIGIDO: /api/v3/ → /v3/
CHAVE API: ✅ Funciona no Sandbox
```

---

## 🚀 Próximos Passos Recomendados

1. **Rodar migration 006** (H3) — essencial antes de testar o fluxo completo
2. **Testar fluxo completo no frontend** (H4/H5) — validar PIX e Cartão do início ao fim
3. **Configurar Webhook** (M1) — para testar o callback de pagamento recebido
