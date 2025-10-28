// netlify/functions/contact.js
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const {
  SG1_API_KEY, SG1_FROM,
  SG2_API_KEY, SG2_FROM,
  SG_TO
} = process.env;

function pickGracias(lang, refererPath = "") {
  if (lang) {
    if (lang.startsWith("de")) return "gracias-de.html";
    if (lang.startsWith("en")) return "gracias-en.html";
    return "gracias.html";
  }
  const p = (refererPath || "").toLowerCase();
  if (p.includes("-de")) return "gracias-de.html";
  if (p.includes("-en")) return "gracias-en.html";
  return "gracias.html";
}

function bodyText(data) {
  const lines = [];
  for (const [k, v] of Object.entries(data || {})) {
    if (!v || ["bot-field","company","website"].includes(k)) continue;
    lines.push(`${k}: ${String(v)}`.trim());
  }
  return lines.join("\n");
}

async function sendWithKey(apiKey, from, to, subject, text) {
  if (!apiKey || !from) throw new Error("Missing API key or sender");
  const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
  });
  if (resp.status !== 202) {
    const t = await resp.text().catch(() => "");
    const err = new Error(`SendGrid status ${resp.status}`);
    err.responseText = t;
    throw err;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  let data = {};
  try { data = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok:false, error:"BAD_JSON" }) }; }

  if (data["bot-field"] || data.company || data.website) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok:true, redirect: "gracias.html" }) };
  }

  const referer = event.headers?.referer || "";
  const refererPath = (() => { try { return new URL(referer).pathname; } catch { return ""; } })();
  const redirect = pickGracias(String(data.lang || "").toLowerCase(), refererPath);

  const to = SG_TO || "hoxohmusic@gmail.com";
  const subject = (data.subject || data.betreff || data.topic || "Neue Nachricht über HOXOH Kontakt").toString();
  const text = bodyText(data);

  try {
    await sendWithKey(SG1_API_KEY, SG1_FROM, to, subject, text);
  } catch (e1) {
    try {
      await sendWithKey(SG2_API_KEY, SG2_FROM, to, subject, text);
    } catch (e2) {
      return {
        statusCode: 500,
        headers: CORS,
        body: JSON.stringify({ ok:false, error:"SEND_FAILED" }),
      };
    }
  }

  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, redirect }),
  };
}
