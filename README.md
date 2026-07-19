# 🍔 SaborExpress V2

Plataforma completa de delivery com 3 módulos integrados.

## 🏗️ Arquitetura

```
saborexpress.com (Nginx Proxy Manager)
├── cliente.saborexpress.com → Container Cliente (Vue 3 SPA)
├── admin.saborexpress.com   → Container Admin (Vue 3 SPA)
├── entregador.saborexpress.com → Container Entregador (Vue 3 SPA)
└── api.saborexpress.com     → Container Backend (Express API)
```

## 🚀 Deploy Rápido (Docker)

### Pré-requisitos
- Docker e Docker Compose instalados
- PostgreSQL 16 acessível (configurado no `.env`)

### 1. Configurar ambiente

```bash
cp backend/.env.example .env
# Editar .env com suas configurações
```

### 2. Executar migrations

```bash
cd backend
npm install
npm run migrate
npm run seed
cd ..
```

### 3. Build e Deploy

```bash
docker compose build
docker compose up -d
```

### 4. Configurar Nginx Proxy Manager

| Subdomínio | Porta | Descrição |
|-----------|-------|-----------|
| `cliente.saborexpress.com` | `8081` | Cardápio Digital |
| `admin.saborexpress.com` | `8082` | Painel Administrativo |
| `entregador.saborexpress.com` | `8083` | Driver App |
| `api.saborexpress.com` | `3001` | Backend API |

## 🔧 Desenvolvimento Local

### Terminal 1: Backend
```bash
cd backend
npm install
npm run migrate
npm run seed
npm run dev
```

### Terminal 2: Cliente
```bash
cd cliente
npm install
npm run dev
```

### Terminal 3: Admin
```bash
cd admin
npm install
npm run dev
```

### Terminal 4: Entregador
```bash
cd entregador
npm install
npm run dev
```

## 🔐 Credenciais Padrão (Seed)

| Tipo | E-mail | Senha |
|------|--------|-------|
| Admin | admin@saborexpress.com | admin123 |
| Cliente | maria@email.com | cliente123 |

## 🏪 Multi-tenant

O `RESTAURANT_ID` no `.env` define qual restaurante esta instância atende.
Para adicionar outro restaurante:
1. Criar registro na tabela `restaurantes`
2. Copiar o projeto
3. Alterar `RESTAURANT_ID` no `.env`
4. Fazer deploy como nova instância

## 🐘 Banco de Dados

Host: `86.48.18.22:5432`  
Database: `delivery`  
Gerenciador: pgAdmin
