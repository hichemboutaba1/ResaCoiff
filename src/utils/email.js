const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

async function sendConfirmationClient(reservation, service, salon) {
  if (!process.env.SMTP_USER) return;
  await createTransporter().sendMail({
    from: `"ResaCoiff" <${process.env.SMTP_USER}>`,
    to: reservation.client_email,
    subject: `Confirmation de votre RDV - ${salon.nom}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a1a;padding:20px;text-align:center"><h1 style="color:#C9A84C;margin:0">ResaCoiff</h1></div><div style="padding:30px;background:#fff;border:1px solid #eee"><h2>Votre réservation est confirmée ✓</h2><p>Bonjour <strong>${reservation.client_nom}</strong>,</p><table style="width:100%;border-collapse:collapse;margin:20px 0"><tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><strong>Salon</strong></td><td style="padding:10px;border:1px solid #eee">${salon.nom}</td></tr><tr><td style="padding:10px;border:1px solid #eee"><strong>Service</strong></td><td style="padding:10px;border:1px solid #eee">${service.nom} — ${service.prix}€</td></tr><tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><strong>Date</strong></td><td style="padding:10px;border:1px solid #eee">${reservation.date}</td></tr><tr><td style="padding:10px;border:1px solid #eee"><strong>Heure</strong></td><td style="padding:10px;border:1px solid #eee">${reservation.heure}</td></tr><tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><strong>Adresse</strong></td><td style="padding:10px;border:1px solid #eee">${salon.adresse}</td></tr></table><p style="color:#666;font-size:13px">Pour annuler, contactez le salon : ${salon.telephone}</p></div></div>`
  });
}

async function sendNotificationSalon(reservation, service, salon) {
  if (!process.env.SMTP_USER) return;
  await createTransporter().sendMail({
    from: `"ResaCoiff" <${process.env.SMTP_USER}>`,
    to: salon.email,
    subject: `Nouveau RDV — ${reservation.client_nom} — ${reservation.date} ${reservation.heure}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1a1a;padding:20px;text-align:center"><h1 style="color:#C9A84C;margin:0">ResaCoiff</h1></div><div style="padding:30px;background:#fff;border:1px solid #eee"><h2>Nouveau rendez-vous !</h2><table style="width:100%;border-collapse:collapse;margin:20px 0"><tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><strong>Client</strong></td><td style="padding:10px;border:1px solid #eee">${reservation.client_nom}</td></tr><tr><td style="padding:10px;border:1px solid #eee"><strong>Email</strong></td><td style="padding:10px;border:1px solid #eee">${reservation.client_email}</td></tr><tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><strong>Téléphone</strong></td><td style="padding:10px;border:1px solid #eee">${reservation.client_tel || '-'}</td></tr><tr><td style="padding:10px;border:1px solid #eee"><strong>Service</strong></td><td style="padding:10px;border:1px solid #eee">${service.nom}</td></tr><tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><strong>Date</strong></td><td style="padding:10px;border:1px solid #eee">${reservation.date}</td></tr><tr><td style="padding:10px;border:1px solid #eee"><strong>Heure</strong></td><td style="padding:10px;border:1px solid #eee">${reservation.heure}</td></tr></table></div></div>`
  });
}

module.exports = { sendConfirmationClient, sendNotificationSalon };
