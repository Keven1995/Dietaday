# Arquitetura

O Dietaday é uma aplicação web/PWA em produção, organizada como um monólito modular no backend e uma SPA React no frontend.

## Visão geral

```text
Usuário
  |
  v
React + TypeScript + PWA (Vercel)
  |
  | REST/JSON + JWT
  v
Spring Boot (Render)
  |
  +--> PostgreSQL
  +--> Cloudinary
  +--> Web Push
```

## Frontend

- React e TypeScript.
- Vite para desenvolvimento e build.
- React Router para navegação.
- PWA com Service Worker.
- IndexedDB para a fila offline de refeições.
- Cache de recursos para renderização rápida e atualização em segundo plano.
- Contextos para autenticação, dietas, sincronização offline e hidratação.

## Backend

- Java 17 e Spring Boot.
- API REST protegida por Spring Security e JWT.
- JPA/Hibernate para persistência.
- Flyway para migrations versionadas.
- Organização por módulos de negócio, como `auth`, `diet`, `meal`, `comment`, `notification`, `water` e `upload`.
- Cada módulo separa controllers, serviços, repositórios, entidades e DTOs quando necessário.

## Fluxos importantes

### Refeições offline

1. A refeição é armazenada localmente quando necessário.
2. A fila controla tentativas, leases e backoff.
3. Fotos são enviadas ao Cloudinary por upload assinado.
4. A refeição é sincronizada com a API usando `operationId` para idempotência.
5. Eventos técnicos de sincronização são enviados para telemetria privada.

### Hidratação

1. O frontend carrega a meta e os checks do dia.
2. A meta e os registros são persistidos no PostgreSQL.
3. O cache local permite renderização imediata do último estado conhecido.
4. A API continua sendo a fonte oficial e atualiza o estado em segundo plano.

### Lembretes push

1. O navegador registra uma inscrição Web Push autenticada.
2. O backend armazena as inscrições por usuário e dispositivo.
3. Um scheduler executa nos horários definidos usando `America/Sao_Paulo`.
4. O envio usa VAPID e registra sucesso ou falha sem expor credenciais.

## Limites arquiteturais

O sistema não é composto por microserviços. A escolha atual é um monólito modular, adequado ao tamanho e ao estágio do produto, com integrações externas isoladas nos módulos correspondentes.
