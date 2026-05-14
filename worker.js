const APP_VERSION = "1.3.0";
const FALLBACK_PIN = "JULI";
const WORKER_CACHE_TTL_SECONDS = 60 * 60;

const SOURCE_RECEITAWS = "receitaws";
const SOURCE_CNPJWS = "cnpjws";
const SOURCE_LABELS = {
  [SOURCE_RECEITAWS]: "ReceitaWS",
  [SOURCE_CNPJWS]: "CNPJ.ws"
};

const BLOCK_FIELDS = {
  empresa: ["nome", "porte", "natureza_juridica", "capital_social", "efr"],
  estabelecimento: [
    "cnpj",
    "fantasia",
    "tipo",
    "abertura",
    "situacao",
    "data_situacao",
    "motivo_situacao",
    "situacao_especial",
    "data_situacao_especial",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "municipio",
    "uf",
    "cep",
    "telefone",
    "email",
    "atividade_principal",
    "atividades_secundarias"
  ],
  regimes: ["simples", "simei"],
  qsa: ["qsa"],
  receita_estadual: ["inscricoes_estaduais"]
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseHeaders() });
    }

    if (url.pathname === "/api/auth") {
      const auth = authorize(request, env);
      if (!auth.ok) return auth.response;

      return json({
        status: "OK",
        version: APP_VERSION
      });
    }

    if (url.pathname === "/api/cnpj") {
      const auth = authorize(request, env);
      if (!auth.ok) return auth.response;

      const cnpj = onlyDigits(url.searchParams.get("cnpj") || "");

      if (!cnpjIsValid(cnpj)) {
        return json(
          { status: "ERROR", message: "CNPJ inválido" },
          400
        );
      }

      const bypassCache = cacheBypassRequested(url);

      if (!bypassCache) {
        const cached = await getCachedWorkerResponse(url.origin, cnpj);
        if (cached) {
          return responseWithHeaders(cached, {
            "x-worker-cache": "HIT"
          });
        }
      }

      try {
        const data = await lookupCnpj(cnpj, env);
        const response = json(data, 200, {
          "cache-control": `public, max-age=${WORKER_CACHE_TTL_SECONDS}`,
          "x-worker-cache": bypassCache ? "BYPASS" : "MISS"
        });

        if (!bypassCache) {
          await putCachedWorkerResponse(url.origin, cnpj, response.clone(), ctx);
        }

        return response;
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return json(
          {
            status: "ERROR",
            message: "Erro ao consultar CNPJ nas fontes disponíveis",
            detail,
            fontes: err && typeof err === "object" && "fontes" in err ? err.fontes : undefined
          },
          502
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};

async function lookupCnpj(cnpj, env = {}, fetchImpl = fetch) {
  const token = env.RECEITAWS_TOKEN;

  const [receitaResult, cnpjwsResult] = await Promise.all([
    fetchJsonSource(
      SOURCE_RECEITAWS,
      `https://www.receitaws.com.br/v1/cnpj/${cnpj}`,
      token
        ? {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`
          }
        : {
            "Accept": "application/json"
          },
      fetchImpl
    ),
    fetchJsonSource(
      SOURCE_CNPJWS,
      `https://publica.cnpj.ws/cnpj/${cnpj}`,
      {
        "Accept": "application/json"
      },
      fetchImpl
    )
  ]);

  const receita = receitaResult.ok ? normalizeReceitaWs(receitaResult.data) : null;
  const cnpjws = cnpjwsResult.ok ? normalizePublicaCnpj(cnpjwsResult.data) : null;

  if (!receita && !cnpjws) {
    const error = new Error("Nenhuma fonte retornou dados válidos.");
    error.fontes = {
      receitaws: sourceResultMeta(receitaResult),
      cnpjws: sourceResultMeta(cnpjwsResult)
    };
    throw error;
  }

  return mergeCnpjData(receita, cnpjws, {
    receitaws: sourceResultMeta(receitaResult, receita),
    cnpjws: sourceResultMeta(cnpjwsResult, cnpjws)
  });
}

async function fetchJsonSource(source, endpoint, headers, fetchImpl) {
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      headers
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      return {
        source,
        ok: false,
        status: response.status,
        message: extractMessage(data) || `HTTP ${response.status}`
      };
    }

    if (!data || typeof data !== "object") {
      return {
        source,
        ok: false,
        status: response.status,
        message: "Resposta vazia ou inválida"
      };
    }

    if (source === SOURCE_RECEITAWS && data.status && String(data.status).toUpperCase() !== "OK") {
      return {
        source,
        ok: false,
        status: response.status,
        message: extractMessage(data) || "ReceitaWS retornou erro"
      };
    }

    return {
      source,
      ok: true,
      status: response.status,
      data
    };
  } catch (err) {
    return {
      source,
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : String(err)
    };
  }
}

function normalizeReceitaWs(data) {
  const updatedAt = clean(data?.ultima_atualizacao);

  return cleanObject({
    status: "OK",
    cnpj: onlyDigits(data?.cnpj),
    nome: clean(data?.nome),
    fantasia: clean(data?.fantasia),
    tipo: clean(data?.tipo),
    porte: clean(data?.porte),
    natureza_juridica: clean(data?.natureza_juridica),
    abertura: clean(data?.abertura),
    capital_social: clean(data?.capital_social),
    efr: clean(data?.efr),
    situacao: clean(data?.situacao),
    data_situacao: clean(data?.data_situacao),
    motivo_situacao: clean(data?.motivo_situacao),
    situacao_especial: clean(data?.situacao_especial),
    data_situacao_especial: clean(data?.data_situacao_especial),
    logradouro: clean(data?.logradouro),
    numero: clean(data?.numero),
    complemento: clean(data?.complemento),
    bairro: clean(data?.bairro),
    municipio: clean(data?.municipio),
    uf: clean(data?.uf),
    cep: clean(data?.cep),
    telefone: clean(data?.telefone),
    email: clean(data?.email),
    atividade_principal: normalizeReceitaActivities(data?.atividade_principal),
    atividades_secundarias: normalizeReceitaActivities(data?.atividades_secundarias),
    qsa: normalizeReceitaQsa(data?.qsa),
    simples: normalizeReceitaRegime(data?.simples),
    simei: normalizeReceitaRegime(data?.simei),
    inscricoes_estaduais: [],
    ultima_atualizacao: updatedAt,
    _source: SOURCE_RECEITAWS,
    _sourceDates: {
      empresa: updatedAt,
      estabelecimento: updatedAt,
      regimes: latestDate(
        data?.simples?.ultima_atualizacao,
        data?.simei?.ultima_atualizacao,
        updatedAt
      ),
      qsa: updatedAt,
      receita_estadual: null
    }
  });
}

function normalizePublicaCnpj(data) {
  const est = data?.estabelecimento || {};
  const companyUpdatedAt = clean(data?.atualizado_em);
  const establishmentUpdatedAt = clean(est?.atualizado_em);
  const qsaUpdatedAt = latestDate(...arrayOf(data?.socios).map((socio) => socio?.atualizado_em));
  const stateRegistrations = normalizeStateRegistrations(est?.inscricoes_estaduais);

  return cleanObject({
    status: "OK",
    cnpj: onlyDigits(est?.cnpj),
    nome: clean(data?.razao_social),
    fantasia: clean(est?.nome_fantasia),
    tipo: clean(est?.tipo),
    porte: clean(data?.porte?.descricao),
    natureza_juridica: clean(data?.natureza_juridica?.descricao),
    abertura: formatDateBR(est?.data_inicio_atividade),
    capital_social: clean(data?.capital_social),
    efr: clean(data?.responsavel_federativo),
    situacao: clean(est?.situacao_cadastral),
    data_situacao: formatDateBR(est?.data_situacao_cadastral),
    motivo_situacao: clean(est?.motivo_situacao_cadastral?.descricao),
    situacao_especial: clean(est?.situacao_especial),
    data_situacao_especial: formatDateBR(est?.data_situacao_especial),
    logradouro: joinClean(" ", est?.tipo_logradouro, est?.logradouro),
    numero: clean(est?.numero),
    complemento: clean(est?.complemento),
    bairro: clean(est?.bairro),
    municipio: clean(est?.cidade?.nome),
    uf: clean(est?.estado?.sigla),
    cep: formatCep(est?.cep),
    telefone: joinClean(" / ", formatPhone(est?.ddd1, est?.telefone1), formatPhone(est?.ddd2, est?.telefone2)),
    email: clean(est?.email),
    atividade_principal: normalizePublicaActivities(est?.atividade_principal ? [est.atividade_principal] : []),
    atividades_secundarias: normalizePublicaActivities(est?.atividades_secundarias),
    qsa: normalizePublicaQsa(data?.socios),
    simples: normalizePublicaSimples(data?.simples),
    simei: normalizePublicaSimei(data?.simples),
    inscricoes_estaduais: stateRegistrations,
    ultima_atualizacao: latestDate(companyUpdatedAt, establishmentUpdatedAt, data?.simples?.atualizado_em, qsaUpdatedAt),
    _source: SOURCE_CNPJWS,
    _sourceDates: {
      empresa: companyUpdatedAt,
      estabelecimento: establishmentUpdatedAt,
      regimes: clean(data?.simples?.atualizado_em),
      qsa: qsaUpdatedAt || companyUpdatedAt,
      receita_estadual: latestDate(...stateRegistrations.map((ie) => ie.atualizado_em))
    }
  });
}

function mergeCnpjData(receita, cnpjws, sourceMeta = {}) {
  const merged = {
    status: "OK"
  };

  const fontes = {
    receitaws: sourceMeta.receitaws || sourceResultMeta({ source: SOURCE_RECEITAWS, ok: false, status: 0, message: "Não consultado" }),
    cnpjws: sourceMeta.cnpjws || sourceResultMeta({ source: SOURCE_CNPJWS, ok: false, status: 0, message: "Não consultado" }),
    blocos: {},
    avisos: []
  };

  for (const info of [fontes.receitaws, fontes.cnpjws]) {
    if (info.status === "erro" && info.erro) {
      fontes.avisos.push(`${info.fonte}: ${info.erro}`);
    }
  }

  for (const [block, fields] of Object.entries(BLOCK_FIELDS)) {
    const source = chooseBlockSource(block, receita, cnpjws, fields);
    const primary = source === SOURCE_CNPJWS ? cnpjws : receita;
    const fallback = source === SOURCE_CNPJWS ? receita : cnpjws;
    const values = mergeBlockFields(primary, fallback, fields);

    Object.assign(merged, values);

    fontes.blocos[block] = {
      fonte: SOURCE_LABELS[source],
      atualizado_em: primary?._sourceDates?.[block] || fallback?._sourceDates?.[block] || null
    };
  }

  merged.ultima_atualizacao = latestDate(
    ...Object.values(fontes.blocos).map((block) => block.atualizado_em),
    receita?._sourceDates?.estabelecimento,
    cnpjws?._sourceDates?.estabelecimento,
    receita?.ultima_atualizacao,
    cnpjws?.ultima_atualizacao
  );

  merged._fontes = fontes;
  return cleanObject(merged);
}

function chooseBlockSource(block, receita, cnpjws, fields) {
  const receitaHasValue = hasAnyFieldValue(receita, fields);
  const cnpjwsHasValue = hasAnyFieldValue(cnpjws, fields);

  if (!receitaHasValue && cnpjwsHasValue) return SOURCE_CNPJWS;
  if (receitaHasValue && !cnpjwsHasValue) return SOURCE_RECEITAWS;
  if (!receitaHasValue && !cnpjwsHasValue) return SOURCE_CNPJWS;

  const receitaTime = toTime(receita?._sourceDates?.[block]);
  const cnpjwsTime = toTime(cnpjws?._sourceDates?.[block]);

  if (Number.isFinite(receitaTime) && Number.isFinite(cnpjwsTime)) {
    if (cnpjwsTime >= receitaTime) return SOURCE_CNPJWS;
    return SOURCE_RECEITAWS;
  }

  if (Number.isFinite(cnpjwsTime)) return SOURCE_CNPJWS;
  if (Number.isFinite(receitaTime)) return SOURCE_RECEITAWS;

  return cnpjwsHasValue ? SOURCE_CNPJWS : SOURCE_RECEITAWS;
}

function mergeBlockFields(primary, fallback, fields) {
  const out = {};

  for (const field of fields) {
    out[field] = mergeValue(primary?.[field], fallback?.[field]);
  }

  return cleanObject(out);
}

function mergeValue(primary, fallback) {
  if (Array.isArray(primary) || Array.isArray(fallback)) {
    return Array.isArray(primary) && primary.length ? primary : (Array.isArray(fallback) ? fallback : []);
  }

  if (isPlainObject(primary) || isPlainObject(fallback)) {
    return fillMissingObject(
      isPlainObject(primary) ? primary : {},
      isPlainObject(fallback) ? fallback : {}
    );
  }

  return hasValue(primary) ? primary : fallback;
}

function fillMissingObject(primary, fallback) {
  const out = { ...primary };

  for (const [key, value] of Object.entries(fallback)) {
    if (!hasValue(out[key])) out[key] = value;
    else if (isPlainObject(out[key]) && isPlainObject(value)) out[key] = fillMissingObject(out[key], value);
  }

  return cleanObject(out);
}

function normalizeReceitaActivities(value) {
  return arrayOf(value)
    .map((activity) => cleanObject({
      code: clean(activity?.code),
      text: clean(activity?.text)
    }))
    .filter((activity) => hasValue(activity.code) || hasValue(activity.text));
}

function normalizePublicaActivities(value) {
  return arrayOf(value)
    .map((activity) => cleanObject({
      code: clean(activity?.subclasse || activity?.classe || activity?.id),
      text: clean(activity?.descricao)
    }))
    .filter((activity) => hasValue(activity.code) || hasValue(activity.text));
}

function normalizeReceitaQsa(value) {
  return arrayOf(value)
    .map((person) => cleanObject({
      nome: clean(person?.nome),
      qual: clean(person?.qual)
    }))
    .filter((person) => hasValue(person.nome) || hasValue(person.qual));
}

function normalizePublicaQsa(value) {
  return arrayOf(value)
    .map((person) => cleanObject({
      nome: clean(person?.nome),
      qual: clean(person?.qualificacao_socio?.descricao),
      data_entrada: formatDateBR(person?.data_entrada)
    }))
    .filter((person) => hasValue(person.nome) || hasValue(person.qual));
}

function normalizeReceitaRegime(value) {
  if (!value || typeof value !== "object") return undefined;

  return cleanObject({
    optante: Boolean(value.optante),
    data_opcao: clean(value.data_opcao),
    data_exclusao: clean(value.data_exclusao),
    ultima_atualizacao: clean(value.ultima_atualizacao)
  });
}

function normalizePublicaSimples(value) {
  if (!value || typeof value !== "object") return undefined;

  return cleanObject({
    optante: isYes(value.simples),
    data_opcao: formatDateBR(value.data_opcao_simples),
    data_exclusao: formatDateBR(value.data_exclusao_simples),
    ultima_atualizacao: clean(value.atualizado_em)
  });
}

function normalizePublicaSimei(value) {
  if (!value || typeof value !== "object") return undefined;

  return cleanObject({
    optante: isYes(value.mei),
    data_opcao: formatDateBR(value.data_opcao_mei),
    data_exclusao: formatDateBR(value.data_exclusao_mei),
    ultima_atualizacao: clean(value.atualizado_em)
  });
}

function normalizeStateRegistrations(value) {
  return arrayOf(value)
    .map((registration) => cleanObject({
      inscricao_estadual: clean(registration?.inscricao_estadual),
      ativo: Boolean(registration?.ativo),
      atualizado_em: formatDateBR(registration?.atualizado_em),
      uf: clean(registration?.estado?.sigla),
      estado: clean(registration?.estado?.nome)
    }))
    .filter((registration) => hasValue(registration.inscricao_estadual));
}

function sourceResultMeta(result, normalized) {
  return cleanObject({
    fonte: SOURCE_LABELS[result.source] || result.source,
    status: result.ok ? "ok" : "erro",
    http_status: result.status || 0,
    atualizado_em: normalized?.ultima_atualizacao || null,
    erro: result.ok ? null : clean(result.message)
  });
}

function cacheBypassRequested(url) {
  const value = url.searchParams.get("nocache") || url.searchParams.get("noCache") || url.searchParams.get("no_cache") || "";
  return ["1", "true", "sim", "yes"].includes(String(value).trim().toLowerCase());
}

async function getCachedWorkerResponse(origin, cnpj) {
  const cache = getWorkerCache();
  if (!cache) return null;

  try {
    return await cache.match(workerCacheKey(origin, cnpj));
  } catch {
    return null;
  }
}

async function putCachedWorkerResponse(origin, cnpj, response, ctx) {
  const cache = getWorkerCache();
  if (!cache) return;

  const putPromise = cache.put(workerCacheKey(origin, cnpj), response);

  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(putPromise.catch(() => {}));
  } else {
    await putPromise.catch(() => {});
  }
}

function getWorkerCache() {
  return typeof caches !== "undefined" && caches.default ? caches.default : null;
}

function workerCacheKey(origin, cnpj) {
  return new Request(`${origin}/__cache/cnpj/${cnpj}`, { method: "GET" });
}

function responseWithHeaders(response, extraHeaders) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(extraHeaders || {})) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function authorize(request, env) {
  const expectedPin = normalizePin(env.ACCESS_PIN || FALLBACK_PIN);
  const receivedPin = normalizePin(request.headers.get("x-access-pin") || "");

  if (expectedPin && receivedPin === expectedPin) {
    return { ok: true };
  }

  return {
    ok: false,
    response: json(
      {
        status: "ERROR",
        code: "PIN_REQUIRED",
        message: "PIN inválido"
      },
      401
    )
  };
}

function normalizePin(value) {
  return String(value || "").trim().toUpperCase();
}

function cnpjIsValid(cnpj) {
  if (!cnpj || cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;

  const calcDV = (base) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];

    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const dv1 = calcDV(cnpj.slice(0, 12));
  const dv2 = calcDV(cnpj.slice(0, 12) + dv1);

  return cnpj.endsWith(String(dv1) + String(dv2));
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...baseHeaders(),
      ...extraHeaders
    }
  });
}

function baseHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "x-app-version": APP_VERSION,
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Accept, Content-Type, X-Access-Pin",
    "access-control-max-age": "86400"
  };
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function clean(value) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function cleanObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (hasValue(item)) out[key] = item;
  }
  return out;
}

function hasAnyFieldValue(data, fields) {
  if (!data) return false;
  return fields.some((field) => hasValue(data[field]));
}

function hasValue(value) {
  if (value === false || value === 0) return true;
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function joinClean(separator, ...values) {
  return values.map(clean).filter(Boolean).join(separator) || undefined;
}

function isYes(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") === "sim";
}

function formatCep(value) {
  const digits = onlyDigits(value);
  if (digits.length !== 8) return clean(value);
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatPhone(ddd, number) {
  const dddDigits = onlyDigits(ddd);
  const numberDigits = onlyDigits(number);
  if (!numberDigits) return undefined;

  const formattedNumber = numberDigits.length === 9
    ? `${numberDigits.slice(0, 5)}-${numberDigits.slice(5)}`
    : numberDigits.length === 8
      ? `${numberDigits.slice(0, 4)}-${numberDigits.slice(4)}`
      : numberDigits;

  return dddDigits ? `(${dddDigits}) ${formattedNumber}` : formattedNumber;
}

function formatDateBR(value) {
  const text = clean(value);
  if (!text) return undefined;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

  const time = toTime(text);
  if (!Number.isFinite(time)) return text;

  const date = new Date(time);
  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCFullYear())
  ].join("/");
}

function latestDate(...values) {
  let best = null;
  let bestTime = -Infinity;

  for (const value of values) {
    const time = toTime(value);
    if (Number.isFinite(time) && time >= bestTime) {
      best = clean(value);
      bestTime = time;
    }
  }

  return best || undefined;
}

function toTime(value) {
  const text = clean(value);
  if (!text) return NaN;

  const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (brDate) {
    return Date.UTC(Number(brDate[3]), Number(brDate[2]) - 1, Number(brDate[1]));
  }

  const time = Date.parse(text);
  return Number.isFinite(time) ? time : NaN;
}

function extractMessage(data) {
  return clean(data?.message || data?.motivo || data?.error || data?.detail);
}

export {
  cnpjIsValid,
  lookupCnpj,
  mergeCnpjData,
  normalizePublicaCnpj,
  normalizeReceitaWs
};
