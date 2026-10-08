# LOTO15 — V16.2 produção preparada

Esta versão mantém a interface V17 aprovada e acrescenta persistência PostgreSQL opcional, mantendo `data.json` apenas como fallback local de desenvolvimento.

## Fluxo comercial
1. Cliente escolhe LOTO15, Mega-Sena ou Quina.
2. Escolhe 1 ou 5 jogos.
3. Informa e-mail.
4. O servidor cria o pedido e o PIX.
5. Mercado Pago confirma por webhook/consulta segura.
6. Somente com status `PAID` o servidor gera e libera os jogos.
7. Se Resend estiver configurado, os jogos são enviados por e-mail.

## Banco
Em produção, defina `DATABASE_URL` e `REQUIRE_POSTGRES=true`. O servidor cria as tabelas automaticamente; `schema.sql` também está incluído para provisionamento manual.

Variáveis principais:
- `DATABASE_URL`
- `DATABASE_SSL=true`
- `REQUIRE_POSTGRES=true`
- `MP_ACCESS_TOKEN`
- `MP_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL=https://loto15.com.br`
- `ADMIN_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`

## Teste local
Sem `DATABASE_URL`, o app usa `data.json` para desenvolvimento. Não usar esse modo para operação comercial de alta disponibilidade.

## Segurança
- token de acesso por pedido armazenado como hash
- idempotência persistente
- rate limit
- expiração de pedidos
- assinatura de webhook
- headers de segurança
- geração no servidor
- segredos somente em variáveis de ambiente

## Motor matemático
A pontuação é um mecanismo de seleção/organização. Não representa aumento garantido de probabilidade nem promessa de prêmio.


## 16.0 — validação de pagamento
A confirmação em produção usa a Orders API do Mercado Pago: a order é considerada paga quando `status=processed` e `status_detail=accredited`. O webhook aceita notificações do tópico `orders` usando `data.id` como order ID e também mantém compatibilidade com payment ID.


## Correção 16.0
- O app deve ser aberto por HTTP/HTTPS através do servidor, não como arquivo `content://`/`file://`. Abrir o HTML diretamente no celular não fornece as APIs `/api/*` e causa `Failed to fetch`.
- A verificação de pagamento agora consulta o endpoint de liberação, que também atualiza o status do Mercado Pago quando configurado.
- Pix do Mercado Pago usa expiração de 30 minutos, alinhada ao TTL interno do pedido.
- QR Code Pix pode ser exibido diretamente quando o provedor retornar `qr_code_base64`.
- Geração de jogos tem trava em processo para evitar duplicação por requisições simultâneas.


## 16.1 — acabamento de produção
- Busca de pedido por identificador de pagamento otimizada no PostgreSQL para webhooks.
- Rate limit aplicado às rotas de API, sem bloquear a navegação dos arquivos públicos.
- Páginas de termos e privacidade não dependem de arquivo CSS inexistente.
- Versão de health check atualizada para 16.2.0.

## Publicação
O arquivo HTML não deve ser aberto diretamente como `file://` ou `content://`. Em produção, publique o projeto em HTTPS e defina as variáveis de ambiente do Render/host. O Mercado Pago documenta atualmente a criação de Pix via `/v1/orders`, com `X-Idempotency-Key`, `external_reference`, `processing_mode` e `expiration_time`; a documentação também recomenda Webhooks e consulta da order por `/v1/orders/{id}` para obter o estado atualizado.
