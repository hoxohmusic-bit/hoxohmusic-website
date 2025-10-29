// netlify/functions/contact.js – ALTE VERSION, DIE FUNKTIONIERT + SCHÖN
const sgMail = require("@sendgrid/mail");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const { SG1_API_KEY, SG1_FROM, SG_TO } = process.env;

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}

function buildHtml(data) {
  const rows = (label, value) => value ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;width:180px">${esc(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${esc(value).replace(/\n/g, '<br>')}</td></tr>` : "";

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fafafa;padding:20px;border-radius:12px">
      <h2 style="text-align:center;color:#1F2937;margin-bottom:20px">HOXOH MUSIC – Neue Nachricht</h2>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${Object.entries(data || {}).filter(([k]) => !["bot-field", "company", "website"].includes(k)).map(([k,v]) => rows(k, v)).join("")}
        </table>
        <p style="text-align:center;color:#666;font-size:13px;margin-top:24px">Automatische Nachricht – HOXOH MUSIC</p>
      </div>
    </div>
  `;
  return html;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  let data;
  try { data = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers: CORS, body: "Bad JSON" }; }

  if (data["bot-field"] || data.company || data.website) return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, redirect: "gracias.html" }) };

  const to = SG_TO || "hoxohmusic@gmail.com";
  const from = SG1_FROM || "no-reply@hoxohmusic.com";
  const subject = data.subject || "Neue Nachricht";
  const html = buildHtml(data);
  const text = Object.entries(data).filter(([k]) => !["bot-field", "company", "website"].includes(k)).map(([k, v]) => `${k}: ${v}`).join("\n");

  try {
    sgMail.setApiKey(SG1_API_KEY);
    await sgMail.send({ to, from, subject, html, text });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, redirect: "gracias.html" }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: CORS, body: "Send failed" };
  }
};