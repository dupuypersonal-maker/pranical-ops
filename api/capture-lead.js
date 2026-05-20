const dns = require('dns').promises;

// Disposable email domains blocklist
const BLOCKED_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
  'yopmail.com','sharklasers.com','trashmail.com','maildrop.cc',
  'dispostable.com','fakeinbox.com','mailnull.com','spamgourmet.com',
  'trashmail.net','discard.email','spamex.com','getairmail.com',
  'mailexpire.com','spamfree24.org','mailnesia.com','spamspot.com',
  'tempr.email','throwam.com','tempemail.net','tempinbox.com',
  'spammotel.com','mailzilla.com','spambot.com','spamevader.com',
]);

async function validateEmail(email) {
  if (!email || !email.includes('@') || !email.includes('.')) {
    return { valid: false, reason: 'Formato de email inválido.' };
  }

  const parts = email.split('@');
  if (parts.length !== 2) return { valid: false, reason: 'Formato de email inválido.' };

  const domain = parts[1].toLowerCase();

  // Block disposable domains
  if (BLOCKED_DOMAINS.has(domain)) {
    return { valid: false, reason: 'Por favor usa un email corporativo o personal válido.' };
  }

  // Verify MX records exist (real domain that can receive email)
  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      return { valid: false, reason: 'Este dominio no puede recibir emails. Verifica tu dirección.' };
    }
  } catch (e) {
    return { valid: false, reason: 'No se pudo verificar el dominio de email. Usa una dirección válida.' };
  }

  return { valid: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, fuente, industry } = req.body;

  // Validate email with MX check
  const validation = await validateEmail(email);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE = process.env.AIRTABLE_BASE;
  const RESEND_KEY = process.env.RESEND_KEY;

  const today = new Date().toISOString().split('T')[0];
  const fuenteFinal = fuente || 'Dashboard Demo — ' + (industry || 'General');

  // 1. Save to Lead Magnets CRM (source tracking)
  try {
    await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Table%201`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          Email: email,
          Fuente: fuenteFinal,
          Fecha: today,
        }
      })
    });
  } catch (e) {
    console.log('Lead Magnets CRM error:', e.message);
  }

  // 2. Save to Smartflow CRM principal
  const CRM_BASE = 'appfVdBeWxKnviswd';
  const CRM_TABLE = 'tbl0uPz9tlIlRV3Rv';
  try {
    await fetch(`https://api.airtable.com/v0/${CRM_BASE}/${CRM_TABLE}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          Email: email,
          Fuente: fuenteFinal,
          Industria: industry || '',
          'Lead Magnet': fuenteFinal,
          Etapa: 'Nuevo',
          Temperatura: '❄️ Frío',
          'Fecha de Entrada': today,
        }
      })
    });
  } catch (e) {
    console.log('Smartflow CRM error:', e.message);
  }

  // 3. Save full audit data if present
  const AUDITS_TABLE = 'tbltoSbKOG96uHJ3i';
  if (req.body.auditData) {
    const a = req.body.auditData;
    try {
      await fetch(`https://api.airtable.com/v0/${CRM_BASE}/${AUDITS_TABLE}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            Email: email,
            'Score IA': a.score || 0,
            Industria: a.industry || '',
            'Pain Point': a.painPoint || '',
            'Estado Datos': a.dataLabel || '',
            'Tamaño Equipo': a.team || 0,
            'Horas Repetitivas': a.hrs || 0,
            'Costo Hora': a.rate || 0,
            Ingresos: a.revenue || '',
            'Volumen Documentos': a.docVolume || '',
            'Tiempo Sin Resolver': a.timeStuck || '',
            'Apertura IA': a.readyLabel || '',
            'Costo Mensual Recuperable': a.monthlyCost || 0,
            'Horas Automatizables': a.autoHrs || 0,
            'Oferta Recomendada': a.ofertaRecomendada || '',
            Fecha: today,
          }
        })
      });
    } catch (e) {
      console.log('Audits table error:', e.message);
    }
  }

  // Send confirmation email via Resend
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Smartflow <onboarding@resend.dev>',
        to: [email],
        subject: 'Tu dashboard está listo — Smartflow',
        html: `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
<tr><td style="background:#18181b;padding:28px 36px">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="display:inline-block;width:28px;height:28px;background:#2563eb;border-radius:7px;text-align:center;line-height:28px;color:#fff;font-size:14px;font-weight:700;margin-right:8px">S</span><span style="font-family:Georgia,serif;font-size:18px;color:#fafafa;letter-spacing:-0.02em">Smartflow</span></td>
<td align="right" style="font-size:11px;color:rgba(250,250,250,0.4);letter-spacing:0.1em;text-transform:uppercase">Dashboard</td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 36px 28px">
<p style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;font-weight:600;margin:0 0 12px">Acceso activado</p>
<h1 style="font-family:Georgia,serif;font-size:26px;color:#18181b;margin:0 0 12px;line-height:1.2;letter-spacing:-0.02em;font-weight:400">Tu dashboard está<br>generándose ahora.</h1>
<p style="font-size:14px;color:#71717a;line-height:1.65;margin:0 0 28px;font-weight:300">Vuelve a la página para ver tu análisis completo con KPIs, gráficos y el análisis estratégico generado por IA.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
<tr><td align="center"><a href="https://smartflow-dashboard.vercel.app" style="display:inline-block;padding:14px 36px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:50px;font-size:15px;font-weight:600">Ver mi dashboard →</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e4e4e7;padding-top:20px">
<p style="font-size:13px;color:#18181b;font-weight:500;margin:0 0 6px">¿Quieres este dashboard con tus datos en tiempo real?</p>
<p style="font-size:13px;color:#71717a;margin:0 0 14px;font-weight:300">Agenda 30 minutos y conectamos todas tus fuentes.</p>
<a href="https://cal.com/smartflow.es/30min?user=smartflow.es" style="display:inline-block;padding:9px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:50px;font-size:13px;font-weight:500">Agendar sesión →</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#fafafa;padding:20px 36px;border-top:1px solid #e4e4e7">
<p style="font-size:11px;color:#a1a1aa;margin:0">Smartflow · Consultoría de IA</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
      })
    });
  } catch (e) {
    console.log('Resend error:', e.message);
  }

  return res.status(200).json({ success: true });
}
