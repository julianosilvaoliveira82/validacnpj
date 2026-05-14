import assert from "node:assert/strict";
import test from "node:test";

import {
  lookupCnpj,
  mergeCnpjData,
  normalizePublicaCnpj,
  normalizeReceitaWs
} from "../worker.js";

const receitaFixture = {
  status: "OK",
  cnpj: "34.745.112/0001-93",
  nome: "FORTCLEAN RECEITA",
  fantasia: "FORT RECEITA",
  tipo: "MATRIZ",
  porte: "MICRO EMPRESA",
  natureza_juridica: "206-2 - Sociedade Empresária Limitada",
  abertura: "03/09/2019",
  capital_social: "400000.00",
  situacao: "ATIVA",
  data_situacao: "03/09/2019",
  logradouro: "R RECEITA",
  numero: "272",
  bairro: "TARUMA",
  municipio: "VIAMAO",
  uf: "RS",
  cep: "94.415-375",
  telefone: "(51) 99999-9999",
  email: "receita@example.com",
  atividade_principal: [
    { code: "82.99-7-99", text: "Atividade Receita" }
  ],
  atividades_secundarias: [
    { code: "81.21-4-00", text: "Secundária Receita" }
  ],
  qsa: [
    { nome: "Sócia Receita", qual: "Sócio-Administrador" }
  ],
  simples: {
    optante: true,
    data_opcao: "01/01/2024",
    data_exclusao: "",
    ultima_atualizacao: "2026-04-01T03:00:00.000Z"
  },
  simei: {
    optante: false,
    data_opcao: "",
    data_exclusao: "",
    ultima_atualizacao: "2026-04-01T03:00:00.000Z"
  },
  ultima_atualizacao: "2026-04-01T03:00:00.000Z"
};

const publicaFixture = {
  cnpj_raiz: "34745112",
  razao_social: "FORTCLEAN PUBLICA",
  capital_social: "400000.00",
  atualizado_em: "2026-04-11T03:00:00.000Z",
  porte: { descricao: "Micro Empresa" },
  natureza_juridica: { descricao: "Sociedade Empresária Limitada" },
  socios: [
    {
      nome: "Sócia Pública",
      data_entrada: "2022-03-02",
      atualizado_em: "2026-04-11T03:00:00.000Z",
      qualificacao_socio: { descricao: "Sócio-Administrador" }
    }
  ],
  simples: {
    mei: "Não",
    simples: "Não",
    data_opcao_simples: "2025-01-01",
    data_exclusao_simples: "2025-08-31",
    atualizado_em: "2026-04-11T03:00:00.000Z"
  },
  estabelecimento: {
    cnpj: "34745112000193",
    tipo: "Matriz",
    nome_fantasia: "FORT PUBLICA",
    situacao_cadastral: "Ativa",
    data_situacao_cadastral: "2019-09-03",
    data_inicio_atividade: "2019-09-03",
    tipo_logradouro: "RUA",
    logradouro: "PUBLICA",
    numero: "272",
    bairro: "TARUMA",
    cep: "94415375",
    ddd1: "51",
    telefone1: "99357975",
    email: "publica@example.com",
    atualizado_em: "2026-05-09T03:00:00.000Z",
    atividade_principal: {
      subclasse: "8299-7/99",
      descricao: "Atividade Pública"
    },
    atividades_secundarias: [
      {
        subclasse: "8121-4/00",
        descricao: "Secundária Pública"
      }
    ],
    estado: { nome: "Rio Grande do Sul", sigla: "RS" },
    cidade: { nome: "Viamão" },
    inscricoes_estaduais: [
      {
        inscricao_estadual: "1590254020",
        ativo: true,
        atualizado_em: "2026-05-09T00:00:00.000Z",
        estado: { nome: "Rio Grande do Sul", sigla: "RS" }
      },
      {
        inscricao_estadual: "9999999999",
        ativo: false,
        atualizado_em: "2026-04-01T00:00:00.000Z",
        estado: { nome: "Rio Grande do Sul", sigla: "RS" }
      }
    ]
  }
};

test("usa CNPJ.ws quando o bloco está mais atual", () => {
  const merged = mergeCnpjData(
    normalizeReceitaWs(receitaFixture),
    normalizePublicaCnpj(publicaFixture)
  );

  assert.equal(merged.nome, "FORTCLEAN PUBLICA");
  assert.equal(merged.logradouro, "RUA PUBLICA");
  assert.equal(merged._fontes.blocos.empresa.fonte, "CNPJ.ws");
  assert.equal(merged._fontes.blocos.estabelecimento.fonte, "CNPJ.ws");
});

test("usa ReceitaWS quando o bloco está mais atual", () => {
  const receitaMaisNova = {
    ...receitaFixture,
    nome: "FORTCLEAN RECEITA NOVA",
    logradouro: "R RECEITA NOVA",
    ultima_atualizacao: "2026-06-01T03:00:00.000Z"
  };

  const merged = mergeCnpjData(
    normalizeReceitaWs(receitaMaisNova),
    normalizePublicaCnpj(publicaFixture)
  );

  assert.equal(merged.nome, "FORTCLEAN RECEITA NOVA");
  assert.equal(merged.logradouro, "R RECEITA NOVA");
  assert.equal(merged._fontes.blocos.empresa.fonte, "ReceitaWS");
  assert.equal(merged._fontes.blocos.estabelecimento.fonte, "ReceitaWS");
});

test("preenche lacunas da fonte escolhida com a outra fonte", () => {
  const publicaSemEmail = structuredClone(publicaFixture);
  publicaSemEmail.estabelecimento.email = "";

  const merged = mergeCnpjData(
    normalizeReceitaWs(receitaFixture),
    normalizePublicaCnpj(publicaSemEmail)
  );

  assert.equal(merged.email, "receita@example.com");
  assert.equal(merged.logradouro, "RUA PUBLICA");
});

test("normaliza inscrições estaduais ativas e inativas", () => {
  const normalized = normalizePublicaCnpj(publicaFixture);

  assert.equal(normalized.inscricoes_estaduais.length, 2);
  assert.deepEqual(normalized.inscricoes_estaduais[0], {
    inscricao_estadual: "1590254020",
    ativo: true,
    atualizado_em: "09/05/2026",
    uf: "RS",
    estado: "Rio Grande do Sul"
  });
  assert.equal(normalized.inscricoes_estaduais[1].ativo, false);
});

test("aceita falha parcial e registra aviso da fonte indisponível", async () => {
  const fakeFetch = async (endpoint) => {
    if (String(endpoint).includes("receitaws")) {
      return new Response(JSON.stringify({ message: "limite excedido" }), { status: 429 });
    }

    return new Response(JSON.stringify(publicaFixture), { status: 200 });
  };

  const data = await lookupCnpj("34745112000193", {}, fakeFetch);

  assert.equal(data.status, "OK");
  assert.equal(data._fontes.receitaws.status, "erro");
  assert.match(data._fontes.avisos[0], /limite excedido/);
  assert.equal(data.nome, "FORTCLEAN PUBLICA");
});

test("falha quando nenhuma fonte retorna dados válidos", async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ message: "indisponível" }), { status: 500 });

  await assert.rejects(
    () => lookupCnpj("34745112000193", {}, fakeFetch),
    /Nenhuma fonte retornou dados válidos/
  );
});
