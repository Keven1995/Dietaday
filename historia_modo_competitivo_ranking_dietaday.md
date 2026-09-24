# História de Usuário --- Modo Competitivo e Ranking

## 1. Contexto

O Dietaday permite que usuários criem uma dieta, compartilhem o período
com outros participantes, registrem refeições e acompanhem a hidratação.

Para aumentar o engajamento do grupo de forma opcional, será criado um
**Modo Competitivo**, no qual os participantes acumulam pontos por ações
realizadas durante o período da dieta e acompanham sua classificação em
um ranking.

A funcionalidade deve ser opcional e configurada no momento da criação
da dieta. Dietas não competitivas devem continuar funcionando exatamente
como atualmente.

------------------------------------------------------------------------

## 2. História de Usuário

**Como** criador de uma dieta,\
**quero** decidir se o grupo terá um modo competitivo,\
**para que** os participantes possam acumular pontos por consistência
nos registros e acompanhar sua posição em um ranking durante o período
da dieta.

**Como** participante de uma dieta competitiva,\
**quero** visualizar minha pontuação e minha posição no ranking,\
**para que** eu acompanhe minha participação no desafio e tenha um
incentivo adicional para manter meus registros.

------------------------------------------------------------------------

## 3. Configuração do Modo Competitivo

Durante a criação da dieta, deverá existir a opção:

> **🏆 Modo competitivo**\
> Transforme os registros do grupo em uma competição amigável baseada na
> consistência.

Opções:

-   **Sim:** ativa o sistema de pontuação e ranking para aquela dieta.
-   **Não:** cria a dieta normalmente, sem ranking, pontuação ou
    elementos competitivos.

### Regra

A configuração pertence à **dieta/grupo**, e não ao usuário individual.

Exemplo conceitual:

``` java
Diet {
    UUID id;
    String name;
    boolean competitiveMode;
}
```

O frontend utiliza a configuração para decidir quais componentes devem
ser exibidos, mas a regra deve ser validada também pelo backend.

O backend não deverá gerar pontuação quando:

``` text
competitiveMode = false
```

------------------------------------------------------------------------

## 4. Sistema de Pontuação

Quando o modo competitivo estiver ativo, os participantes poderão
receber pontos pelas seguintes ações:

  -----------------------------------------------------------------------
  Ação                                                          Pontuação
  ------------------------------ ----------------------------------------
  Registrar uma refeição válida                                 +5 pontos

  Registrar um check válido de                                  +2 pontos
  hidratação                     

  Editar um registro existente                                  +0 pontos

  Excluir um registro antes do          Remove a pontuação correspondente
  fechamento diário              

  Registro duplicado/inválido                                   +0 pontos
  -----------------------------------------------------------------------

### 4.1 Refeições

Cada nova refeição válida registrada pelo participante vale:

``` text
+5 pontos
```

Editar uma refeição já existente não gera novos pontos.

Deve existir um **limite diário de refeições pontuáveis**, evitando que
registros artificiais sejam criados somente para acumular pontos.

O limite deverá ser configurado/definido pela regra de negócio antes da
implementação final.

### 4.2 Hidratação

Cada check válido de hidratação vale:

``` text
+2 pontos
```

Somente checks realizados **até atingir a meta diária de hidratação do
usuário** deverão ser elegíveis para pontuação.

Checks adicionais após a meta diária não devem gerar pontos.

Essa regra evita a criação de vários registros pequenos exclusivamente
para acumular pontuação.

------------------------------------------------------------------------

## 5. Pontuação Pendente e Ranking Oficial

Os eventos pontuáveis devem ser registrados normalmente durante o dia.

Exemplo:

``` text
07:32  Café da manhã     +5
10:14  Hidratação        +2
12:35  Almoço            +5
15:02  Hidratação        +2
```

Entretanto, o **ranking oficial não será reorganizado a cada registro**.

Durante o dia, o usuário poderá visualizar quantos pontos acumulou para
o próximo fechamento.

Exemplo:

``` text
Hoje você conquistou +14 pontos.
O ranking será atualizado às 23:59.
```

------------------------------------------------------------------------

## 6. Fechamento Diário

O ranking deverá ser atualizado diariamente às:

``` text
23:59 — America/Sao_Paulo
```

O horário de referência será o horário oficial de Brasília.

No fechamento:

1.  Buscar os eventos elegíveis do dia.
2.  Validar refeições e checks de hidratação.
3.  Desconsiderar registros excluídos, duplicados ou não elegíveis.
4.  Calcular a pontuação diária de cada participante.
5.  Consolidar a pontuação acumulada.
6.  Gerar um snapshot do ranking daquele dia.
7.  Atualizar a classificação oficial dos participantes.

Fluxo:

``` text
Registros do dia
       ↓
Validação
       ↓
Cálculo dos pontos
       ↓
Snapshot diário
       ↓
Pontuação acumulada
       ↓
Atualização do ranking
```

O cálculo não deve depender exclusivamente do job das 23:59 para
descobrir os registros. Os eventos necessários para o cálculo devem
estar persistidos e ser auditáveis.

------------------------------------------------------------------------

## 7. Ranking Inicial

Ao criar uma dieta competitiva:

-   todos os participantes iniciam com **0 pontos**;
-   enquanto todos estiverem empatados com 0 pontos, a ordem deverá ser
    aleatória;
-   após o primeiro fechamento diário, a classificação seguirá a
    pontuação acumulada e os critérios de desempate.

Exemplo:

``` text
🏆 Ranking

1. Lucas       0 pts
2. Keven       0 pts
3. Maria       0 pts
4. João        0 pts
```

------------------------------------------------------------------------

## 8. Critérios de Desempate

Quando dois ou mais participantes possuírem a mesma pontuação:

1.  Maior quantidade de dias ativos no período.
2.  Persistindo o empate, fica à frente quem atingiu a pontuação atual
    primeiro.

Os critérios devem ser calculados no backend para garantir uma
classificação consistente entre todos os clientes.

------------------------------------------------------------------------

## 9. Widget Flutuante

Quando a dieta ativa possuir:

``` text
competitiveMode = true
```

a página inicial deverá exibir um **widget flutuante de ranking**.

O componente deverá ficar acima da barra de navegação inferior,
preferencialmente no canto direito, sem adicionar um novo item à barra
de acesso rápido.

### Estado compacto

Exemplo:

``` text
╭──────────╮
│ 🏆  2º   │
╰──────────╯
```

### Estado com pontuação pendente

Durante o dia:

``` text
╭──────────────╮
│ 🏆 2º  +17   │
╰──────────────╯
```

Onde:

-   `2º` representa a posição oficial atual;
-   `+17` representa os pontos elegíveis acumulados desde o último
    fechamento.

Ao tocar no widget, o usuário deverá ser direcionado para:

``` text
/ranking
```

O widget não deverá ser exibido em dietas não competitivas.

------------------------------------------------------------------------

## 10. Página de Ranking

A página deverá apresentar:

-   nome da dieta/desafio;
-   período da dieta;
-   posição de cada participante;
-   nome/avatar do participante;
-   pontuação acumulada;
-   posição do usuário atual em destaque;
-   pontos acumulados no dia aguardando fechamento;
-   detalhamento da origem dos pontos do usuário;
-   Top 3 em destaque quando aplicável.

Exemplo:

``` text
🏆 DESAFIO • ALLANA
Termina em 32 dias

          🥇
         Lucas
        184 pts

    🥈             🥉
   Keven           Allan
  172 pts         158 pts

──────── CLASSIFICAÇÃO ────────

4. João                       142
5. Maria                      126
6. Pedro                      118

──────── SUA PONTUAÇÃO ────────

🍽 Refeições
18 × 5 pts                    +90

💧 Hidratação
31 × 2 pts                    +62

Total                         152
```

------------------------------------------------------------------------

## 11. Atualização de Posição

Quando o fechamento diário alterar a posição do usuário, a interface
poderá apresentar uma microinteração.

Exemplo:

``` text
🎉 Você subiu para o 1º lugar!
```

O widget também poderá indicar a variação:

``` text
🏆 1º ↑1
```

A animação deve ser breve e não bloquear a navegação.

------------------------------------------------------------------------

## 12. Encerramento da Dieta

Ao atingir a data final da dieta:

-   novos registros não devem alterar o resultado do desafio;
-   o ranking deverá ser congelado;
-   a classificação final deverá permanecer disponível para consulta;
-   os três primeiros colocados receberão destaque especial.

### Pódio

``` text
       🏆
 DESAFIO FINALIZADO

      ALLANA

        🥇
       Lucas
      486 pts

  🥈              🥉
 Keven            João
451 pts          398 pts
```

Medalhas:

-   🥇 1º colocado --- ouro
-   🥈 2º colocado --- prata
-   🥉 3º colocado --- bronze

Também poderá ser exibido um resumo coletivo do período:

``` text
🍽 312 refeições registradas
💧 486 checks de hidratação
🔥 49 dias de desafio
```

------------------------------------------------------------------------

## 13. Compartilhamento do Resultado

Após o encerramento, a página poderá disponibilizar:

``` text
Compartilhar resultado
```

A ação poderá gerar uma imagem própria para compartilhamento em
WhatsApp, Instagram ou outras plataformas, contendo:

-   nome do desafio;
-   período;
-   Top 3;
-   pontuação;
-   resumo do grupo;
-   identidade visual do Dietaday.

Esta parte pode ser implementada em uma evolução posterior da
funcionalidade.

------------------------------------------------------------------------

## 14. Regras de Segurança e Integridade

A pontuação nunca deverá ser calculada ou validada exclusivamente pelo
frontend.

O backend deverá ser responsável por:

-   verificar se a dieta possui modo competitivo ativo;
-   validar se o participante pertence à dieta;
-   validar se o registro é elegível;
-   impedir pontuação duplicada;
-   controlar limites diários;
-   recalcular/remover pontos quando necessário;
-   aplicar critérios de desempate;
-   realizar o fechamento diário;
-   congelar o ranking ao final da dieta.

Chamadas manipuladas diretamente à API não devem permitir que o usuário
atribua pontos a si mesmo.

------------------------------------------------------------------------

## 15. Auditoria da Pontuação

Cada pontuação deverá possuir origem rastreável.

Exemplo conceitual:

``` text
RankingPointEvent

id
dietId
userId
sourceType
sourceId
points
eventDate
status
createdAt
```

Exemplos de `sourceType`:

``` text
MEAL
WATER_CHECK
```

O uso de `sourceId` deverá impedir que o mesmo registro seja pontuado
mais de uma vez.

Essa estrutura também permitirá recalcular o ranking caso seja
necessário corrigir alguma inconsistência.

------------------------------------------------------------------------

## 16. Experiência para Dietas Não Competitivas

Para:

``` text
competitiveMode = false
```

o comportamento atual do Dietaday deverá ser preservado.

Não deverão aparecer:

-   widget de ranking;
-   página/atalho competitivo;
-   pontuação;
-   classificação;
-   medalhas;
-   mensagens competitivas.

O modo competitivo deve ser uma camada opcional e não uma dependência
dos fluxos atuais.

------------------------------------------------------------------------

## 17. Critérios de Aceite

-   [ ] Na criação da dieta existe a opção **Modo competitivo:
    Sim/Não**.
-   [ ] O valor escolhido é persistido no backend.
-   [ ] Uma dieta não competitiva mantém o comportamento atual.
-   [ ] Uma dieta competitiva habilita o sistema de ranking.
-   [ ] Nova refeição elegível gera **+5 pontos**.
-   [ ] Novo check de hidratação elegível gera **+2 pontos**.
-   [ ] Editar um registro não gera pontuação adicional.
-   [ ] Excluir um registro antes do fechamento remove sua
    elegibilidade/pontuação.
-   [ ] O mesmo registro não pode pontuar duas vezes.
-   [ ] Existe limite de refeições pontuáveis por dia.
-   [ ] Hidratação somente pontua até a meta diária.
-   [ ] Pontos acumulados durante o dia podem ser apresentados como
    pendentes.
-   [ ] O ranking oficial é atualizado às **23:59 no fuso
    `America/Sao_Paulo`**.
-   [ ] Todos começam com 0 pontos.
-   [ ] Com todos em 0 pontos, a ordem inicial é aleatória.
-   [ ] O ranking aplica os critérios de desempate definidos.
-   [ ] Dietas competitivas exibem widget flutuante na Home.
-   [ ] O widget não interfere na barra inferior.
-   [ ] Tocar no widget abre a página de ranking.
-   [ ] O usuário atual aparece destacado no ranking.
-   [ ] Ao final da dieta, o ranking é congelado.
-   [ ] O Top 3 final recebe 🥇, 🥈 e 🥉.
-   [ ] O backend é a fonte de verdade para pontuação e classificação.
-   [ ] Os eventos de pontuação possuem origem rastreável.

------------------------------------------------------------------------

## 18. Fora do Escopo Inicial

Podem ser tratados em histórias futuras:

-   compartilhamento do pódio como imagem;
-   conquistas/badges individuais;
-   histórico visual de posições no ranking;
-   gráfico de evolução dos participantes;
-   notificações push informando mudança de posição;
-   temporadas;
-   personalização dos valores de pontuação pelo criador;
-   diferentes modalidades de competição;
-   recompensas por sequência de dias.

------------------------------------------------------------------------

## 19. Resumo da Regra

``` text
Dieta criada
    │
    ├── Modo competitivo = NÃO
    │       └── Fluxo atual do Dietaday
    │
    └── Modo competitivo = SIM
            │
            ├── Refeição válida      +5
            ├── Hidratação válida    +2
            │
            ├── Pontos pendentes durante o dia
            │
            └── 23:59 America/Sao_Paulo
                    │
                    ├── valida eventos
                    ├── consolida pontos
                    ├── gera snapshot
                    └── atualiza ranking
                            │
                            └── fim da dieta
                                  ├── congela ranking
                                  └── 🥇 🥈 🥉
```
