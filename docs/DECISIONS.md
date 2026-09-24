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

## Modo competitivo

O modo competitivo é uma configuração definida na criação da dieta e não pode ser alterado depois. Isso evita que o significado histórico de uma dieta mude após o início de registros e pontuações.

Uma dieta competitiva reconhece somente seis tipos oficiais de refeição: Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar e Ceia. Cada tipo pode gerar no máximo uma pontuação por usuário e dia, com valor fixo de 5 pontos.

Checks competitivos de hidratação pertencem explicitamente a uma dieta. Cada check elegível vale 2 pontos e somente o volume restante até a meta diária pode gerar pontuação. Dietas não competitivas continuam usando o fluxo de hidratação existente, sem gerar eventos competitivos.

O dia competitivo usa o fuso `America/Sao_Paulo`. Eventos são registrados de forma auditável e idempotente, mas o ranking oficial só é alterado no fechamento diário. Eventos ainda não liquidados são exibidos separadamente como pontos pendentes.

Após o encerramento da dieta, novos eventos e alterações de registros competitivos são bloqueados. O ranking final permanece consultável e imutável.

## Módulo de competição

O módulo competitivo permanece dentro do monólito, no pacote `com.dietapp.ranking`. Controllers expõem HTTP, services coordenam casos de uso, policies concentram regras de elegibilidade, repositories executam consultas e entidades representam eventos e snapshots.

Regras de refeição e hidratação podem chamar o serviço de eventos para registrar uma ocorrência, mas não calculam ranking nem aceitam pontos enviados pelo cliente. O ranking consulta dados persistidos de fechamento, e não o estado visual do frontend.
