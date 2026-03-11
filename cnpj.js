// netlify/functions/cnpj.js

export async function handler(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=3600" // 1h cache browser
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  const cnpj = (event.queryStringParameters?.cnpj || "").replace(/\D/g, "");

  if (!cnpj || cnpj.length !== 14) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "CNPJ inválido" })
    };
  }

  try {
    const token = process.env.RECEITAWS_TOKEN;

    const url = `https://www.receitaws.com.br/v1/cnpj/${cnpj}`;

    const resp = await fetch(url, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`
          }
        : {}
    });

    const data = await resp.json();

    return {
      statusCode: resp.status,
      headers,
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Erro ao consultar ReceitaWS",
        detail: err.message
      })
    };
  }
}