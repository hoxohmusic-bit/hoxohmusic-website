... dein Code ...
// netlify/functions/contact.js
const sgMail = require("@sendgrid/mail");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
}

function buildHtml(data) {
  const rows = (label, value) => value ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;width:180px">${esc(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${esc(value).replace(/\\n/g, '<br>')}</td></tr>` : "";

  const personal = Object.entries(data.personal || {}).filter(([k]) => !["bot-field"].includes(k));
  const pkg = data.package || {};
  const tracks = data.tracks || [];

  return `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fafafa;padding:20px;border-radius:12px">
      <h2 style="text-align:center;color:#1F2937;margin-bottom:20px">HOXOH MUSIC – Neue Bestellung</h2>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
        ${personal.length ? `<h3 style="margin:16px 0 8px;color:#4F46E5">Kunde</h3><table style="width:100%;border-collapse:collapse;font-size:15px">${personal.map(([k,v]) => rows(k,v)).join("")}</table>` : ""}
        <hr style="border:none;border-top:2px solid #eee;margin:20px 0">
        <h3 style="margin:16px 0 8px;color:#10B981">Paket</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${rows("Bestellnummer", data.orderNumber || "–")}
          ${rows("Paket", pkg.id || "–")}
          ${rows("Betrag", pkg.amount ? `$${pkg.amount}` : "–")}
          ${rows("Notizen", pkg.notes || "–")}
        </table>
        ${tracks.length ? `<hr style="border:none;border-top:2px solid #eee;margin:20px 0"><h3 style="margin:16px 0 8px;color:#F59E0B">Tracks</h3><table style="width:100%;border-collapse:collapse;font-size:15px">${tracks.map(t => rows(t.title, t.artist)).join("")}</table>` : ""}
        <p style="text-align:center;color:#666;font-size:13px;margin-top:24px">Automatische Nachricht – HOXOH MUSIC</p>
      </div>
    </div>
  `;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "ok" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };

  const { SENDGRID_API_KEY, TO_EMAIL, FROM_EMAIL } = process.env;
  if (!SENDGRID_API_KEY || !TO_EMAIL || !FROM_EMAIL) {
    console.error("Missing env vars");
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Server config error" }) };
  }

  sgMail.setApiKey(SENDGRID_API_KEY);

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: CORS, body: "Bad JSON" }; }

  const html = buildHtml(body);
  const text = `Neue Bestellung von ${body.personal?.firstName || "Unbekannt"}`;

  try {
    await sgMail.send({
      to: TO_EMAIL,
      from: FROM_EMAIL,
      subject: `Neue Bestellung – ${body.orderNumber || "OHNE-ORDER"}`,
      html,
      text,
    });

    // Auto-Reply an Kunden
    if (body.personal?.email) {
      await sgMail.send({
        to: body.personal.email,
        from: FROM_EMAIL,
        subject: "Vielen Dank für deine Bestellung!",
        html: `<p>Hallo ${esc(body.personal.firstName || "")},<br><br>vielen Dank! Wir haben deine Bestellung erhalten und melden uns bald.<br><br>— Das HOXOH Team</p>`,
      });
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ message: "E-Mails gesendet!" }) };
  } catch (error) {
    console.error("SendGrid Fehler:", error);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "E-Mail fehlgeschlagen" }) };
  }
};