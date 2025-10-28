// netlify/functions/music_order.js
const sgMail = require("@sendgrid/mail");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const { SENDGRID_API_KEY, TO_EMAIL, FROM_EMAIL } = process.env;
  if (!SENDGRID_API_KEY || !TO_EMAIL || !FROM_EMAIL) return { statusCode: 500, body: "Missing config" };

  sgMail.setApiKey(SENDGRID_API_KEY);

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Bad JSON" }; }

  const orderNumber = body.orderNumber || "–";
  const personal = body.personal || {};
  const pkg = body.package || {};
  const tracks = body.tracks || [];

  const rows = (label, value) => value ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;width:180px">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${value}</td></tr>` : "";

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;background:#fafafa;padding:20px;border-radius:12px">
      <h2 style="text-align:center;color:#1F2937;margin-bottom:20px">HOXOH MUSIC – Neue Bestellung #${orderNumber}</h2>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
        <h3 style="margin:16px 0 8px;color:#4F46E5">Kunde</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${rows("Name", `${personal.firstName || ""} ${personal.lastName || ""}`)}
          ${rows("E-Mail", personal.email)}
        </table>
        <hr style="border:none;border-top:2px solid #eee;margin:20px 0">
        <h3 style="margin:16px 0 8px;color:#10B981">Paket</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px">
          ${rows("ID", pkg.id)}
          ${rows("Betrag", pkg.amount ? `$${pkg.amount}` : "")}
        </table>
        ${tracks.length ? `<hr style="border:none;border-top:2px solid #eee;margin:20px 0"><h3 style="margin:16px 0 8px;color:#F59E0B">Tracks</h3><table style="width:100%;border-collapse:collapse;font-size:15px">${tracks.map(t => rows(t.title, t.artist)).join("")}</table>` : ""}
      </div>
    </div>
  `;

  try {
    await sgMail.send({
      to: TO_EMAIL,
      from: FROM_EMAIL,
      subject: `Neue Bestellung #${orderNumber}`,
      html,
    });

    if (personal.email) {
      await sgMail.send({
        to: personal.email,
        from: FROM_EMAIL,
        subject: "Bestellung erhalten!",
        html: `<p>Hallo,<br><br>vielen Dank für deine Bestellung! Wir melden uns bald.<br><br>— HOXOH Team</p>`,
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Send failed" };
  }
};