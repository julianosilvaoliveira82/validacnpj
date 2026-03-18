// functions/api/cnpj.js
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cnpj = (url.searchParams.get("cnpj") || "").replace(/\D/g, "");

  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=3600"
  };

  if (!cnpj || cnpj.length !== 14) {
    return new Response(
      JSON.stringify({ status: "ERROR", message: "CNPJ inválido" }),
      { status: 400, headers }
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

    const text = await upstream.text();

    return new Response(text, {
      status: upstream.status,
      headers
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        message: "Erro ao consultar ReceitaWS",
        detail: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers }
    );
  }
}
