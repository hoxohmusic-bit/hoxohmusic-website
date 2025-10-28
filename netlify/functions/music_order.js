// Netlify Function: music_order.js (FINALE VERSION)
// Sends a structured German HTML email with HOXOH branding.
// CC to customer (personal.email).
// ENV required: SENDGRID_API_KEY, TO_EMAIL, SG1_FROM or FROM_EMAIL

const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const sgTransport = require("nodemailer-sendgrid-transport");

function isEmail(v) {
  return typeof v === "string" && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v);
}

function decodeBody(event) {
  let body = {};
  const ct = (event.headers && (event.headers["content-type"] || event.headers["Content-Type"])) || "";
  try {
    if (ct.includes("application/json")) {
      body = JSON.parse(event.body || "{}");
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(event.body || "");
      params.forEach((v, k) => (body[k] = v));
    } else {
      try { body = JSON.parse(event.body || "{}"); }
      catch {
        const params = new URLSearchParams(event.body || "");
        params.forEach((v, k) => (body[k] = v));
      }
    }
  } catch {
    body = {};
  }
  return body;
}

// Hilfsfunktion zur Erstellung von key/value-Paaren, filtert leere Werte
function safeRows(obj) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).map(([key, value]) => {
        // Schlüsselnamen für bessere Lesbarkeit übersetzen
        let k = key;
        switch (key) {
            case 'firstName': k = 'Vorname'; break;
            case 'lastName': k = 'Nachname'; break;
            case 'country': k = 'Land'; break;
            case 'email': k = 'E-Mail'; break;
            case 'artistName': k = 'Künstlername'; break;
            case 'labelName': k = 'Label'; break;
            case 'birthYear': k = 'Geburtsjahr'; break;
            case 'id': k = 'Paket-ID'; break;
            case 'amount': k = 'Paketpreis'; break;
            case 'trackCount': k = 'Tracks'; break;
            case 'total': k = 'Gesamtpreis'; break;
            case 'subtotal': k = 'Zwischensumme'; break;
            case 'orderNumber': k = 'Bestellung #'; break;
            case 'title': k = 'Name'; break; // für Tracks
        }
        return [k, value || "N/A"];
    });
}

// Hilfsfunktion zur Erstellung des detaillierten Track-Textblocks
function createTrackText(t, i) {
    const lines = [
        `\n--- TRACK ${i + 1}: ${t.title || 'Ohne Titel'} ---`,
        // Genres und Vibe
        `- Genre: ${t.genre1 || 'N/A'}${t.genre2 ? ` / ${t.genre2}` : ''} | Vibe: ${t.vibe || 'N/A'}`,
        // Tempo und Dauer
        `- Tempo: ${t.tempo || 'N/A'} | Dauer: ${t.duration || 'N/A'}`,
        // Vocals und Sprachen
        `- Gesang: ${t.vocals || 'N/A'} | Sprachen: ${t.languageMain || 'N/A'}${t.languageSecond ? `, ${t.languageSecond}` : ''} | Explicit: ${t.explicit || 'Nein'}`,
        // Anlass
        `- Anlass: ${t.occasion || 'N/A'} | Referenz: ${t.reference || 'N/A'}`,
        // Instrumente
        `- Instrumente (gewünscht): ${t.instrumentsWanted || 'N/A'}`,
        `- Instrumente (unerwünscht): ${t.instrumentsUnwanted || 'N/A'}`,
        // Beschreibung
        t.description ? `\n[Beschreibung]\n${t.description}` : '',
        `--------------------------------`
    ];
    return lines.filter(Boolean).join('\n');
}


exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const body = decodeBody(event);
  const { orderNumber, data: payload } = body;
  
  // Überprüfen, ob die Datenstruktur korrekt ist
  if (!payload || typeof payload !== 'object') {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid payload format." }) };
  }

  // Daten extrahieren und in lesbare Variablen umbenennen
  const { personal, package: pkg, extras, tracks, total, ...data } = payload;
  
  // Vorbereiten der strukturierten Zeilen
  const personalRows = safeRows(personal);
  const pkgRows = safeRows(pkg);
  const extrasRows = Array.isArray(extras) ? extras.map(e => [e.name || 'Extra', e.amount || 'N/A']) : [];
  
  // Subtotal berechnen (falls nicht in Payload enthalten)
  const subtotal = data.subtotal || pkg.amount;
  
  // ----------------------------------------------------
  // ROBUSTES HTML-TEMPLATE (wie in der letzten Runde)
  // ----------------------------------------------------

    const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Neue Musikbestellung #${orderNumber}</title>
        <style>
            /* Inlining styles for maximum compatibility */
            body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
            table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { -ms-interpolation-mode: bicubic; }
            
            /* Class definitions and inline overrides */
            .body-bg { background-color: #f7f7f8; }
            .content-bg { background-color: #ffffff; border-radius: 10px; border: 1px solid #e0e0e0; }
            .header-bg { background: linear-gradient(to right, #0a7a27, #c43e13); border-radius: 10px 10px 0 0; }
            .text-main { color: #1f2937; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; }
            .text-muted { color: #6b7280; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; }
            .title { color: #ffffff; font-size: 24px; font-weight: bold; padding: 20px; }
            .total-row td { background-color: #f0f0f0; font-weight: bold; border-radius: 0 0 10px 10px; }
            .item-cell { padding: 10px 20px; border-bottom: 1px solid #f0f0f0; }
            .footer-text { color: #9ca3af; font-size: 12px; padding: 15px 20px; }
        </style>
    </head>
    <body class="body-bg" style="margin: 0; padding: 0; min-width: 100%; height: 100%; background-color: #f7f7f8;">
        <div style="display:none;font-size:1px;color:#f7f7f8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
            Neue Musikbestellung #${orderNumber} ist eingegangen.
        </div>
    
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border-collapse: collapse; max-width: 600px; margin: 20px auto;">
            <tr>
                <td align="center" style="padding: 0 10px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="content-bg" style="border-collapse: collapse; border-radius: 10px; background-color: #ffffff;">
                        
                        <tr>
                            <td align="center" class="header-bg" style="background: linear-gradient(to right, #0a7a27, #c43e13); border-radius: 10px 10px 0 0; padding: 20px;">
                                <h1 class="title" style="margin: 0; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold;">
                                    🎵 Musikbestellung #${orderNumber}
                                </h1>
                            </td>
                        </tr>
    
                        <tr>
                            <td class="text-main" style="padding: 20px;">
                                <p style="margin: 0 0 10px; color: #1f2937; font-size: 16px;">
                                    Hallo HOXOH Team,
                                </p>
                                <p style="margin: 0; color: #1f2937; font-size: 16px;">
                                    Eine neue Musikproduktion wurde beauftragt. Alle Details unten.
                                </p>
                            </td>
                        </tr>
    
                        <tr>
                            <td style="padding: 0 20px 10px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border-collapse: collapse;">
                                    <tr>
                                        <td style="font-size: 16px; font-weight: bold; padding-bottom: 5px; color: #c43e13; font-family: Arial, Helvetica, sans-serif;">KUNDENDATEN</td>
                                    </tr>
                                    ${personalRows.map(([key, value]) => `
                                        <tr>
                                            <td class="text-main" style="padding: 5px 0; font-size: 14px;">
                                                <span style="font-weight: bold; display: inline-block; width: 100px; color: #1f2937;">${key}:</span>
                                                <span style="color: #6b7280;">${value ?? 'N/A'}</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </table>
                            </td>
                        </tr>
                        
                        <tr>
                            <td style="padding: 10px 20px 10px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border-collapse: collapse;">
                                    <tr>
                                        <td style="font-size: 16px; font-weight: bold; padding-bottom: 5px; color: #0a7a27; font-family: Arial, Helvetica, sans-serif;">PAKET & KOSTEN</td>
                                    </tr>
                                    ${pkgRows.map(([key, value]) => `
                                        <tr>
                                            <td class="text-main" style="padding: 5px 0; font-size: 14px;">
                                                <span style="font-weight: bold; display: inline-block; width: 100px; color: #1f2937;">${key}:</span>
                                                <span style="color: #6b7280;">${value ?? 'N/A'}</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                    ${extrasRows.map(([key, value]) => `
                                        <tr>
                                            <td class="text-main" style="padding: 5px 0; font-size: 14px;">
                                                <span style="font-weight: bold; display: inline-block; width: 100px; color: #1f2937;">Extra (${key}):</span>
                                                <span style="color: #6b7280;">${value ?? 'N/A'}</span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </table>
                            </td>
                        </tr>
    
                        ${Array.isArray(tracks) && tracks.length > 0 ? `
                        <tr>
                            <td style="padding: 10px 20px 10px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border-collapse: collapse;">
                                    <tr>
                                        <td style="font-size: 16px; font-weight: bold; padding-bottom: 5px; color: #c43e13; font-family: Arial, Helvetica, sans-serif;">BESTELLTE TRACKS (${tracks.length})</td>
                                    </tr>
                                    ${tracks.map((t, i) => `
                                        <tr>
                                            <td class="text-main" style="padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
                                                <p style="margin: 0 0 5px; font-size: 14px;">
                                                    <span style="font-weight: bold; color: #1f2937;">Track ${i + 1}: ${t.title || 'Ohne Titel'}</span>
                                                </p>
                                                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #6b7280;">
                                                    <li>Genre: ${t.genre1 || 'N/A'}${t.genre2 ? ` / ${t.genre2}` : ''} | Vibe: ${t.vibe || 'N/A'}</li>
                                                    <li>Tempo: ${t.tempo || 'N/A'} | Dauer: ${t.duration || 'N/A'}</li>
                                                    <li>Gesang: ${t.vocals || 'N/A'} | Sprache: ${t.languageMain || 'N/A'}</li>
                                                    <li>Gewünschte Instrumente: ${t.instrumentsWanted || 'N/A'}</li>
                                                    <li>Unerwünschte Instrumente: ${t.instrumentsUnwanted || 'N/A'}</li>
                                                    ${t.description ? `<li><span style="font-weight: bold; color: #1f2937;">Beschreibung:</span> ${t.description.replace(/\\n/g, '<br>')}</li>` : ''}
                                                </ul>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </table>
                            </td>
                        </tr>
                        ` : ''}
    
                        <tr>
                            <td class="total-row" style="background-color: #f0f0f0; border-radius: 0 0 10px 10px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation" style="border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 15px 20px; font-size: 18px; font-weight: bold; color: #1f2937; font-family: Arial, Helvetica, sans-serif;">
                                            Gesamtsumme:
                                        </td>
                                        <td align="right" style="padding: 15px 20px; font-size: 18px; font-weight: bold; color: #1f2937; font-family: Arial, Helvetica, sans-serif;">
                                            ${total || 'N/A'}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <tr>
                            <td align="center" class="footer-text" style="padding: 15px 20px; font-size: 12px; color: #9ca3af; font-family: Arial, Helvetica, sans-serif;">
                                <p style="margin: 0;">
                                    HOXOH MUSIC — Interne Benachrichtigung | www.hoxohmusic.com | hoxohmusic@gmail.com
                                </p>
                            </td>
                        </tr>
    
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `.trim();

    // ----------------------------------------------------
    // KORRIGIERTER TEXT-FALLBACK (verhindert JSON-DUMP)
    // ----------------------------------------------------
    
    const text = [
        `NEUE MUSIKBESTELLUNG: ${orderNumber || 'N/A'}`,
        `================================================`,
        
        `[KUNDENDATEN]`,
        ...personalRows.map(([k, v]) => `${k}: ${v}`),
        
        `\n[PAKET & KOSTEN]`,
        ...pkgRows.map(([k, v]) => `${k}: ${v}`),
        ...(extrasRows.length > 0 ? [`\n[EXTRAS]`, ...extrasRows.map(([k, v]) => `${k}: ${v}`)] : []),
        
        `\nZwischensumme: ${subtotal || 'N/A'}`,
        `GESAMTSUMME: ${total || 'N/A'}`,

        `\n[DETAILS ZUR MUSIKPRODUKTION]`,
        ...(Array.isArray(tracks) ? tracks.map(createTrackText).flat() : ['Keine Tracks bestellt.']),
        
        `\n================================================`,
        `HOXOH MUSIC — Interne Benachrichtigung`,
    ].filter(Boolean).join("\n");


    // Prepare transporter
    const transporter = nodemailer.createTransport(sgTransport({
      auth: { api_key: process.env.SENDGRID_API_KEY }
    }));

    const toEmail = process.env.TO_EMAIL;
    const fromEmail = process.env.SG1_FROM || process.env.FROM_EMAIL || toEmail;
    const ccEmail = isEmail(personal.email) ? personal.email : undefined;

    const mailOptions = {
      to: toEmail,
      from: fromEmail,
      subject: `Neue Musikbestellung #${orderNumber}`.replace('Neue Musikbestellung #N/A', 'Neue Musikbestellung'),
      html,
      text
    };
    if (ccEmail) mailOptions.cc = ccEmail;

    try {
        await transporter.sendMail(mailOptions);
        return { statusCode: 200, body: JSON.stringify({ success: true, message: "Email sent" }) };
    } catch (error) {
        console.error("Email sending failed:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                success: false, 
                message: "Email sending failed",
                error: error.message 
            }) 
        };
    }
};