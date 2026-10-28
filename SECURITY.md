# Segurança

Este documento descreve as proteções atuais do Dietaday, os principais riscos conhecidos e o plano recomendado de evolução da segurança.

O Dietaday trata dados pessoais e registros de alimentação, hidratação, fotos e interações sociais. A segurança deve ser aplicada em camadas: frontend, API, módulos de negócio, persistência, integrações externas e operação da infraestrutura.

## Escopo E Arquitetura

O backend é um monólito modular Spring Boot. Os módulos são organizados por domínio, como `auth`, `user`, `diet`, `meal`, `comment`, `notification`, `water`, `upload` e `telemetry`.

Essa arquitetura pode seguir boas práticas sem ser transformada em microserviços:

- O filtro de autenticação fica centralizado em `security`.
- Cada módulo valida autorização dentro do seu próprio serviço.
- Controllers lidam com HTTP e DTOs, sem concentrar regras de negócio.
- Services aplicam regras de domínio e verificam o usuário atual.
- Repositories encapsulam o acesso ao PostgreSQL.
- Integrações externas ficam isoladas em módulos próprios, como `upload` e `water`.
- Migrations Flyway controlam mudanças estruturais do banco.
- Logs e telemetria não devem conter segredos ou dados pessoais desnecessários.

O limite de segurança deve acompanhar o limite do domínio. Por exemplo, `DietService` valida pertencimento e papel na dieta, enquanto `MealService` valida autoria e acesso à dieta. Um controller não deve consultar entidades de outro usuário diretamente.

## Proteções Atuais

- Senhas armazenadas com BCrypt.
- Autenticação stateless usando JWT assinado.
- Endpoints protegidos por Spring Security.
- CORS baseado em origens configuradas.
- Autorização por usuário, dieta, papel e autoria.
- Validação de DTOs com Bean Validation.
- Queries JPA parametrizadas.
- Idempotência para sincronização de refeições.
- Upload de fotos iniciado por assinatura gerada no backend.
- Migrations versionadas com Flyway.
- `ddl-auto: validate` no Hibernate.
- Telemetria autenticada e sanitizada.
- Assinaturas VAPID mantidas no backend.
- Endpoint de teste de push desativado por padrão.
- React escapa conteúdo textual por padrão e o frontend não utiliza `dangerouslySetInnerHTML`.

## Riscos E Prioridades

### P0: Imediato

#### Remover o fallback do JWT

O Render já possui `JWT_SECRET` configurado, portanto o risco está mitigado no ambiente de produção atual. Porém, o arquivo de configuração ainda possui um valor padrão conhecido.

O comportamento recomendado é falhar o startup se `JWT_SECRET` estiver ausente ou fraco:

```yaml
app:
  jwt:
    secret: ${JWT_SECRET}
```

O segredo deve ser aleatório, ter pelo menos 32 bytes e nunca aparecer no código, logs, frontend ou documentação pública.

#### Proteger segredos de produção

Manter exclusivamente no provedor de backend:

- `JWT_SECRET`.
- `DATABASE_URL`.
- `DATABASE_USERNAME`.
- `DATABASE_PASSWORD`.
- `CLOUDINARY_API_SECRET`.
- `VAPID_PRIVATE_KEY`.

`APP_PUSH_TEST_ENABLED` deve permanecer `false` em produção.

#### Adicionar rate limiting

Foi implementado um rate limiting inicial em memória, ativado por padrão. Ele protege por IP os endpoints abaixo e retorna HTTP 429 quando o limite da janela de um minuto é excedido:

- Cadastro: 30 requisições por minuto.
- Login: 20 requisições por minuto.
- Assinatura de upload: 30 requisições por minuto.
- Inscrição de push: 60 requisições por minuto.
- Telemetria: 120 requisições por minuto.
- Teste de push: 2 requisições por minuto.

O controle em memória é adequado para uma única instância. Se o backend passar a ter múltiplas instâncias, o store deve ser migrado para Redis ou para o mecanismo equivalente do provedor.

Aplicar limites por IP e, quando possível, por conta nos seguintes endpoints:

- Login.
- Cadastro.
- Upload e geração de assinatura.
- Inscrição de Web Push.
- Telemetria.
- Endpoint de teste de push.

O rate limiting pode ser implementado inicialmente no próprio monólito, por exemplo com um filtro Spring Security e um store Redis ou solução equivalente. Em produção, o rate limiting também pode ser aplicado no provedor de borda.

#### Proteger contra brute force

O login agora bloqueia a combinação de e-mail e endereço de origem após cinco falhas dentro de uma janela de 15 minutos. O bloqueio dura 15 minutos e é removido após um login bem-sucedido, evitando o bloqueio remoto da conta por um terceiro.

- Limitar tentativas de login por IP e e-mail.
- Aplicar espera progressiva após falhas consecutivas.
- Considerar CAPTCHA após comportamento anormal.
- Não retornar mensagens que revelem se um e-mail existe em fluxos públicos de autenticação.

### P1: Alta

#### Reduzir risco de roubo de sessão

O access token agora permanece somente em memória no frontend. O refresh token é opaco, rotativo, armazenado somente como cookie `HttpOnly`, `Secure` em produção e `SameSite=None` para o frontend hospedado separadamente da API.

Controles implementados:

- Access token mantido em memória, com validade padrão de 30 minutos, e renovado automaticamente após HTTP 401.
- Refresh token persistido somente como hash no banco.
- Rotação do refresh token a cada renovação.
- Logout revoga o refresh token atual.
- Endpoints de refresh/logout exigem o header CSRF `X-Requested-With: Dietaday`.

Próximas evoluções possíveis:

- Access token curto, entre 15 e 30 minutos.
- Revogação global de todas as sessões do usuário.
- Limpeza agendada de refresh tokens expirados.

Se a autenticação migrar para cookies, a proteção CSRF deverá ser reativada e configurada explicitamente.

#### Adicionar headers de segurança

Configurar no Spring Security e/ou na Vercel:

- Content Security Policy.
- HSTS em produção HTTPS.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy` restritiva.
- `Permissions-Policy` mínima.
- `X-Frame-Options: DENY` ou `frame-ancestors` na CSP.

A CSP deve incluir somente os domínios necessários da Vercel, API, Cloudinary e Web Push.

#### Fortalecer uploads

O backend deve aceitar somente URLs geradas pelo Cloudinary e deve validar:

- HTTPS obrigatório.
- Hostname permitido.
- Tipo MIME de imagem.
- Tamanho máximo.
- Extensão e conteúdo coerentes.

Os limites do frontend não são suficientes como controle de segurança. O Cloudinary também deve possuir limites de formato, tamanho e transformação.

#### Auditar dependências

Configurar no repositório:

- Dependabot ou Renovate.
- `npm audit` em CI.
- OWASP Dependency Check ou ferramenta equivalente para Maven.
- Secret scanning.
- Atualização periódica do Java, Spring Boot, Node.js e dependências de Web Push.

#### Testar autorização negativa

Os testes devem confirmar que:

- Um usuário não acessa refeições de uma dieta da qual não participa.
- Um membro não altera configurações exclusivas do proprietário.
- Um usuário não altera comentário de outra pessoa.
- Um usuário não responde à convite de outra conta.
- Um token inválido, expirado ou adulterado é rejeitado.
- Uma inscrição de push não pode ser alterada por outro usuário.
- URLs de refeições não permitem acesso indireto a dados de outra conta.

### P2: Média

#### Auditoria E Alertas

Foi implementado um serviço central de auditoria com eventos estruturados para autenticação, perfil, dietas, membros, uploads e push. Os eventos usam IDs técnicos e tipos de erro sanitizados, sem receber ou registrar payloads.

- Login bem-sucedido, falho e bloqueado.
- Logout.
- Alteração de perfil.
- Criação e exclusão de dietas.
- Convites, aceites, recusas, saída e transferência de proprietário.
- Falhas de upload e push.
- Limpeza agendada de refresh tokens expirados.

Registrar eventos de segurança sem armazenar segredos:

- Muitas tentativas de login falhas.
- Alteração de perfil.
- Alteração de senha.
- Criação e exclusão de dietas.
- Alterações de membros.
- Falhas repetidas de push.
- Uso anormal de upload.

Os logs devem conter identificadores técnicos, horário e resultado, mas não devem conter JWTs, senhas, chaves VAPID, URLs privadas ou conteúdo de refeições.

#### Privacidade E Retenção

Definir e documentar:

- Quais dados pessoais são armazenados.
- Por quanto tempo refeições, fotos e telemetria permanecem guardadas.
- Como o usuário solicita exclusão da conta.
- Como fotos são removidas do Cloudinary.
- Como backups do Neon são protegidos e restaurados.

#### Autenticação Adicional

Como evolução do produto:

- Verificação de e-mail.
- Recuperação de senha.
- Logout de todos os dispositivos.
- Autenticação em dois fatores.

#### Segurança Do Container

No Dockerfile de produção:

- Executar o processo com usuário não-root.
- Usar imagem base atualizada.
- Reduzir permissões do filesystem.
- Definir limites de memória e CPU.
- Escanear a imagem antes do deploy.

#### Proteção Contra Abuso De Dados

- Paginar refeições, comentários e notificações.
- Limitar o volume máximo de itens por resposta.
- Definir limite global de tamanho de request.
- Evitar consultas sem filtro que possam retornar grandes volumes.
- Monitorar crescimento anormal por usuário.

## Possíveis Cenários De Ataque

### Token JWT roubado

Um atacante que obtenha o token pode chamar endpoints protegidos até sua expiração. O impacto inclui acesso aos dados permitidos para aquele usuário, como perfil, refeições, dietas e fotos.

Controles: reduzir validade, usar refresh token seguro, CSP, proteção XSS, logout global e monitoramento de uso anormal.

### Brute force de senha

Um atacante pode automatizar tentativas contra `/api/auth/login`.

Controles: rate limiting, espera progressiva, CAPTCHA adaptativo e alertas.

### Abuso de upload

Um usuário autenticado pode tentar gerar muitas assinaturas ou enviar arquivos fora do fluxo esperado para aumentar custo ou armazenar conteúdo indevido.

Controles: rate limiting, validação server-side, limites no Cloudinary, validação de host e auditoria.

### Enumeração de contas

Mensagens diferentes para e-mails cadastrados e não cadastrados podem permitir descobrir usuários existentes.

Controles: respostas genéricas em fluxos públicos e limitação de requisições.

### Acesso indevido entre dietas

Um atacante pode tentar trocar UUIDs na URL para acessar dados de outra dieta.

Controles: toda operação deve passar por uma verificação de associação ou autoria dentro do service do módulo. UUID não é mecanismo de autorização.

### Vazamento de configuração

Um segredo exposto no Git, log ou frontend pode permitir falsificação de JWT, acesso ao banco, alteração de fotos ou envio de push.

Controles: variáveis no Render, secret scanning, rotação e revisão de logs.

## Checklist Antes De Publicar

- `JWT_SECRET` configurado e forte no Render.
- `APP_PUSH_TEST_ENABLED=false`.
- Nenhum segredo em arquivos versionados.
- `FRONTEND_URL` limitado aos domínios reais.
- `VITE_*` sem segredos privados.
- Migrations testadas em banco limpo.
- Testes backend aprovados.
- Testes frontend aprovados.
- Build frontend aprovado.
- Rate limiting ativo.
- Headers de segurança verificados.
- Logs sem tokens ou dados sensíveis.
- Health check respondendo corretamente.
- Backup do banco confirmado.

## Modelo De Evolução No Monólito

As medidas devem ser incorporadas sem criar complexidade prematura:

1. `security` centraliza autenticação, headers, rate limiting e políticas comuns.
2. Cada módulo de domínio mantém suas próprias regras de autorização.
3. `upload` valida e encapsula Cloudinary.
4. `water` mantém Web Push e regras de hidratação separadas.
5. `common` concentra tratamento de erros, validações compartilhadas e correlação de logs.
6. Testes de integração validam as fronteiras entre segurança e domínio.
7. A infraestrutura externa fornece banco, armazenamento, deploy e observabilidade, mas não substitui a autorização do backend.

O objetivo é manter um monólito modular com fronteiras claras, menor superfície de ataque e capacidade de evolução futura sem antecipar uma migração para microserviços.
