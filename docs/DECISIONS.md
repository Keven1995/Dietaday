# Decisões Técnicas

## Monólito modular

O backend usa um único serviço Spring Boot organizado por módulos de negócio. Isso mantém o deploy e a operação simples sem abrir mão da separação entre domínios.

## PWA em vez de aplicativo nativo

O PWA permite instalação no celular, atualização centralizada e acesso multiplataforma com uma única base de frontend.

## Sincronização offline

Refeições podem ser registradas sem conexão porque a rotina alimentar não deve depender de disponibilidade contínua da rede. A fila local usa tentativas, backoff e idempotência para evitar duplicidades.

## PostgreSQL como fonte oficial

O navegador pode manter dados temporários e cacheados para melhorar a experiência, mas o backend e o PostgreSQL são a fonte oficial após a sincronização.

## Valores de hidratação em mililitros

Metas e checks são persistidos em mililitros para evitar imprecisão de ponto flutuante. A interface converte os valores para litros apenas na apresentação.

## Notificações Web Push

Web Push foi escolhido para enviar lembretes sem exigir um aplicativo nativo separado. As inscrições são associadas ao usuário e podem existir em vários dispositivos.

## Migrations versionadas

Alterações de banco são feitas com Flyway. Migrations já aplicadas não devem ser editadas; correções devem ser adicionadas em uma nova versão.
