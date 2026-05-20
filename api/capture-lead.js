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

  // Build email content based on source
  const emailConfigs = {
    'Dashboard Demo': {
      subject: 'Tu dashboard está listo — Smartflow',
      brand: 'Smartflow',
      accentColor: '#2563eb',
      badge: 'Dashboard',
      headline: 'Tu dashboard está<br>generándose ahora.',
      body: 'Vuelve a la página para ver tu análisis completo con KPIs, gráficos y el análisis estratégico generado por IA.',
      ctaText: 'Ver mi dashboard →',
      ctaUrl: 'https://smartflow-dashboard.vercel.app',
      ctaTitle: '¿Quieres este dashboard con tus datos en tiempo real?',
      ctaBody: 'Agenda 30 minutos y conectamos todas tus fuentes.',
      ctaBtn: 'Agendar sesión →',
      ctaBtnUrl: 'https://cal.com/smartflow.es/30min?user=smartflow.es',
      footer: 'Smartflow · Consultoría de IA',
    },
    'Calculadora Inmobiliaria': {
      subject: 'Tu análisis de leads perdidos está listo — Smartflow',
      brand: 'Smartflow',
      accentColor: '#2563eb',
      badge: 'Calculadora',
      headline: 'Tu análisis está<br>listo para verlo.',
      body: 'Vuelve a la página para ver el desglose completo de comisiones perdidas, el embudo comparativo y el plan de acción personalizado para tu agencia.',
      ctaText: 'Ver mi análisis →',
      ctaUrl: 'https://smartflow-inmo.vercel.app',
      ctaTitle: '¿Quieres recuperar esas comisiones?',
      ctaBody: 'Agenda 30 minutos y te mostramos exactamente cómo hacerlo.',
      ctaBtn: 'Descubre cómo recuperarlas →',
      ctaBtnUrl: 'https://cal.com/smartflow.es/30min?user=smartflow.es',
      footer: 'Smartflow · Consultoría de IA',
    },
    'AI Readiness Audit': {
      subject: 'Tu diagnóstico de IA está listo — Smartflow',
      brand: 'Smartflow',
      accentColor: '#2563eb',
      badge: 'Audit IA',
      headline: 'Tu diagnóstico<br>está generándose.',
      body: 'Vuelve a la página para ver tu AI Readiness Score, el análisis ejecutivo y la solución recomendada para tu empresa.',
      ctaText: 'Ver mi diagnóstico →',
      ctaUrl: 'https://smartflow-audit.vercel.app',
      ctaTitle: '¿Listo para actuar sobre tus resultados?',
      ctaBody: 'Agenda una sesión estratégica gratuita de 30 minutos.',
      ctaBtn: 'Reservar sesión →',
      ctaBtnUrl: 'https://cal.com/smartflow.es/30min?user=smartflow.es',
      footer: 'Smartflow · Consultoría de IA',
    },
    'Informe Inmobiliario': {
      subject: 'Tu informe inmobiliario 2025 está desbloqueado — Smartflow',
      brand: 'Smartflow',
      accentColor: '#2563eb',
      badge: 'Informe',
      headline: 'Tu informe<br>está desbloqueado.',
      body: 'Vuelve a la página para acceder a las 6 secciones completas del Informe Inmobiliario 2025 con datos de mercado y estrategias de captación con IA.',
      ctaText: 'Leer el informe →',
      ctaUrl: 'https://smartflow-informe.vercel.app',
      ctaTitle: '¿Quieres implementar estas estrategias en tu agencia?',
      ctaBody: 'Agenda 30 minutos y te mostramos cómo aplicarlas.',
      ctaBtn: 'Agendar sesión →',
      ctaBtnUrl: 'https://cal.com/smartflow.es/30min?user=smartflow.es',
      footer: 'Smartflow · Consultoría de IA',
    },
    'Operations Cost Calculator': {
      subject: 'Tu análisis de costos operativos está listo — Pranical',
      brand: 'Pranical',
      accentColor: '#4ABFA3',
      badge: 'Análisis',
      headline: 'Tu análisis de costos<br>está listo.',
      body: 'Vuelve a la página para ver el desglose completo, el período de recuperación y el análisis personalizado para tu equipo de operaciones.',
      ctaText: 'Ver mi análisis →',
      ctaUrl: 'https://pranical.com/contacto',
      ctaTitle: '¿Quieres saber si tu número es normal?',
      ctaBody: 'Una llamada de 20 minutos con nuestro equipo te dará contexto real.',
      ctaBtn: 'Hablar con el equipo →',
      ctaBtnUrl: 'https://pranical.com/contacto',
      footer: 'Pranical Technologies · Transformación Digital',
    },
  };

  // Match source to config
  const srcKey = Object.keys(emailConfigs).find(k => fuenteFinal.includes(k)) || 'Dashboard Demo';
  const cfg = emailConfigs[srcKey];

  const emailHtml = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
<tr><td style="background:#18181b;padding:28px 36px">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="display:inline-block;width:28px;height:28px;background:${cfg.accentColor};border-radius:7px;text-align:center;line-height:28px;color:#fff;font-size:14px;font-weight:700;margin-right:8px">${cfg.brand[0]}</span><span style="font-family:Georgia,serif;font-size:18px;color:#fafafa;letter-spacing:-0.02em">${cfg.brand}</span></td>
<td align="right" style="font-size:11px;color:rgba(250,250,250,0.4);letter-spacing:0.1em;text-transform:uppercase">${cfg.badge}</td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 36px 28px">
<p style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${cfg.accentColor};font-weight:600;margin:0 0 12px">Listo para ti</p>
<h1 style="font-family:Georgia,serif;font-size:26px;color:#18181b;margin:0 0 12px;line-height:1.2;letter-spacing:-0.02em;font-weight:400">${cfg.headline}</h1>
<p style="font-size:14px;color:#71717a;line-height:1.65;margin:0 0 28px;font-weight:300">${cfg.body}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
<tr><td align="center"><a href="${cfg.ctaUrl}" style="display:inline-block;padding:14px 36px;background:${cfg.accentColor};color:#ffffff;text-decoration:none;border-radius:50px;font-size:15px;font-weight:600">${cfg.ctaText}</a></td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e4e4e7;padding-top:20px">
<p style="font-size:13px;color:#18181b;font-weight:500;margin:0 0 6px">${cfg.ctaTitle}</p>
<p style="font-size:13px;color:#71717a;margin:0 0 14px;font-weight:300">${cfg.ctaBody}</p>
<a href="${cfg.ctaBtnUrl}" style="display:inline-block;padding:9px 20px;background:#18181b;color:#fff;text-decoration:none;border-radius:50px;font-size:13px;font-weight:500">${cfg.ctaBtn}</a>
</td></tr></table>
</td></tr>
<tr><td style="background:#fafafa;padding:20px 36px;border-top:1px solid #e4e4e7">
<p style="font-size:11px;color:#a1a1aa;margin:0">${cfg.footer}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  // Send confirmation email via Resend
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${cfg.brand} <onboarding@resend.dev>`,
        to: [email],
        subject: cfg.subject,
        html: emailHtml,
      })
    });
  } catch (e) {
    console.log('Resend error:', e.message);
  }

  return res.status(200).json({ success: true });
}
