export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API
    if (url.pathname === "/api/cnpj") {
      const cnpj = (url.searchParams.get("cnpj") || "").replace(/\D/g, "");

      if (!cnpj || cnpj.length !== 14) {
        return json(
          { status: "ERROR", message: "CNPJ inválido" },
          400
        );
      }

      const token = env.RECEITAWS_TOKEN;
      const endpoint = `https://www.receitaws.com.br/v1/cnpj/${cnpj}`;

      try {
        const upstream = await fetch(endpoint, {
          method: "GET",
          headers: token
            ? {
                "Accept": "application/json",
                "Authorization": `Bearer ${token}`
              }
            : {
                "Accept": "application/json"
              }
        });

        const body = await upstream.text();

        return new Response(body, {
          status: upstream.status,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=3600"
          }
        });
      } catch (err) {
        return json(
          {
            status: "ERROR",
            message: "Erro ao consultar ReceitaWS",
            detail: err instanceof Error ? err.message : String(err)
          },
          500
        );
      }
    }

    // Static assets
    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
