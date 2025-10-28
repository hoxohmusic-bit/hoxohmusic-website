// netlify/functions/contact-form.js
// Einfaches Kontaktformular für kontakt.html mit SendGrid + Auto-Reply

const sgMail = require("@sendgrid/mail");

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, s => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]
  ));
}

// Multilinguale Auto-Reply
function getAutoReplyContent(lang, siteName, customerName) {
  const namePart = customerName ? ` ${customerName}` : '';
  const defaultLang = 'es';

  const texts = {
    de: {
      subject: `Deine Nachricht an ${siteName} wurde empfangen`,
      greeting: `Hallo${namePart},`,
      body: `vielen Dank für deine Nachricht. Wir haben deine Anfrage erhalten und werden uns innerhalb von 24-48 Stunden bei dir melden.`,
      footer: `Falls du Rückfragen hast, antworte einfach auf diese E-Mail.`,
      team: `Das Team von ${siteName}`
    },
    en: {
      subject: `Your message to ${siteName} has been received`,
      greeting: `Hello${namePart},`,
      body: `thank you for your message. We have received your inquiry and will get back to you within 24-48 hours.`,
      footer: `If you have any questions, simply reply to this email.`,
      team: `The ${siteName} Team`
    },
    es: {
      subject: `Tu mensaje a ${siteName} ha sido recibido`,
      greeting: `Hola${namePart},`,
      body: `gracias por tu mensaje. Hemos recibido tu consulta y nos pondremos en contacto contigo dentro de 24-48 horas.`,
      footer: `Si tienes alguna pregunta, simplemente responde a este correo electrónico.`,
      team: `El equipo de ${siteName}`
    }
  };

  const content = texts[lang] || texts[defaultLang];
  
  return {
    subject: content.subject,
    html: `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;max-width:600px;margin:0 auto;color:#333">
      <div style="background:linear-gradient(135deg, #19c37d 0%, #15a86b 100%);padding:30px;text-align:center;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:white;font-size:24px;font-weight:800">✓ ${esc(content.subject.split(' ').slice(0, 3).join(' '))}</h1>
      </div>
      <div style="background:#ffffff;padding:30px;border:1px solid #e6e6e6;border-top:none;border-radius:0 0 12px 12px">
        <p style="margin:0 0 16px;font-size:16px">${content.greeting}</p>
        <p style="margin:0 0 20px;line-height:1.6">${content.body}</p>
        <div style="background:#f8f9fa;border-left:4px solid #19c37d;padding:15px;margin:20px 0;border-radius:4px">
          <p style="margin:0;font-size:14px;color:#666">${content.footer}</p>
        </div>
        <p style="margin:20px 0 0;color:#19c37d;font-weight:600">— ${content.team}</p>
      </div>
      <div style="text-align:center;padding:20px;color:#999;font-size:13px">
        <p style="margin:0">HOXOH MUSIC © ${new Date().getFullYear()}</p>
      </div>
    </div>`
  };
}

// E-Mail an dich (Owner)
function buildOwnerEmailHtml(formData, lang) {
  const rows = Object.entries(formData)
    .filter(([key]) => key !== 'lang' && key !== 'bot-field')
    .map(([key, value]) => {
      const val = Array.isArray(value) ? value.join(', ') : String(value ?? '');
      return `
        <tr>
          <td style="padding:12px;border:1px solid #e6e6e6;background:#f8f9fa;font-weight:600;width:180px">${esc(key)}</td>
          <td style="padding:12px;border:1px solid #e6e6e6">${esc(val).replace(/\n/g, '<br>')}</td>
        </tr>`;
    }).join('');

  const langLabels = {
    es: '🇪🇸 Spanisch',
    de: '🇩🇪 Deutsch',
    en: '🇬🇧 Englisch'
  };

  return `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;max-width:700px;margin:0 auto">
      <div style="background:linear-gradient(135deg, #19c37d 0%, #15a86b 100%);padding:25px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:white;font-size:22px;font-weight:800">📧 Neue Kontaktanfrage</h2>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px">Sprache: ${langLabels[lang] || lang}</p>
      </div>
      <div style="background:#ffffff;padding:25px;border:1px solid #e6e6e6;border-top:none;border-radius:0 0 12px 12px">
        <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse">
          ${rows}
        </table>
        <div style="margin-top:20px;padding:15px;background:#f8f9fa;border-radius:8px;color:#666;font-size:13px">
          <p style="margin:0"><strong>Eingegangen am:</strong> ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Berlin)</p>
          <p style="margin:8px 0 0"><strong>Quelle:</strong> hoxohmusic.com/kontakt.html</p>
        </div>
      </div>
    </div>
  `;
}

// HAUPTFUNKTION
exports.handler = async (event) => {
  // CORS Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "ok" };
  }

  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: cors(), 
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    // ENV Variablen
    const { SENDGRID_API_KEY, TO_EMAIL, FROM_EMAIL } = process.env;
    const SITE_NAME = process.env.SITE_NAME || "HOXOH MUSIC";
      
    if (!SENDGRID_API_KEY || !TO_EMAIL || !FROM_EMAIL) {
      console.error("Missing environment variables:", { 
        hasSendGrid: !!SENDGRID_API_KEY, 
        hasTo: !!TO_EMAIL, 
        hasFrom: !!FROM_EMAIL 
      });
      return { 
        statusCode: 500, 
        headers: cors(), 
        body: JSON.stringify({ error: "Server configuration error" }) 
      };
    }

    sgMail.setApiKey(SENDGRID_API_KEY);

    // Parse Form Data
    const body = JSON.parse(event.body || "{}");
    
    // Honeypot Check (Spam Protection)
    if (body['bot-field'] && body['bot-field'].trim() !== '') {
      // Silent success for bots
      return {
        statusCode: 200,
        headers: cors(),
        body: JSON.stringify({ success: true, message: "Message sent" })
      };
    }

    const lang = (body.lang || 'es').toLowerCase();
    const customerEmail = body.email;
    const customerName = body.nombre;

    // Email-Nachrichten vorbereiten
    const msgs = [];

    // 1. E-Mail an dich (Owner)
    const subjectOwner = `📧 Neue Kontaktanfrage — ${SITE_NAME} (${lang.toUpperCase()})`;
    const htmlOwner = buildOwnerEmailHtml(body, lang);

    msgs.push({
      to: TO_EMAIL,
      from: FROM_EMAIL,
      subject: subjectOwner,
      html: htmlOwner,
      replyTo: customerEmail || TO_EMAIL
    });

    // 2. Auto-Reply an den Kunden (optional)
    if (customerEmail && customerEmail.includes('@')) {
      const reply = getAutoReplyContent(lang, SITE_NAME, customerName);
      
      msgs.push({
        to: customerEmail,
        from: FROM_EMAIL,
        subject: reply.subject,
        html: reply.html,
      });
    }

    // Sende beide E-Mails
    await sgMail.send(msgs);

    console.log(`✓ Contact form submitted successfully (${lang}) - sent ${msgs.length} emails`);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ 
        success: true, 
        message: "Message sent successfully" 
      }),
    };

  } catch (error) {
    console.error("Error sending email:", error.response?.body || error.message);
    
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ 
        success: false,
        error: "Failed to send message",
        details: error.message 
      }),
    };
  }
};
