# Container List

## 1. assistente
- Status: running
- Stack: assistente-pessoal
- Image: nginx:latest
- Created: 2026-07-12 15:31:45
- IP Address: 172.22.0.2
- Published Ports: 8089:80
- Ownership: administrators

---

## 2. delivery-wl
- Status: running
- Stack: white-label
- Image: nginx:latest
- Created: 2026-07-05 13:45:04
- IP Address: 172.24.0.2
- Published Ports: 8085:80
- Ownership: administrators

---

## 3. grupopadrao-evolution-api
- Status: running
- Stack: stack-padrao
- Image: evoapicloud/evolution-api:v2.3.7
- Created: 2026-07-12 15:12:10
- IP Address: 172.18.0.5
- Published Ports: 8080:8080
- Ownership: administrators

---

## 4. grupopadrao-n8n
- Status: running
- Stack: stack-padrao
- Image: docker.n8n.io/n8nio/n8n:latest
- Created: 2026-07-12 15:04:19
- IP Address: 172.18.0.4
- Published Ports: 5678:5678
- Ownership: administrators

---

## 5. grupopadrao-postgres
- Status: healthy
- Stack: stack-padrao
- Image: postgres:16
- Created: 2026-07-18 17:07:05
- IP Address: 172.18.0.3
- Published Ports: 5432:5432
- Ownership: administrators

---

## 6. grupopadrao-redis
- Status: running
- Stack: stack-padrao
- Image: redis:latest
- Created: 2026-07-12 15:04:19
- IP Address: 172.18.0.2
- Published Ports: 6379:6379
- Ownership: administrators

---

## 7. nginx-proxy-app-1
- Status: running
- Stack: nginx-proxy
- Image: jc21/nginx-proxy-manager:latest
- Created: 2026-07-12 15:43:07
- IP Address: 172.19.0.2
- Published Ports:
  - 443:443
  - 80:80
  - 81:81
- Ownership: administrators

---

## 8. palazzo-admin-1
- Status: running
- Stack: palazzo
- Image: palazzo-admin
- Created: 2026-07-19 23:54:01
- IP Address: -
- Published Ports: -
- Ownership: administrators

---

## 9. palazzo-backend-1
- Status: unhealthy
- Stack: palazzo
- Image: palazzo-backend
- Created: 2026-07-19 23:54:00
- IP Address: 172.23.0.2
- Published Ports: 8090:3001
- Ownership: administrators

---

## 10. palazzo-cliente-1
- Status: running
- Stack: palazzo
- Image: palazzo-cliente
- Created: 2026-07-19 23:54:01
- IP Address: -
- Published Ports: -
- Ownership: administrators

---

## 11. palazzo-entregador-1
- Status: running
- Stack: palazzo
- Image: palazzo-entregador
- Created: 2026-07-19 23:54:01
- IP Address: -
- Published Ports: -
- Ownership: administrators

---

## 12. portainer
- Status: running
- Stack: -
- Image: portainer/portainer-ce:lts
- Created: 2026-04-06 13:34:38
- IP Address: 172.17.0.2
- Published Ports:
  - 9000:9000
  - 9443:9443
- Ownership: administrators