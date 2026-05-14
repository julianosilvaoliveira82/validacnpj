# Consulta de CNPJ

Aplicacao standalone para consultar CNPJ. No Worker, a consulta mescla dados da ReceitaWS e da API Publica CNPJ.ws, escolhendo os blocos mais atuais e destacando Simples Nacional, SIMEI/MEI e inscricoes estaduais.

## Abrir sem servidor local

Abra `public/index.html` diretamente no navegador.

Nesse modo:

- o PIN `JULI` e validado no proprio HTML;
- a consulta usa JSONP direto da ReceitaWS;
- o `RECEITAWS_TOKEN` nao e usado, entao valem os limites publicos da ReceitaWS;
- a API Publica CNPJ.ws nao e consultada porque ela nao envia CORS para uso direto no navegador.

## Rodar com Worker local

1. Crie `.dev.vars` a partir do exemplo:

```env
RECEITAWS_TOKEN=seu_token_receitaws
ACCESS_PIN=JULI
```

2. Inicie o Worker local:

```powershell
npm run dev
```

O comando usa `npx wrangler@4.88.0`, abre `http://127.0.0.1:8787` com o HTML de `public/` e a API em `/api/cnpj`.

## API

`GET /api/cnpj?cnpj=34745112000193`

O Worker consulta em paralelo:

- `https://www.receitaws.com.br/v1/cnpj/{cnpj}`;
- `https://publica.cnpj.ws/cnpj/{cnpj}`.

A resposta e normalizada no formato consumido pela tela, com os extras:

- `inscricoes_estaduais`: lista de inscricoes estaduais retornadas pela CNPJ.ws;
- `_fontes`: status das fontes, fonte escolhida por bloco e avisos de fallback.

Se uma fonte falhar, a outra ainda pode gerar o resultado. A API so retorna erro quando nenhuma fonte entrega dados validos.

Para ignorar o cache local e o cache do Worker, use a opcao da tela ou envie `nocache=1`:

```text
/api/cnpj?cnpj=34745112000193&nocache=1
```

## Variaveis

- `RECEITAWS_TOKEN`: token da ReceitaWS. Pode ficar vazio para testes sujeitos ao limite publico da API.
- `ACCESS_PIN`: PIN de entrada. Na producao, configure no painel da Cloudflare em Workers and Pages > validacnpj > Configuracoes > Variaveis e segredos.

A API Publica CNPJ.ws nao usa token neste projeto. Ela possui limite publico baixo, atualmente documentado como 3 requisicoes por minuto por IP, entao o Worker usa cache por CNPJ.

## Testes

```powershell
npm test
npm run check
```

## Deploy

O projeto esta preparado para Cloudflare Workers com assets estaticos:

```powershell
npm run deploy
```

No Cloudflare, mantenha `RECEITAWS_TOKEN` e `ACCESS_PIN` configurados como variaveis/segredos.
