const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { sendConfirmationClient, sendNotificationSalon } = require('../utils/email');

router.get('/:slug', (req, res) => {
  const salon = db.prepare('SELECT * FROM salons WHERE slug = ? AND actif = 1').get(req.params.slug);
  if (!salon) return res.status(404).sendFile(require('path').join(__dirname, '../../views/404.html'));
  res.sendFile(require('path').join(__dirname, '../../views/salon/vitrine.html'));
});

router.get('/:slug/api/info', (req, res) => {
  const salon = db.prepare('SELECT * FROM salons WHERE slug = ? AND actif = 1').get(req.params.slug);
  if (!salon) return res.status(404).json({ error: 'Salon non trouvé' });
  const services = db.prepare('SELECT * FROM services WHERE salon_id = ?').all(salon.id);
  const fermetures = db.prepare('SELECT date FROM jours_fermeture WHERE salon_id = ?').all(salon.id).map(f => f.date);
  res.json({ id: salon.id, slug: salon.slug, nom: salon.nom, adresse: salon.adresse, telephone: salon.telephone, photo: salon.photo, horaires: JSON.parse(salon.horaires), services, fermetures });
});

router.get('/:slug/api/creneaux', (req, res) => {
  const { date, service_id } = req.query;
  if (!date || !service_id) return res.status(400).json({ error: 'Paramètres manquants' });
  const salon = db.prepare('SELECT * FROM salons WHERE slug = ? AND actif = 1').get(req.params.slug);
  if (!salon) return res.status(404).json({ error: 'Salon non trouvé' });
  const ferme = db.prepare('SELECT id FROM jours_fermeture WHERE salon_id = ? AND date = ?').get(salon.id, date);
  if (ferme) return res.json({ creneaux: [] });
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND salon_id = ?').get(service_id, salon.id);
  if (!service) return res.status(404).json({ error: 'Service non trouvé' });
  const horaires = JSON.parse(salon.horaires);
  const joursMap = ['dim','lun','mar','mer','jeu','ven','sam'];
  const plage = horaires[joursMap[new Date(date).getDay()]];
  if (!plage) return res.json({ creneaux: [] });
  const [debut, fin] = plage.split('-');
  const creneauxPossibles = genererCreneaux(debut, fin, service.duree);
  const resasDuJour = db.prepare('SELECT r.heure, s.duree FROM reservations r JOIN services s ON r.service_id = s.id WHERE r.salon_id = ? AND r.date = ? AND r.statut != ?').all(salon.id, date, 'annulee');
  const creneauxLibres = creneauxPossibles.filter(c => {
    const cMin = heureEnMinutes(c), cFinMin = cMin + service.duree;
    for (const r of resasDuJour) {
      const rMin = heureEnMinutes(r.heure), rFinMin = rMin + r.duree;
      if (cMin < rFinMin && cFinMin > rMin) return false;
    }
    return true;
  });
  res.json({ creneaux: creneauxLibres });
});

router.post('/:slug/reserver', async (req, res) => {
  const { service_id, date, heure, client_nom, client_email, client_tel } = req.body;
  const salon = db.prepare('SELECT * FROM salons WHERE slug = ? AND actif = 1').get(req.params.slug);
  if (!salon) return res.status(404).json({ error: 'Salon non trouvé' });
  const service = db.prepare('SELECT * FROM services WHERE id = ? AND salon_id = ?').get(service_id, salon.id);
  if (!service) return res.status(404).json({ error: 'Service non trouvé' });
  const conflit = db.prepare(`SELECT r.id FROM reservations r JOIN services s ON r.service_id = s.id WHERE r.salon_id = ? AND r.date = ? AND r.statut != 'annulee' AND ((? >= r.heure AND ? < time(r.heure, '+' || s.duree || ' minutes')) OR (time(?, '+' || ? || ' minutes') > r.heure AND ? < r.heure))`).get(salon.id, date, heure, heure, heure, service.duree, heure);
  if (conflit) return res.status(409).json({ error: 'Ce créneau est déjà pris' });
  const result = db.prepare(`INSERT INTO reservations (salon_id, service_id, client_nom, client_email, client_tel, date, heure, statut) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmee')`).run(salon.id, service.id, client_nom, client_email, client_tel || '', date, heure);
  const reservation = { id: result.lastInsertRowid, client_nom, client_email, client_tel, date, heure };
  try { await sendConfirmationClient(reservation, service, salon); await sendNotificationSalon(reservation, service, salon); } catch (e) { console.error('Email non envoyé :', e.message); }
  res.json({ success: true, id: result.lastInsertRowid });
});

function genererCreneaux(debut, fin, dureeMin) {
  const creneaux = []; let current = heureEnMinutes(debut); const finMin = heureEnMinutes(fin);
  while (current + dureeMin <= finMin) { creneaux.push(minutesEnHeure(current)); current += 30; }
  return creneaux;
}
function heureEnMinutes(heure) { const [h, m] = heure.split(':').map(Number); return h * 60 + m; }
function minutesEnHeure(min) { return `${Math.floor(min/60).toString().padStart(2,'0')}:${(min%60).toString().padStart(2,'0')}`; }

module.exports = router;
