# 🚀 SaborExpress V2 — Setup Spec

> **Data:** 18/07/2026
> **Versão:** 1.0
> **Objetivo:** Documentar como rodar a aplicação em desenvolvimento local e deploy remoto via Portainer

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                  Nginx Proxy Manager                 │
│  (SSL, roteamento por subdomínio, proxy reverso)    │
├────────────┬────────────┬────────────┬──────────────┤
│  cliente   │   admin    │ entregador │     api      │
│  .dominio  │  .dominio  │  .dominio  │  .dominio    │
│  :8081     │  :8082     │  :8083     │  :3001       │
├────────────┴────────────┴────────────┴──────────────┤
│              Docker Host (Portainer)                 │
│        4 containers rodando em paralelo              │
├─────────────────────────────────────────────────────┤
│             PostgreSQL 16 (remoto)                   │
│            86.48.18.22:5432/delivery                 │
└─────────────────────────────────────────────────────┘
```

### 1.1 Containers Docker

| Container | Imagem | Porta | Função |
|-----------|--------|-------|--------|
| `saborexpress-backend` | Express API | `3001` | API REST + WebSocket |
| `saborexpress-cliente` | nginx:alpine | `8081` | SPA Vue 3 (Cardápio) |
| `saborexpress-admin` | nginx:alpine | `8082` | SPA Vue 3 (Admin) |
| `saborexpress-entregador` | nginx:alpine | `8083` | SPA Vue 3 (Driver) |

### 1.2 Tecnologias

- **Backend:** Node.js 22 + Express 4 + Socket.IO + PostgreSQL 16
- **Frontend:** Vue 3 + Vite 5 + Pinia + Vue Router 4
- **Proxy:** Nginx (multi-stage build) + Nginx Proxy Manager
- **Deploy:** Docker + Portainer
- **Auth:** JWT (access + refresh tokens em httpOnly cookies)
- **Realtime:** Socket.IO (WebSocket com fallback polling)

---

## 2. Desenvolvimento Local

### 2.1 Pré-requisitos

- Node.js v22+ e npm 10+
- Acesso ao PostgreSQL 16 em `86.48.18.22:5432`
- Git
- 4 terminais (ou terminal com abas)

### 2.2 Configuração Inicial (uma vez)

```bash
# 1. Clone o repositório
git clone <repo-url>
cd V2

# 2. Configure as variáveis de ambiente do backend
cp backend/.env.example backend/.env
# Editar backend/.env se necessário (padrão já funciona para dev)

# 3. Instale dependências do backend
cd backend
npm install
npm run migrate
npm run seed
cd ..

# 4. Instale dependências dos frontends
cd cliente && npm install && cd ..
cd admin && npm install && cd ..
cd entregador && npm install && cd ..
```

### 2.3 Iniciar Servidores (4 terminais)

| Terminal | Comando | Acesso |
|----------|---------|--------|
| **Backend** | `cd backend && npm run dev` | `http://localhost:3001` |
| **Cliente** | `cd cliente && npm run dev` | `http://localhost:5173` |
| **Admin** | `cd admin && npm run dev` | `http://localhost:5174` |
| **Entregador** | `cd entregador && npm run dev` | `http://localhost:5175` |

### 2.4 Credenciais de Teste

| Tipo | E-mail | Senha |
|------|--------|-------|
| Admin | admin@saborexpress.com | admin123 |
| Cliente | maria@email.com | cliente123 |
| Entregador | (criar via admin) | — |

### 2.5 Testar se está funcionando

```bash
# Health check do backend
curl http://localhost:3001/api/health
# Deve retornar: {"status":"healthy","database":{"alive":true},...}

# Listar produtos
curl http://localhost:3001/api/produtos/com-extras | head -c 300

# Login admin
curl -X POST http://localhost:3001/api/auth/restaurante/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saborexpress.com","password":"admin123"}'
```

### 2.6 Fluxo de Teste Completo (E2E)

```bash
cd backend
node src/e2e-test.js
```

Este script automatiza o fluxo completo:
1. Login cliente → Criar pedido
2. Login admin → Aceitar → Marcar como pronto
3. Criar entregador → Login → Coletar → Entregar
4. Verificar timeline completa

---

## 3. Deploy Remoto (Portainer)

### 3.1 Pré-requisitos do Servidor

- **Docker** v24+ e Docker Compose v2+ instalados
- **Portainer** rodando (gerenciamento dos containers)
- **Nginx Proxy Manager** configurado com os 4 subdomínios
- Acesso ao banco PostgreSQL remoto (86.48.18.22:5432)
- Git instalado para clonar o repositório

### 3.2 Subdomínios no Nginx Proxy Manager

| Subdomínio | Porta do Container | Descrição |
|-----------|-------------------|-----------|
| `cliente.saborexpress.com` | `8081` | Cardápio Digital |
| `admin.saborexpress.com` | `8082` | Painel Administrativo |
| `entregador.saborexpress.com` | `8083` | Driver App |
| `api.saborexpress.com` | `3001` | Backend API |

**Configuração no Nginx Proxy Manager (para cada subdomínio):**
- **Scheme:** `http`
- **Forward IP:** IP do servidor Docker
- **Forward Port:** conforme tabela acima
- **SSL:** Let's Encrypt (ou certificado existente)
- **WebSocket Support:** `ativado` (necessário para Socket.IO)

### 3.3 Preparar o Servidor

```bash
# 1. Acessar o servidor via SSH
ssh usuario@seu-servidor

# 2. Clonar o repositório
git clone <repo-url> /opt/saborexpress
cd /opt/saborexpress

# 3. Criar arquivo .env com as configurações de produção
cat > .env << EOF
JWT_SECRET=<chave-segura-aleatoria-de-32+caracteres>
DB_HOST=86.48.18.22
DB_PORT=5432
DB_NAME=delivery
DB_USER=default
DB_PASS=default
RESTAURANT_ID=1
EOF
```

> ⚠️ **Importante:** Gerar um `JWT_SECRET` forte para produção. Use:
> ```bash
> openssl rand -base64 32
> ```

### 3.4 Deploy via Portainer Stack

1. Acessar Portainer → **Stacks** → **Add stack**
2. Nome: `saborexpress`
3. Build method: **Git Repository**
   - Repository URL: `<repo-url>`
   - Branch: `main`
   - Compose path: `docker-compose.yml`
4. Enviroment variables:
   - `DB_HOST`: `86.48.18.22`
   - `DB_PORT`: `5432`
   - `DB_NAME`: `delivery`
   - `DB_USER`: `default`
   - `DB_PASS`: `default`
   - `JWT_SECRET`: `<sua-chave-secreta>`
   - `RESTAURANT_ID`: `1`
5. **Deploy the stack**

### 3.5 Alternativa: Deploy via Docker Compose (CLI)

```bash
# No servidor, dentro do diretório do projeto
docker compose pull
docker compose up -d --build

# Verificar se todos os containers subiram
docker compose ps

# Ver logs
docker compose logs -f

# Se precisar rebuildar um container específico
docker compose up -d --build backend
```

### 3.6 Pós-Deploy

```bash
# 1. Verificar health check
curl http://localhost:3001/api/health

# 2. Verificar se os frontends estão servindo
curl http://localhost:8081/ | head -c 100   # Cliente
curl http://localhost:8082/ | head -c 100   # Admin
curl http://localhost:8083/ | head -c 100   # Entregador

# 3. Testar login via API
curl -X POST http://localhost:3001/api/auth/restaurante/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saborexpress.com","password":"admin123"}'

# 4. Configurar Nginx Proxy Manager (ver seção 3.2)

# 5. Acessar pelos domínios:
#    https://admin.seusite.com
#    https://cliente.seusite.com
#    https://entregador.seusite.com
```

---

## 4. Variáveis de Ambiente

### 4.1 Arquivo `.env` (produção)

| Variável | Obrigatório | Padrão | Descrição |
|----------|------------|--------|-----------|
| `DB_HOST` | ✅ | `86.48.18.22` | Host do PostgreSQL |
| `DB_PORT` | ✅ | `5432` | Porta do PostgreSQL |
| `DB_NAME` | ✅ | `delivery` | Nome do database |
| `DB_USER` | ✅ | `default` | Usuário do banco |
| `DB_PASS` | ✅ | `default` | Senha do banco |
| `JWT_SECRET` | ✅ | — | Chave secreta JWT (32+ caracteres) |
| `RESTAURANT_ID` | ✅ | `1` | ID do restaurante (multi-tenant) |
| `CORS_ORIGIN` | ⚠️ | URLs dos subdomínios | Origens permitidas no CORS |
| `NODE_ENV` | ⚠️ | `production` | Modo de execução |

### 4.2 Multi-tenant

Para adicionar outro restaurante:
1. Inserir novo registro na tabela `restaurantes`
2. Copiar/duplicar o stack no Portainer
3. Alterar `RESTAURANT_ID` para o ID do novo restaurante
4. Configurar novos subdomínios no Nginx Proxy Manager

---

## 5. Estrutura do Projeto

```
V2/
├── backend/              # API Express (Node.js 22)
│   ├── src/
│   │   ├── config/       # Database, env vars
│   │   ├── middleware/    # Auth, error handler
│   │   ├── modules/      # Auth, produtos, pedidos, etc.
│   │   └── services/     # CEP, frete, realtime
│   ├── migrations/       # SQL migrations
│   ├── Dockerfile
│   └── package.json
│
├── cliente/              # SPA Vue 3 (Cardápio)
│   ├── src/
│   │   ├── components/   # Checkout, CEP modal
│   │   ├── views/        # Home, Pedidos, Perfil, Auth
│   │   ├── stores/       # Pinia auth store
│   │   └── services/     # API client, Socket.IO
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vite.config.js
│
├── admin/                # SPA Vue 3 (Painel Admin)
│   ├── src/views/        # Orders, Produtos, Dashboard, etc.
│   ├── Dockerfile
│   └── nginx.conf
│
├── entregador/           # SPA Vue 3 (Driver App)
│   ├── src/              # Entregas, Financeiro, Perfil
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml    # Orchestration
├── .gitignore
└── README.md
```

---

## 6. Comandos Úteis

### 6.1 Desenvolvimento Local

```bash
# Backend com reload automático
cd backend && npm run dev

# Frontends
cd cliente && npm run dev   # http://localhost:5173
cd admin && npm run dev     # http://localhost:5174
cd entregador && npm run dev # http://localhost:5175
```

### 6.2 Docker (produção)

```bash
# Build e start
docker compose up -d --build

# Logs
docker compose logs -f
docker compose logs -f backend

# Parar tudo
docker compose down

# Reiniciar serviço específico
docker compose restart backend

# Acessar container
docker exec -it saborexpress-backend sh

# Executar comando no container
docker exec saborexpress-backend node src/migrate.js
```

### 6.3 Manutenção do Banco

```bash
# Migrations (se necessário atualizar)
cd backend
npm run migrate

# Seed (dados iniciais)
npm run seed
```

---

## 7. Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| `EADDRINUSE` na porta 3001 | Processo antigo rodando | `netstat -ano \| findstr :3001` e matar o PID |
| `ECONNREFUSED` no banco | PostgreSQL inacessível | Verificar firewall e credenciais no `.env` |
| Socket.IO não conecta | WebSocket não configurado | Ativar **WebSocket Support** no Nginx Proxy Manager |
| CORS bloqueando requisições | `CORS_ORIGIN` incompleto | Adicionar domínios no `.env` e rebuildar |
| Login admin negado | `cargo` vs `role` no JWT | Admin deve ter `cargo: admin` no banco |
| 404 no `/com-extras` | Rota antiga em cache | Matar processo node e reiniciar servidor |

---

## 8. Roadmap Pós-Deploy

- [ ] Testar cada módulo pelos subdomínios
- [ ] Verificar WebSocket em tempo real entre os 3 módulos
- [ ] Testar fluxo completo: criar pedido → aceitar → entregar
- [ ] Configurar volumes persistentes no Portainer
- [ ] Backup do banco PostgreSQL
- [ ] Configurar monitoramento (Portainer logs)
- [ ] Definir política de atualização (git pull → rebuild)
