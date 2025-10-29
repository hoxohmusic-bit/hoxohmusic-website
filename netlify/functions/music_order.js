// netlify/functions/music_order.js – ALTE VERSION, DIE FUNKTIONIERT + SCHÖN
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

  const orderNumber = data.orderNumber || "N/A";
  const personal = data.personal || {};
  const pkg = data.package || {};
  const tracks = data.tracks || [];

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fafafa;padding:20px;border-radius:12px">
      <h2 style="text-align:center;color:#1F2937;margin-bottom:20px">HOXOH MUSIC – Neue Bestellung #${orderNumber}</h2>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
        <h3 style="margin:16px 0 8px;color:#4F46E5">Kunde</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${rows("Name", `${personal.firstName} ${personal.lastName}`)}
          ${rows("E-Mail", personal.email)}
          ${rows("Land", personal.country)}
        </table>
        <hr style="border:none;border-top:2px solid #eee;margin:20px 0">
        <h3 style="margin:16px 0 8px;color:#10B981">Paket</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${rows("Paket-ID", pkg.id)}
          ${rows("Betrag", pkg.amount)}
          ${rows("Notizen", pkg.notes)}
        </table>
        ${tracks.length ? `<hr style="border:none;border-top:2px solid #eee;margin:20px 0"><h3 style="margin:16px 0 8px;color:#F59E0B">Tracks</h3><table style="width:100%;border-collapse:collapse;font-size:15px">${tracks.map(t => rows(t.title, t.artist)).join("")}</table>` : ""}
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

  const to = SG_TO || "hoxohmusic@gmail.com";
  const from = SG1_FROM || "no-reply@hoxohmusic.com";
  const subject = `Neue Bestellung #${data.orderNumber || "N/A"}`;
  const html = buildHtml(data);
  const text = `Neue Bestellung #${data.orderNumber || "N/A"}:\n${JSON.stringify(data, null, 2)}`;

  try {
    sgMail.setApiKey(SG1_API_KEY);
    await sgMail.send({ to, from, subject, html, text });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: CORS, body: "Send failed" };
  }
};