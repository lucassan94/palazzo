# 🍔 SaborExpress — Documentação Completa de Funcionalidades

> **Data:** 18/07/2026
> **Versão:** V2
> **Sistema:** Plataforma completa de delivery com 3 módulos integrados

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Módulo 1: Cliente (Cardápio Digital)](#módulo-1-cliente-cardápio-digital)
3. [Módulo 2: Administrativo (Restaurante)](#módulo-2-administrativo-restaurante)
4. [Módulo 3: Entregador (Driver App)](#módulo-3-entregador-driver-app)
5. [Funcionalidades Compartilhadas](#funcionalidades-compartilhadas)
6. [Jornadas do Usuário](#jornadas-do-usuário)

---

## Visão Geral

O **SaborExpress** é um sistema completo de gestão de delivery composto por **três módulos integrados** que se comunicam em tempo real:

| Módulo | Quem usa | Finalidade |
|--------|----------|------------|
| **Cliente** | Clientes finais | Cardápio digital, carrinho, checkout e tracking de pedidos |
| **Administrativo** | Donos, gerentes, cozinha | Gestão de pedidos, produtos, entregadores e finanças |
| **Entregador** | Entregadores | Rotas de entrega, financeiro pessoal e perfil |

---

## Módulo 1: Cliente (Cardápio Digital)

### 🏠 Página Inicial (Home)

#### Banner e Identidade Visual
- **Header** com o logo do SaborExpress, indicador visual de "Loja Aberta/Fechada", nome do usuário logado e botão de sair
- **Banner promocional** no topo com imagem de destaque e frase "Cardápio Digital — Ingredientes selecionados, sabor inigualável"
- Se a loja estiver **fechada**, um banner vermelho fixo no topo avisa: *"Loja Fechada no momento — novos pedidos não podem ser realizados"*

#### Busca de Produtos
- **Barra de busca** com placeholder "Buscar por nome, categoria ou descrição..."
- Enquanto digita, o cardápio é filtrado **em tempo real** mostrando apenas produtos correspondentes
- Botão "×" para limpar a busca rapidamente
- Se nenhum produto for encontrado, exibe mensagem: *"Nenhum prato encontrado para '[termo]' — Tente buscar por outro nome ou categoria"*

#### Filtro por Categorias
- Abas de categoria fixas no topo (grudam ao rolar): **Todos, Burguers, Pizzas, Bebidas, Sobremesas, Porções**
- Ao clicar em uma categoria, o título da seção muda automaticamente (ex: "Burguers")
- A aba ativa fica destacada na cor vermelha

#### Grade de Produtos
- Cada produto é exibido como um **card** com:
  - Imagem do produto
  - Nome
  - Descrição curta (ingredientes, detalhes)
  - Preço em destaque
  - Botão "**+**" para adicionar ao carrinho
- Ao clicar em qualquer lugar do card (exceto botão +), abre o **modal de customização**

### 🛒 Carrinho de Compras

#### Barra Flutuante
- Aparece na **parte inferior da tela** assim que o primeiro item é adicionado
- Mostra: quantidade de itens (ex: "3 itens") e total da compra (subtotal + frete)
- Ao clicar, abre a **gaveta de checkout**

#### Gaveta de Checkout (Drawer)
- Abre de **baixo para cima** com animação suave
- **Divisor visual no topo** (indicador para fechar com gesto de swipe)
- Cabeçalho "Sua Sacola" com botão "×" para fechar
- **Lista de itens** com: quantidade (ex: 2x), nome do produto, preço unitário × qtd, botão de lixeira para remover
- **Indicador de etapas** do checkout: Dados → Endereço → Pagamento → Revisar

### 🛍️ Checkout Multi-Etapas

#### Etapa 1: Seus Dados
- Nome e Sobrenome (campos separados)
- Telefone / WhatsApp
- Botão "Continuar" → valida se campos obrigatórios estão preenchidos

#### Etapa 2: Endereço de Entrega
- **CEP** com busca automática (ViaCEP + BrasilAPI):
  - Ao digitar o CEP e clicar "Buscar", o sistema preenche automaticamente: logradouro, bairro, cidade e estado
  - Caso não encontre, exibe aviso para preencher manualmente
- Logradouro (rua/avenida)
- Número
- Bairro
- Complemento (opcional)
- Cidade e Estado (pré-preenchidos como São Paulo/SP)
- **Cálculo inteligente de frete**: baseado na distância real entre o restaurante e o CEP informado
- Botões "Voltar" e "Continuar"

#### Etapa 3: Forma de Pagamento
- **Seleção do método** de pagamento:
  - Cartão de Crédito (na entrega)
  - Cartão de Débito (na entrega)
  - Dinheiro
- Se "Dinheiro" for selecionado, aparece o campo: *"Precisa de troco para quanto?"*
- **Campo de observações** para o pedido (ex: "Sem cebola, molho extra, ponto da carne...")
- Botões "Voltar" e "Continuar"

#### Etapa 4: Resumo do Pedido
- Exibe **todos os dados** para revisão antes de confirmar:
  - Lista de todos os itens com quantidades e valores
  - Endereço completo de entrega
  - Forma de pagamento (com detalhe de troco, se aplicável)
  - **Tempo estimado total** (preparo + entrega) calculado em tempo real
  - Observações (se houver)
- **Resumo financeiro** com:
  - Subtotal (itens)
  - Taxa de entrega
  - **Total**
- Botão "Confirmar Pedido"

### 📋 Histórico de Pedidos

- Lista **todos os pedidos** do cliente logado, ordenados do mais recente para o mais antigo
- Cada pedido exibe:
  - Número do pedido (#1028)
  - Data/hora
  - Itens comprados
  - Valor total
  - Forma de pagamento
  - **Status atual** com cor correspondente (amarelo = pendente, azul = preparando, verde = entregue, vermelho = cancelado)
  - Nome do entregador (se atribuído)
  - **Mensagens da cozinha** com badge "💬 Mensagem da Cozinha"
  - Observações do pedido
  - Botão "**Acompanhar Pedido**" (para pedidos ativos)

#### Timer de Entrega
- Um **cronômetro regressivo** mostra o tempo estimado restante para entrega
- Barra de progresso visual que avança em tempo real
- Se o tempo estourar, a barra muda de cor (amarelo → laranja → vermelho)

### 🗺️ Tracking em Tempo Real

Uma **timeline visual** de 6 etapas que se atualiza automaticamente:

| Passo | Status | Descrição |
|-------|--------|-----------|
| 1 | ✅ Pedido Recebido | Restaurante confirmou seu pedido |
| 2 | 🍳 Preparando | Seu pedido está na cozinha |
| 3 | 📦 Saiu para Entrega | Pedido pronto, saindo do restaurante |
| 4 | 🏍️ Entregador a Caminho | Entregador a caminho do seu endereço |
| 5 | 📍 Entregador Chegou | Entregador chegou ao seu endereço |
| 6 | 🎉 Entregue | Pedido entregue com sucesso! |

- **Etapa atual** fica pulsando com animação
- **Etapas concluídas** ficam em verde com ícone de check
- **Etapas futuras** aparecem em cinza
- **Cartão de status** no final exibe: número do pedido, status atual em texto, barra de progresso, nome do entregador (se atribuído), **horário estimado de entrega**
- **Mensagens do restaurante** aparecem em card amarelo destacado
- Atualização automática a cada **3 segundos**

### 👤 Perfil do Usuário

- **Avatar** com iniciais do nome sobre fundo gradiente vermelho
- Nome e email em destaque
- **Formulário de edição**:
  - Nome e Sobrenome
  - Telefone / WhatsApp
  - Endereço completo com busca automática de CEP
  - Logradouro, Número, Bairro, Complemento, Ponto de Referência
- Mensagem de sucesso verde "Perfil atualizado com sucesso!"
- Se o usuário **não estiver logado**, o perfil mostra campos de email e senha para criar conta

### 🔐 Autenticação (Login/Cadastro)

#### Modal de CEP Onboarding
- Ao entrar no site sem estar logado, um **modal** pergunta: *"Qual seu endereço? Informe seu CEP para verificar se entregamos na sua região"*
- Ao digitar um CEP válido, o sistema:
  - Verifica a distância real até o restaurante
  - Informa se a região é atendida e o valor do frete
  - Fecha automaticamente após confirmação
- Botões para "Fazer Login", "Cadastrar-se" ou "Continuar navegando sem CEP"
- O CEP informado fica salvo para o checkout

#### Tela de Login
- Formulário com email e senha (mínimo 8 caracteres)
- Botão "Entrar" e "Criar uma conta"
- Mensagens de erro em vermelho (ex: "E-mail ou senha inválidos")

#### Tela de Cadastro
- Nome, Sobrenome, Telefone, Email, Senha
- Dados preenchidos automaticamente se o usuário já tiver informado no checkout
- Botão "Cadastrar e Finalizar"
- Se o usuário estava no meio de um pedido, ele é redirecionado de volta após o login

### 🧭 Navegação Inferior (Bottom Nav)

Ícones fixos na parte inferior da tela:
| Ícone | Aba | Descrição |
|-------|-----|-----------|
| 🏠 | Início | Cardápio e produtos |
| 📋 | Pedidos | Histórico e tracking |
| 👤 | Perfil | Dados do usuário |

- Aba ativa fica destacada com indicador vermelho superior
- Aba "Pedidos" exibe **badge de notificação** quando há mensagens novas da cozinha

---

## Módulo 2: Administrativo (Restaurante)

### 🔐 Login

- Tela de login exclusiva para administradores
- Verifica se o email está autorizado na tabela de usuários do restaurante
- Sessão com **timeout de inatividade de 4 horas** — após esse período sem interação, faz logout automático por segurança
- Diferentes níveis de acesso: **admin, gerente, chef, caixa**

### 🗂️ Sidebar de Navegação

Menu lateral com as seguintes abas:

---

### 📋 1. Fila de Pedidos

A tela principal do restaurante com **três visualizações diferentes**:

#### Visualização em Cartões (Padrão)
- Cada pedido é um **card** com:
  - Número do pedido (#1042)
  - Nome do cliente
  - Data/hora do pedido
  - Nome do entregador (se atribuído)
  - **Timers de acompanhamento**:
    - ⏱ Tempo total desde o pedido
    - ⏳ Tempo no status atual
    - Se passar de 75% do orçamento de tempo, o timer fica vermelho (urgente)
  - **Barra de progresso** visual dividida por etapas (Pendente → Preparando → Pronto → Em Rota → No Local → Entregue)
    - Cada etapa mostra cor e tempo decorrido
    - Se estourar o tempo, aparece ⚠️
  - Telefone e endereço do cliente
  - Itens do pedido
  - Forma de pagamento
  - Observações
  - Mensagens enviadas (se houver)
  - **Botões de ação** conforme o status:
    - Pendente → **"Aceitar"** (verde) ou **"Recusar"** (com justificativa)
    - Preparando → **"Pronto para Entrega"**
    - Aguardando entregador → texto: *"Aguardando Entregador..."*
    - Em Rota → texto: *"Pedido em Rota de Entrega"*
    - No Local → texto: *"Entregador no Local"*
    - Entregue → texto: *"✓ Entrega Concluída"*
    - Cancelado → texto: *"✕ Pedido Cancelado"* (com motivo)
  - Botão **"Detalhes"** para abrir modal completo
  - Botão **"💬 Mensagem"** para enviar mensagem ao cliente

#### Visualização Kanban
- Colunas organizadas por status: **Aguardando → Preparando → Pronto → Em Rota → No Local → Entregue**
- Arrastar e soltar cards entre colunas para mudar o status
- Cada coluna mostra a contagem de pedidos
- Cards com timer e cor de urgência

#### Visualização em Lista Compacta
- Tabela com: ID, Cliente, Status, Itens, Total, Tempo
- Status com cores (ex: Pendente = amarelo, Preparando = azul)

#### Filtros de Pedidos
- **Por status**: Ativos, Concluídos, Cancelados, Todos
- **Por data**: seleção de data inicial e final com calendário
- Botão para limpar filtros

#### Resumo do Dia
- Card ao lado com:
  - **Pedidos Entregues**: contagem do dia
  - **Faturamento Estimado**: valor total (R$) dos pedidos entregues

---

### 🍔 2. Gerenciar Produtos

#### Formulário de Cadastro/Edição
- **Nome do Produto**
- **Categoria**: Burguer, Pizza, Porções, Bebidas, Sobremesas
- **Preço (R$)**
- **Imagem do Produto**:
  - Upload de arquivo (JPG, PNG, WebP — até 5MB)
  - Preview da imagem antes de salvar
  - Botão para remover imagem
- **Descrição**: texto livre (ingredientes, detalhes)
- **Opcionais / Adicionais**: 
  - Adicionar múltiplos itens com nome e preço (ex: "Bacon + R$ 4,00", "Cheddar + R$ 3,00")
  - Botão "+ Adicionar" para incluir mais opcionais
  - Botão "×" para remover cada opcional
- Botão "Cadastrar Produto" / "Cancelar Edição"

#### Lista de Produtos
- Tabela com todos os produtos cadastrados
- Botões de editar e excluir para cada produto
- Atualização em tempo real

---

### 👥 3. Clientes / Relatórios (CRM)

- **Tabela de clientes** com:
  - Nome
  - E-mail / Contato
  - Total de Pedidos realizados
  - Valor Total Gasto (R$)
  - Produto Mais Comprado
- Dados ordenáveis e pesquisáveis

---

### 🛵 4. Gerenciar Entregadores

#### Formulário de Cadastro
- Dados pessoais: Nome Completo, Telefone, RG, CPF, Data de Nascimento, Endereço
- Dados de acesso: E-mail, Senha (mín. 8 caracteres)
- Mensagens de sucesso/erro

#### Lista de Entregadores
- Tabela com: Nome, E-mail, Telefone, Ações (editar/excluir)
- Opção de inativar entregador (sem excluir do banco)

---

### 📊 5. Relatório de Entregas por Entregador

- **Tabela de desempenho** com:
  - Nome do entregador
  - Total de Entregas realizadas
  - Valor a Receber (R$)
  - Última Entrega (data/hora)

---

### 📈 6. Dashboard Financeiro e Operacional

#### Filtro de Período
- Seleção de data inicial e final com calendário
- Botões "Filtrar" e "Limpar"

#### Indicadores-Chave (KPIs)
- **Faturamento Total** no período
- **Total de Pedidos**
- **Ticket Médio** por pedido
- **Pedidos Entregues** (quantidade)
- **Pedidos Cancelados** (quantidade)
- **Tempo Médio de Preparo** (minutos)
- **Taxa de Cancelamento** (percentual)

#### Gráficos e Distribuições
- **Status dos Pedidos**: distribuição por status (Pendente, Preparando, Pronto, Em Rota, Entregue, Cancelado)
- **Meios de Pagamento**: quantidade e receita por método (Crédito, Débito, Dinheiro)
- **Produtos Mais Vendidos**: Top 10 por receita gerada
- **Tempos Médios por Etapa**: quanto tempo cada fase leva em média (Pendente → Preparando → Pronto → Em Rota → No Local)

---

### ⚙️ 7. Configurações

#### Status da Loja
- **Toggle** para abrir/fechar a loja
  - Quando fechada: banner no site do cliente avisa, checkout é bloqueado
  - Indicador visual no header do admin (verde pulsando = aberta)

#### Impressão Térmica
- **Toggle** para ativar/desativar auto-impressão
- Quando ativo: ao aceitar um pedido, imprime automaticamente na impressora térmica
- Layout otimizado para impressoras de 58mm

#### Dados do Restaurante
- Nome do Restaurante
- Endereço completo
- **CEP do Restaurante** (usado para calcular distância até o cliente)
  - Botão com ícone de mapa-pino para geolocalizar automaticamente

#### Tempo de Preparo
- Campo para definir o tempo estimado de preparo na cozinha (em minutos)
- Usado no cálculo de entrega e nos timers dos cards de pedido

#### Matriz de Logística (Raio de Entrega)
- **Tabela configurável** com faixas de raio:
  | Raio (KM) | Tempo Mín (min) | Tempo Máx (min) | Custo (R$) |
  |-----------|-----------------|-----------------|-----------|
  | 1         | 15              | 25              | 5,00      |
  | 3         | 20              | 35              | 7,00      |
  | 5         | 25              | 45              | 10,00     |
  | 10        | 30              | 60              | 15,00     |
- Botão "Adicionar Faixa de Raio"
- Cálculo automático de frete baseado na distância real Haversine

#### Segurança (Acesso Admin)
- Alterar email e senha do administrador
- Confirmação de nova senha

#### Gestão de Equipe
- **Criar Novo Usuário**: Nome, E-mail, Senha, Cargo (Gerente, Chef, Caixa)
- **Lista de Usuários Cadastrados** com cargo e ações (excluir)

---

## Módulo 3: Entregador (Driver App)

### 🔐 Login

- Tela de login exclusiva com ícone de moto
- Verifica se o entregador está cadastrado e ativo no sistema
- Acesso negado se não estiver autorizado

### 🏠 Dashboard

#### Cabeçalho
- **Avatar** com iniciais do nome (ex: "JS" para João Silva)
- Nome do entregador
- Indicador "Em serviço"
- Ícone de sair (logout)

#### Resumo
- Cartões de métricas: entregas concluídas (número) e total de frete recebido (R$)

### 🛵 1. Entregas

#### Entregas Ativas
- **Cards de entrega** com:
  - Status em destaque (Pronto para Entrega, Em Trânsito, Cheguei ao Destino)
  - **Endereço de coleta**: SaborExpress Cozinha (Av. Principal, 500)
  - **Endereço de entrega**: nome do cliente e endereço completo
  - Itens do pedido
  - **Valor do frete** em verde
  - **Timer de tolerância** (se aguardando no local): contagem regressiva de 5 minutos
- **Botão de ação** que muda conforme o status:
  - Pronto → **"Coletar & Iniciar Rota"** (🚀)
  - Em Trânsito → **"Cheguei ao Destino"** (📍)
  - Cheguei → **"Confirmar Entrega"** (✅)
- **Bloqueio inteligente**: se o entregador já tem uma entrega em andamento, o sistema bloqueia de pegar outra
- Ao clicar no card (não no botão), abre o **modal de detalhes**

#### Modal de Detalhes da Entrega
- **Número do pedido**
- **Seção Cliente**: nome, contato com botão WhatsApp, endereço
- **Seção Pagamento**: método e observações
- **Seção Itens**: lista completa com subtotal, frete e total em destaque verde
- **Timeline da Entrega**: histórico completo de cada etapa com data/hora e duração

#### Entregas Concluídas Hoje
- Seção recolhível com entregas já finalizadas no dia
- Mostra: cliente, endereço e frete recebido

#### Badge de Notificação
- Ícone na navegação inferior mostra a **quantidade de entregas disponíveis**
- Animação pulsante quando há novas entregas

### 💰 2. Extrato Financeiro

#### Cards de Resumo
| Período | Descrição |
|---------|-----------|
| **Hoje** | Total de fretes recebidos hoje |
| **Esta Semana** | Acumulado da semana (domingo a sábado) |
| **Este Mês** | Acumulado do mês |

#### Últimas Entregas
- Lista cronológica reversa com:
  - Número do pedido
  - Nome do cliente
  - Data e hora da entrega
  - Valor do frete recebido

### 👤 3. Perfil

#### Formulário de Configurações
- **Foto do perfil** (upload via câmera ou galeria, salva no navegador)
- Nome Completo
- Telefone
- Endereço
- Alterar senha (com confirmação)
- Mensagens de sucesso/erro

---

## Funcionalidades Compartilhadas

### 🔔 Sistema de Notificações Toast
- Notificações no canto superior direito
- 4 tipos: **Sucesso** (verde), **Erro** (vermelho), **Aviso** (laranja), **Info** (azul)
- Fechamento automático após alguns segundos
- Pode ser fechada manualmente clicando
- Animação de entrada suave

### ⏳ Loading Overlay
- Tela semitransparente com blur que congela a interação
- Spinner giratório e mensagem personalizada (ex: "Entrando...", "Criando sua conta...")
- Impede cliques acidentais durante operações críticas

### ✅ Modal de Confirmação
- Substitui o `confirm()` nativo do navegador
- Design moderno com 3 variantes: **Perigo** (vermelho), **Primário** (padrão), **Aviso** (laranja)
- Fecha ao clicar fora ou pressionar Escape

### 🗺️ Cálculo Inteligente de Frete
- Usa coordenadas geográficas reais (BrasilAPI) do CEP do cliente
- Fórmula **Haversine** para calcular distância exata até o restaurante
- Seleciona automaticamente a faixa de raio adequada na matriz de logística
- Tempo de entrega calculado = preparo + trânsito

### 🔍 Busca Automática de CEP
- Integração com **ViaCEP** e **BrasilAPI**
- Preenche automaticamente: rua, bairro, cidade e estado
- Usado em: modal de onboarding, checkout e perfil

### 🛡️ Segurança
- **Autenticação separada** por módulo (cada um tem seu sistema de login)
- **Timeout de inatividade** (4h para admin, configurável)
- **Content-Security-Policy** rigorosa em todas as páginas
- Sanitização de dados contra **XSS**
- Guard de autenticação que protege funções contra bypass via DevTools

### 🔄 Tempo Real
- **WebSocket Realtime** do Supabase para atualizações instantâneas
- **Polling a cada 5 segundos** como fallback confiável
- Sincronização entre todos os módulos: quando o admin muda o status, cliente e entregador veem em tempo real

### 📱 Design Responsivo
- **Mobile-first**: módulo cliente otimizado para celular
- **Bottom navigation** para fácil acesso com uma mão
- **Gesto de swipe** para fechar gaveta de checkout
- **Adaptação para desktop**: entregador e admin têm layouts expandidos

### 🔐 Persistência do Carrinho
- Carrinho é salvo automaticamente antes do login
- Após login/cadastro, o carrinho é restaurado — o cliente **não perde os itens** ao se autenticar

---

## Jornadas do Usuário

### 🧑‍🍳 Jornada do Cliente: "Pedir uma Pizza"

**Persona:** Lucas, 28 anos, quer pedir jantar para casa

1. **Abre o site** no celular
2. **Modal de CEP** pergunta seu endereço → digita CEP "01310-000"
3. Sistema informa: *"Entregamos na sua região! Aprox. 3km — 25-40min — Frete R$ 7,00"*
4. Modal fecha e ele vê o **cardápio completo**
5. Filtra pela categoria **"Pizzas"**
6. Clica no card da **Pizza Margherita** (R$ 45,00)
7. Modal abre com opcionais: adiciona **Borda de Cheddar** (+ R$ 5,00)
8. Clica em "Adicionar" — item vai pro carrinho, barra flutuante aparece
9. Adiciona uma **Coca-Cola 2L** (R$ 10,00)
10. Clica na **barra do carrinho** → gaveta de checkout abre
11. Como não está logado, sistema redireciona para **tela de login**
12. Clica em **"Criar uma conta"**
13. Preenche nome, telefone, email e senha
14. Clica em "Cadastrar e Finalizar" — volta pro checkout
15. **Etapa 1**: confirma nome e telefone (já preenchidos) → "Continuar"
16. **Etapa 2**: confirma endereço (já preenchido pelo CEP) → "Continuar"
17. **Etapa 3**: seleciona "Dinheiro", informa troco para R$ 60,00, escreve "Sem cebola" → "Continuar"
18. **Etapa 4**: revisa tudo — itens, endereço, pagamento, tempo estimado (40-55min), total R$ 60,00
19. Clica **"Confirmar Pedido"** → pedido é criado com número **#1042**
20. **Tracking** abre automaticamente: *"Aguardando confirmação do restaurante..."*
21. Após 2 minutos, status muda: *"🍳 Seu pedido está sendo preparado!"* — timeline avança
22. Após 15 minutos: *"🛵 Saiu para entrega!"* — nome do entregador aparece: **João**
23. Após 25 minutos: *"🏍️ Entregador a caminho!"*
24. Após 30 minutos: *"📍 Entregador chegou!"*
25. **Pedido entregue!** 🎉 Lucas recebe e curte sua pizza

---

### 👨‍🍳 Jornada do Administrador: "Gerenciando o Movimento"

**Persona:** Carla, 35 anos, gerente do SaborExpress

1. **Abre o painel** administrativo e faz login
2. Vê a **Fila de Pedidos** com 5 pedidos ativos
3. Card mais antigo: **#1037 — Pedido Pendente** há 3 minutos
4. Clica **"Aceitar"** → status muda para "Preparando", timer começa a contar
5. Se o pedido estiver com problema, clica **"Recusar"** e digita o motivo
6. Vai até a cozinha, prepara o pedido
7. Volta e clica **"Pronto para Entrega"** no card do #1037
8. Aba **"Dashboard"** para ver métricas: R$ 2.450,00 de faturamento no dia, 28 pedidos, ticket médio R$ 87,50
9. Vai em **"Produtos"** para criar uma **Promoção de Burguer Duplo Cheddar**:
   - Nome, preço R$ 32,90, categoria "Burguer", upload de imagem, descrição, adicionais (Bacon + R$ 4,00)
   - Clica "Cadastrar Produto"
10. Vai em **"Configurações"**:
    - Altera o raio de entrega para 12km
    - Aumenta o tempo de preparo para 25 minutos
    - Adiciona um novo usuário: "Pedro" como "Chef"
11. Vai em **"Entregadores"** e cadastra um novo: "Carlos" com email e senha
12. Recebe notificação de **novo pedido** (#1042) em tempo real

---

### 🛵 Jornada do Entregador: "Realizando Entregas"

**Persona:** João, 30 anos, entregador

1. **Abre o Driver App** no celular
2. Faz login com email e senha
3. Dashboard mostra: **3 entregas disponíveis** (badge pulsando)
4. Vê card da **#1042 — Pronto para Entrega**
   - Endereço: Av. Paulista, 1000
   - Itens: Pizza Margherita, Coca-Cola
   - Frete: R$ 7,00
5. Clica **"Coletar & Iniciar Rota"** 🚀
   - Sistema verifica: João não tem outra entrega em andamento → permite
6. Vai até a cozinha, pega o pedido
7. Card agora mostra: **"Em Trânsito"** com botão **"Cheguei ao Destino"**
8. Chega no endereço do cliente
9. Clica **"Cheguei ao Destino"** → timer de 5 minutos começa
10. Se o cliente não aparecer, timer avisa: *"TOLERÂNCIA EXCEDIDA!"*
11. Cliente atende → clica **"Confirmar Entrega"** ✅
12. Entrega concluída! Frete de R$ 7,00 adicionado ao extrato
13. Aba **"Financeiro"**:
    - Hoje: R$ 35,00 (5 entregas)
    - Semana: R$ 180,00
    - Mês: R$ 720,00
14. Vai em **"Perfil"**: atualiza telefone e altera foto

---

### 🔄 Jornada Completa: "Pedido em Ciclo Fechado"

Este é o fluxo completo de UM pedido passando por todos os módulos:

```
CLIENTE                           ADMIN                 ENTREGADOR
───────                           ─────                 ──────────
1. Navega no cardápio
2. Adiciona itens ao carrinho
3. Faz cadastro/login
4. Preenche endereço e pagamento
5. CONFIRMA PEDIDO (#1042) ───>  6. Vê pedido na fila
                                    (card amarelo "Pendente")
                                 7. ACEITA o pedido ──>    
                                 8. Cozinha prepara
                                 9. MARCA "Pronto" ──>  10. Vê entrega disponível
                                                          (badge notifica)
                                                        11. COLETA o pedido
                                                        12. Sai para entrega
    ┌────────────────────────── < 13. "Em Trânsito"
    │ (timeline atualiza)
    │
    │ ──────────────────────────> 14. "Em Trânsito" ──> 15. Chega no local
    │                                                    16. CONFIRMA ENTREGA
    ├───────────────────────────  17. Vê "Entregue" ──> 18. Frete no extrato
    │                              (resumo atualiza)    
    │
    ▼
19. Tracking mostra "ENTREGUE! 🎉"
20. Histórico registra pedido concluído
21. Pode avaliar e pedir de novo!
```

---

*Documentação gerada em 18/07/2026 baseada na análise completa do código-fonte do SaborExpress V2.*
