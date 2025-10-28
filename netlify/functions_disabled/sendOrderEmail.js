// netlify/functions/sendOrderEmail.js
import sgMail from "@sendgrid/mail";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const data = JSON.parse(event.body || "{}");
    const {
      name = "",
      email = "",
      packageName = "",
      notes = "",
      locale = "es",
    } = data;

    // ENV Variablen in Netlify setzen!
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const TO_EMAIL = process.env.TO_EMAIL;       // wohin du die Mails bekommst
    const FROM_EMAIL = process.env.FROM_EMAIL;   // verifizierte Absenderadresse bei SendGrid
    const SITE_NAME = process.env.SITE_NAME || "HOXOH MUSIC";

    if (!SENDGRID_API_KEY || !TO_EMAIL || !FROM_EMAIL) {
      return { statusCode: 500, body: "Missing email configuration" };
    }

    sgMail.setApiKey(SENDGRID_API_KEY);

    const subject = `Neue PayPal-Bestellung (${SITE_NAME}) – ${packageName || "Paket"}`;
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5">
        <h2 style="margin:0 0 10px">${SITE_NAME}: Neue Bestellung</h2>
        <p><b>Name:</b> ${escapeHtml(name)}</p>
        <p><b>E-Mail:</b> ${escapeHtml(email)}</p>
        <p><b>Paket:</b> ${escapeHtml(packageName)}</p>
        <p><b>Sprache:</b> ${escapeHtml(locale)}</p>
        <p><b>Notizen:</b><br>${escapeHtml(notes).replace(/\n/g,"<br>")}</p>
        <hr>
        <p style="color:#666">Hinweis: Diese E-Mail wird <i>vor</i> der PayPal-Zahlungsbestätigung gesendet.</p>
      </div>
    `;

    const msg = {
      to: TO_EMAIL,
      from: FROM_EMAIL,
      subject,
      html,
    };

    await sgMail.send(msg);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Email send failed" };
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
