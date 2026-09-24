# Plano de Implementacao: Modo Competitivo

Este documento quebra a historia `historia_modo_competitivo_ranking_dietaday.md`
em tarefas pequenas e verificaveis para o backend e o frontend.

## Decisoes aprovadas

- O modo competitivo e configurado na criacao da dieta.
- O campo `competitiveMode` e imutavel depois da criacao.
- Existem seis tipos oficiais de refeicao pontuavel:
  - Cafe da manha
  - Lanche da manha
  - Almoco
  - Lanche da tarde
  - Jantar
  - Ceia
- Cada tipo de refeicao pode pontuar no maximo uma vez por usuario em cada dia.
- Uma refeicao valida vale `+5` pontos.
- Um check de hidratacao valido vale `+2` pontos.
- Checks competitivos pertencem a uma dieta.
- Checks so pontuam ate a meta diaria de hidratacao.
- O fechamento ocorre as `23:59`, no fuso `America/Sao_Paulo`.
- Depois da data final, ficam bloqueadas criacao, edicao e exclusao de refeicoes.
- Depois da data final, ficam bloqueados novos checks e alteracoes de hidratacao da competicao.
- O ranking oficial e atualizado somente no fechamento diario.
- Dietas nao competitivas preservam o comportamento atual.
- O backend e a fonte de verdade para elegibilidade, pontuacao e ranking.

## Regras de engenharia

- Cada tarefa deve comecar com pelo menos um teste que expresse o comportamento esperado.
- Regras de negocio devem ficar em servicos ou politicas testaveis, nao em controllers.
- Controllers devem cuidar apenas de HTTP, validacao de entrada e autorizacao de rota.
- Repositories devem cuidar apenas de persistencia e consultas.
- O modulo competitivo deve ser isolado dos modulos de refeicao e hidratacao por interfaces ou servicos de aplicacao.
- Pontuacao deve ser idempotente e auditavel.
- Nenhuma pontuacao deve ser aceita por valor enviado pelo frontend.
- Alteracoes devem ser pequenas e compilaveis sempre que possivel.

## Fase 0: contrato e preparacao

### COMP-001: Registrar decisoes de negocio

- Criar um ADR em `docs/DECISIONS.md` ou documento separado.
- Registrar limite de seis tipos, imutabilidade, hidratacao por dieta e congelamento.
- Definir o que significa "dia" usando `America/Sao_Paulo`.

Teste:

- Revisao do contrato antes da primeira migration.

### COMP-002: Definir contratos da API

- Definir o formato de `DietResponse` com `competitiveMode`.
- Definir o formato do ranking oficial.
- Definir o formato de pontos pendentes.
- Definir o formato do detalhamento de pontos do usuario.
- Definir como o ranking congelado sera representado.

Teste:

- Criar exemplos JSON documentados em `docs/API.md`.

### COMP-003: Criar modulo de competicao

- Criar o pacote `com.dietapp.ranking` ou `com.dietapp.competition`.
- Separar entidades, repositories, politicas, servicos, DTOs e controllers.
- Evitar que controllers de refeicao e hidratacao conhecam detalhes de ranking.

Teste:

- O projeto deve compilar sem alterar o comportamento atual.

## Fase 1: configuracao da dieta

### COMP-004: Persistir `competitive_mode`

- Criar migration Flyway para adicionar `competitive_mode` com default `false`.
- Atualizar a entidade `Diet`.
- Atualizar construtor, getter e resposta.
- Garantir compatibilidade com dietas existentes.

Testes:

- Migration aplicada em H2 e PostgreSQL.
- Dietas antigas carregam como nao competitivas.

### COMP-005: Aceitar modo competitivo somente na criacao

- Adicionar `competitiveMode` ao `DietRequest` de criacao.
- Persistir o valor no `POST /api/diets`.
- Rejeitar tentativa de alterar o valor no `PUT /api/diets/{dietId}`.
- Manter autorizacao exclusiva do proprietario.

Testes:

- Criar dieta competitiva.
- Criar dieta nao competitiva sem alterar o comportamento anterior.
- Tentar alterar o modo depois da criacao e esperar `400` ou `409`.

### COMP-006: Atualizar o fluxo de criacao no frontend

- Adicionar checkbox ou radio acessivel no modal de `Diets`.
- Usar `false` como valor inicial.
- Atualizar tipos, modo demo e estado de criacao.
- Exibir o estado da dieta sem permitir sua alteracao posterior.


- Payload contem `competitiveMode`.
- Modal funciona com modo ativado e desativado.
- Dietas nao competitivas nao exibem elementos competitivos.

## Fase 2: modelo auditavel de pontuacao

### COMP-007: Criar eventos de pontuacao

- Criar migration para `ranking_point_events`.
- Campos minimos:
  - `id`
  - `diet_id`
  - `user_id`
  - `source_type`
  - `source_id`
  - `points`
  - `event_date`
  - `status`
  - `created_at`
  - `settled_at`
- Criar chave unica para impedir pontuacao duplicada por origem.
- Criar indices por dieta, usuario e data.

Testes:

- Migration valida no H2.
- Duplicidade da mesma origem e rejeitada pelo banco.
- Evento nao pode apontar para usuario fora da dieta.

### COMP-008: Implementar servico de eventos

- Criar `PointEventService`.
- Criar metodos para registrar, revogar e consultar eventos.
- Tornar o registro idempotente.
- Nao aceitar pontos enviados pelo cliente.
- Registrar auditoria das alteracoes relevantes.


- Mesmo evento processado duas vezes gera uma unica pontuacao.
- Evento de dieta nao competitiva nao e criado.
- Usuario que nao pertence a dieta nao pontua.

## Fase 3: pontuacao de refeicoes

### COMP-009: Formalizar os seis tipos de refeicao

- Criar enum ou politica de tipos oficiais no backend.
- Validar os seis valores aceitos no backend.
- Manter os textos atuais exibidos pelo frontend.
- Rejeitar tipos arbitrarios usados para gerar pontos.


- Os seis tipos sao aceitos.
- Tipo desconhecido e rejeitado.
- Dietas nao competitivas preservam a validacao atual definida pelo produto.

### COMP-010: Criar politica de refeicao pontuavel

- Criar `MealScoringPolicy`.
- Validar dieta competitiva.
- Validar membro e autor da refeicao.
- Validar data dentro do periodo da dieta.
- Validar que o tipo ainda nao foi pontuado naquele dia.
- Gerar `+5` sem permitir entrada de pontuacao pelo frontend.


- Refeicao valida cria evento de `5` pontos.
- Segunda refeicao do mesmo tipo no mesmo dia nao pontua.
- Tipos diferentes podem pontuar no mesmo dia.
- Refeicao fora do periodo nao pontua e e rejeitada conforme o contrato.

### COMP-011: Integrar criacao offline e idempotencia

- Integrar pontuacao somente depois da refeicao persistir com sucesso.
- Reutilizar `Idempotency-Key` existente.
- Garantir que retry offline nao duplique refeicao nem pontuacao.


- Retry com a mesma chave nao duplica evento.
- Falha na persistencia nao deixa evento de pontuacao valido.
- Refeicao criada em dieta nao competitiva nao cria evento.

### COMP-012: Bloquear alteracoes no encerramento

- Criar uma politica central de periodo da dieta.
- Bloquear criacao, edicao e exclusao de refeicoes apos `endDate`.
- Aplicar a regra no backend, independentemente da data enviada pelo frontend.


- Criacao no ultimo dia e permitida dentro da regra de horario definida.
- Criacao apos `endDate` e rejeitada.
- Edicao apos `endDate` e rejeitada.
- Exclusao apos `endDate` e rejeitada.

## Fase 4: hidratacao por dieta

### COMP-013: Associar checks competitivos a dieta

- Criar migration para adicionar `diet_id` em `water_checks`.
- Manter dados antigos compativeis quando `diet_id` for nulo.
- Criar indice por dieta, usuario e data.
- Definir contrato dos endpoints competitivos com `dietId`.


- Check competitivo exige dieta valida.
- Check nao pode ser salvo para usuario que nao pertence a dieta.
- Dados antigos continuam carregando no fluxo nao competitivo.

### COMP-014: Criar politica de hidratacao pontuavel

- Criar `WaterScoringPolicy`.
- Validar dieta competitiva e periodo.
- Calcular o volume elegivel restante antes de pontuar.
- Aplicar `+2` por check elegivel.
- Nao pontuar volume excedente apos a meta.
- Persistir a referencia da meta usada no fechamento para evitar recalculo ambiguo.


- Check dentro da meta gera `+2`.
- Check que ultrapassa a meta nao gera pontos pelo excedente.
- Checks apos a meta nao pontuam.
- Alteracao de meta nao reescreve eventos ja fechados.

### COMP-015: Bloquear hidratacao no encerramento

- Bloquear novos checks apos `endDate`.
- Bloquear alteracao de meta relacionada a competicao apos `endDate`.
- Bloquear edicao ou exclusao de checks competitivos encerrados.


- Operacoes apos o encerramento retornam erro de negocio.
- O ranking final permanece inalterado.

## Fase 5: fechamento diario

### COMP-016: Criar calculador puro de fechamento

- Criar servico puro que recebe eventos elegiveis e devolve totais.
- Nao acessar HTTP, banco ou relogio diretamente na regra pura.
- Injetar um `Clock` configurado para `America/Sao_Paulo`.


- Eventos validos sao somados.
- Eventos revogados ou invalidos sao ignorados.
- Eventos de dias diferentes ficam separados.
- Calculo e deterministico.

### COMP-017: Persistir fechamento e snapshot diario

- Criar tabelas de totais diarios e snapshots.
- Persistir refeicoes, hidratacao e total por participante.
- Marcar eventos como liquidados.
- Usar transacao unica para consolidacao.


- Fechamento cria exatamente um snapshot por dieta/data.
- Reexecucao nao duplica totais.
- Falha transacional nao deixa fechamento parcial.

### COMP-018: Implementar scheduler idempotente

- Criar job dedicado ao fechamento competitivo.
- Executar no fuso `America/Sao_Paulo`.
- Aplicar lock para impedir processamento concorrente.
- Permitir reprocessamento seguro de um dia especifico.


- Scheduler executa uma vez por dieta/data.
- Duas instancias nao duplicam snapshot.
- Retry apos falha conclui sem duplicidade.

## Fase 6: ranking oficial

### COMP-019: Criar modelo de ranking acumulado

- Criar tabela de pontuacao acumulada por dieta/usuario.
- Criar snapshot de posicao diaria.
- Persistir dias ativos e primeiro alcance da pontuacao.
- Persistir uma ordem aleatoria inicial para empates em zero.


- Todos iniciam com zero.
- Empates em zero mantem ordem persistida.
- Ranking posterior usa os criterios definidos.

### COMP-020: Implementar criterios de desempate

- Ordenar por pontos acumulados desc.
- Desempatar por dias ativos desc.
- Desempatar por primeiro alcance da pontuacao asc.
- Usar ordem inicial persistida enquanto todos estiverem em zero.


- Cada criterio e exercitado isoladamente.
- Resultado e igual em chamadas repetidas.
- Ordem nao depende da ordem retornada pelo banco.

### COMP-021: Congelar a dieta encerrada

- Marcar o ranking como finalizado quando o periodo terminar.
- Preservar consulta do ranking final.
- Impedir novos eventos e alteracoes de registros.
- Gerar classificacao final e podio.


- Ranking final permanece disponivel.
- Nenhuma operacao posterior altera pontos ou posicoes.
- Primeiro, segundo e terceiro colocados sao identificados corretamente.

## Fase 7: API do ranking

### COMP-022: Criar consulta protegida do ranking

- Implementar `GET /api/diets/{dietId}/ranking`.
- Exigir que o usuario seja membro da dieta.
- Rejeitar ou retornar estado vazio para dieta nao competitiva conforme contrato.
- Retornar periodo, status, fechamento, usuario atual e participantes.


- Membro acessa o ranking.
- Nao membro recebe `404` ou `403` conforme padrao atual.
- Dieta nao competitiva nao expoe dados competitivos.
- Ranking final retorna status congelado.

### COMP-023: Adicionar pontos pendentes e detalhamento

- Retornar pontos elegiveis desde o ultimo fechamento.
- Retornar contagem de refeicoes por tipo.
- Retornar contagem de checks elegiveis.
- Retornar origem dos pontos do usuario atual.


- Pontos pendentes nao alteram a posicao oficial.
- Detalhamento soma exatamente o total correspondente.
- Eventos revogados nao aparecem como pontos validos.

### COMP-024: Paginar ranking e eventos

- Aplicar a infraestrutura de paginacao existente.
- Definir ordenacao explicita.
- Aplicar tamanho maximo de resposta.
- Evitar carregar eventos ilimitados no detalhamento.


- Pagina acima do limite e rejeitada.
- Ordenacao se mantem entre paginas.
- Nenhum evento duplicado aparece entre paginas.

## Fase 8: frontend do ranking

### COMP-025: Criar contratos e hook

- Adicionar tipos de ranking em `frontend/src/types.ts`.
- Criar `useRanking` com `AbortController`.
- Invalidar cache ao trocar a dieta ativa.
- Tratar loading, erro, modo demo e estado congelado.


- Hook usa a dieta correta.
- Troca de dieta cancela a consulta anterior.
- Erro e loading sao representados corretamente.

### COMP-026: Criar pagina `/ranking`

- Adicionar rota protegida.
- Exibir nome e periodo da dieta.
- Exibir podio e classificacao.
- Destacar o usuario atual.
- Exibir pontos pendentes e detalhamento.
- Exibir ranking final congelado.


- Pagina renderiza dados oficiais sem recalcular ranking.
- Usuario atual fica destacado.
- Ranking vazio, erro e finalizado possuem estados claros.

### COMP-027: Criar widget flutuante

- Exibir somente com `activeDiet.competitiveMode === true`.
- Mostrar posicao oficial e pontos pendentes.
- Linkar para `/ranking`.
- Posicionar acima da barra inferior no mobile.
- Respeitar safe area e reduced motion.
- Nao cobrir controles essenciais da Home.


- Widget nao aparece em dieta nao competitiva.
- Widget nao aparece sem dieta ativa.
- Clique navega para `/ranking`.
- Conteudo possui nome acessivel.

## Fase 9: seguranca e operacao

### COMP-028: Revisar autorizacao e concorrencia

- Validar membership em todas as operacoes.
- Impedir pontos enviados manualmente pelo cliente.
- Proteger unicos e locks no banco.
- Revisar corrida entre criacao de refeicao e pontuacao.
- Revisar corrida entre fechamento e novas operacoes.


- Requests manipulados nao atribuem pontos.
- Requests concorrentes nao duplicam eventos.
- Usuario de outra dieta nao acessa nem pontua.

### COMP-029: Auditar eventos competitivos

- Registrar criacao, liquidacao, revogacao e fechamento.
- Nao registrar tokens ou dados sensiveis.
- Adicionar metricas de falha e duracao do fechamento.


- Eventos esperados aparecem na auditoria.
- Logs nao contem credenciais ou tokens.

### COMP-030: Atualizar documentacao operacional

- Documentar scheduler e timezone.
- Documentar reprocessamento de fechamento.
- Documentar migrations e rollback operacional.
- Documentar novas variaveis somente se forem necessarias.
- Atualizar `docs/API.md` e `docs/OPERATIONS.md`.

## Ordem de execucao recomendada

1. COMP-001 a COMP-006.
2. COMP-007 e COMP-008.
3. COMP-009 a COMP-012.
4. COMP-013 a COMP-015.
5. COMP-016 a COMP-021.
6. COMP-022 a COMP-024.
7. COMP-025 a COMP-027.
8. COMP-028 a COMP-030.

## Criterio de pronto

- Todas as tarefas possuem testes automatizados relevantes.
- `mvn clean test` passa sem falhas.
- `npm test` passa sem falhas.
- `npm run build` passa sem falhas.
- Dietas nao competitivas nao exibem ranking nem geram eventos.
- Requests fora do periodo sao rejeitados pelo backend.
- O fechamento pode ser repetido sem duplicar pontuacao.
- O ranking final permanece consultavel e imutavel.
- A API esta documentada antes do deploy.
