# 💡 Sugestões de Melhorias de Negócio

**Data:** 19/07/2026  
**Contexto:** Baseado na análise completa do código e arquitetura do SaborExpress V2

---

## 🚀 RECOMENDAÇÕES PRIORITÁRIAS

### 1. Servir imagens por arquivo, não por base64 no banco
**Problema atual:** 42 imagens (~60KB cada) armazenadas como base64 no PostgreSQL. Isso aumenta tráfego de rede em ~33% (overhead do base64), impede cache HTTP e lazy loading.

**Sugestão:** Mover as imagens para `/backend/uploads/cardapio/` e usar `imagem_url` com caminho relativo. O frontend carrega via `<img src="/uploads/cardapio/...">` — o navegador faz cache, reduzindo drasticamente o tráfego.

**Impacto:** Redução de 50-70% no tempo de carregamento do cardápio.  
**Decisão:** 🔄 Reter base64 como fallback ou migrar tudo para arquivos?

### 2. Sistema de cupons/descontos
Funcionalidade não implementada. Sugestões:
- Cupom de primeira compra
- Frete grátis acima de R$ 50
- Desconto fidelidade (a cada 10 pedidos)
- Cupom por aniversário do cliente

**Impacto:** Aumento de ticket médio e recorrência.

### 3. Fila de espera para entregas
Atualmente o entregador vê entregas disponíveis e "pega" manualmente. Sugestão:
- Sistema de pontuação/prioridade
- Atribuição automática por proximidade geográfica
- Fila FIFO com tolerância para recusa

**Impacto:** Redução de tempo de entrega e公平分配.

---

## 📈 RECOMENDAÇÕES ESTRATÉGICAS

### 4. Dashboard com métricas reais
O dashboard atual mostra números OK, mas falta:
- **Margem de lucro** (receita vs CMV)
- **Sazonalidade** (dias da semana/horários de pico)
- **Taxa de conversão** (visitantes vs pedidos)
- **Tempo médio por etapa por entregador** (ranking)
- **Previsão de demanda** (baseada em histórico)

### 5. Notificações push (PWA)
O app cliente é um PWA em potencial. Adicionar:
- Notificação: "Seu pedido está pronto!"
- Notificação: "Entregador a caminho!"
- Notificação: "Cupom de volta! 🎉"

**Tecnologia sugerida:** Service Worker + Web Push API (gratuito, sem depender de Firebase)

### 6. Catálogo com fotos reais
Os placeholders SVG foram substituídos por fotos reais ✅. Próximos passos:
- Upload de imagens diretamente pelo admin (já existe o campo)
- Compressão automática (WebP com fallback)
- CDN (Cloudinary, Imgix ou similar) para cache global

### 7. Multi-idioma
Se houver planos de expansão:
- i18n com vue-i18n
- Traduções: português (atual), inglês, espanhol
- Suporte a cardápio em múltiplos idiomas

---

## 🛠️ RECOMENDAÇÕES TÉCNICAS COM IMPACTO DE NEGÓCIO

### 8. App do entregador offline-first
O app do entregador funciona apenas online. Com `Service Worker` + `IndexedDB`:
- Lista de entregas disponível offline
- Atualização de status sincroniza quando voltar online
- GPS tracking mesmo sem internet (com sync posterior)

**Impacto:** Cobertura em áreas com internet instável.

### 9. Integração com iFood/WhatsApp
- **iFood:** Integração via API de parceiros (se disponível)
- **WhatsApp:** Envio automático de status do pedido via WhatsApp API
- **SMS:** Para clientes sem WhatsApp, via Twilio

**Impacto:** Aumento de pedidos e satisfação do cliente.

### 10. Programa de fidelidade gamificado
- Pontos por pedido (1 ponto = R$ 1 gasto)
- Níveis: Bronze → Prata → Ouro → Diamante
- Benefícios por nível: frete grátis, prioridade, brinde surpresa
- Visível no perfil do cliente

**Impacto:** Retenção de clientes e aumento de LTV.

---

## ⚖️ DECISÕES PENDENTES

| Decisão | Opção A | Opção B | Opção C |
|---------|---------|---------|---------|
| **Imagens** | Manter base64 no banco | Migrar para arquivos + cache | Híbrido (ambos) |
| **Entregas** | Manual (atual) | Automática por geolocalização | Fila FIFO |
| **Notificações** | WebSocket (atual) | + Push PWA | + WhatsApp |
| **Fidelidade** | Não implementar | Pontos simples | Níveis gamificados |
| **iFood** | Ignorar | Integração unilateral | Hub multi-plataforma |

---

## 📊 ESTIMATIVA DE ESFORÇO

| # | Sugestão | Esforço | Impacto Negócio | Prioridade |
|---|----------|---------|-----------------|------------|
| 1 | Imagens por arquivo | 2h | 🔴 Alto | Alta |
| 2 | Cupons/descontos | 8h | 🔴 Alto | Alta |
| 3 | Fila de entregas | 4h | 🟡 Médio | Média |
| 4 | Métricas no dashboard | 6h | 🟡 Médio | Média |
| 5 | Notificações PWA | 12h | 🟡 Médio | Média |
| 6 | Upload com compressão | 3h | 🟢 Baixo | Baixa |
| 9 | WhatsApp tracking | 20h | 🔴 Alto | Alta |
| 10 | Fidelidade gamificado | 16h | 🔴 Alto | Alta |
