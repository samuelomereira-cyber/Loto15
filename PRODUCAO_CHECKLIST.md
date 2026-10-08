# LOTO15 — checklist final de publicação

## Código
- [x] Interface visual aprovada mantida
- [x] LOTO15 / Mega-Sena / Quina
- [x] 1 ou 5 jogos
- [x] Pedido com idempotência
- [x] Geração somente após pagamento confirmado
- [x] Token de acesso armazenado como hash
- [x] PostgreSQL preparado e obrigatório em produção
- [x] Webhook Mercado Pago com HMAC
- [x] Consulta da Order API para confirmação
- [x] Pix com validade de 30 minutos
- [x] Resend preparado para entrega por e-mail
- [x] Admin protegido por chave
- [x] Rate limit nas APIs
- [x] Headers de segurança
- [x] Health check
- [x] Páginas de Termos e Privacidade

## Teste local executado
- GET /api/health: OK
- POST /api/orders: OK
- POST /api/sandbox/confirm: OK
- POST /api/reveal: OK
- Geração de 1 jogo LOTO15: OK

## Falta para produção real
1. Criar/conectar serviço Render.
2. Criar PostgreSQL e definir DATABASE_URL.
3. Configurar domínio `loto15.com.br` e HTTPS.
4. Configurar credencial produtiva do Mercado Pago.
5. Configurar segredo do Webhook `orders` no Mercado Pago.
6. Configurar Resend e `EMAIL_FROM`.
7. Fazer compra/teste oficial do Mercado Pago antes de abrir ao público.
8. Revisar juridicamente Termos/Privacidade e informações comerciais.
9. Fazer backup inicial e validar logs/monitoramento.
