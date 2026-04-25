const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { requireSalon } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => { const dir = path.join(__dirname, '../../public/images/salons'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); cb(null, dir); },
  filename: (req, file, cb) => { cb(null, `salon-${req.session.salonId}-${Date.now()}${path.extname(file.originalname)}`); }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../../views/dashboard/login.html')));

router.post('/login', async (req, res) => {
  const { email, mot_de_passe } = req.body;
  const salon = db.prepare('SELECT * FROM salons WHERE email = ? AND actif = 1').get(email);
  if (!salon) return res.json({ error: 'Email ou mot de passe incorrect' });
  const ok = await bcrypt.compare(mot_de_passe, salon.mot_de_passe);
  if (!ok) return res.json({ error: 'Email ou mot de passe incorrect' });
  req.session.salonId = salon.id; req.session.salonSlug = salon.slug;
  res.json({ success: true });
});

router.post('/logout', (req, res) => { req.session.destroy(); res.redirect('/dashboard/login'); });
router.get('/', requireSalon, (req, res) => res.sendFile(path.join(__dirname, '../../views/dashboard/index.html')));

router.get('/api/salon', requireSalon, (req, res) => {
  const salon = db.prepare('SELECT id, slug, nom, adresse, email, telephone, photo, horaires, actif FROM salons WHERE id = ?').get(req.session.salonId);
  salon.horaires = JSON.parse(salon.horaires); res.json(salon);
});

router.get('/api/reservations', requireSalon, (req, res) => {
  const { periode } = req.query; let dateFilter = '';
  const today = new Date().toISOString().split('T')[0];
  if (periode === 'jour') dateFilter = `AND r.date = '${today}'`;
  else if (periode === 'semaine') { const fin = new Date(); fin.setDate(fin.getDate()+7); dateFilter = `AND r.date >= '${today}' AND r.date <= '${fin.toISOString().split('T')[0]}'`; }
  else if (periode === 'mois') { const fin = new Date(); fin.setDate(fin.getDate()+30); dateFilter = `AND r.date >= '${today}' AND r.date <= '${fin.toISOString().split('T')[0]}'`; }
  const reservations = db.prepare(`SELECT r.*, s.nom as service_nom, s.prix as service_prix, s.duree as service_duree FROM reservations r JOIN services s ON r.service_id = s.id WHERE r.salon_id = ? ${dateFilter} ORDER BY r.date ASC, r.heure ASC`).all(req.session.salonId);
  res.json(reservations);
});

router.get('/api/stats', requireSalon, (req, res) => {
  const salonId = req.session.salonId; const today = new Date().toISOString().split('T')[0];
  res.json({
    rdvAujourdhui: db.prepare("SELECT COUNT(*) as n FROM reservations WHERE salon_id = ? AND date = ? AND statut != 'annulee'").get(salonId, today).n,
    rdvMois: db.prepare("SELECT COUNT(*) as n FROM reservations WHERE salon_id = ? AND date >= date('now','start of month') AND statut != 'annulee'").get(salonId).n,
    revenusMois: db.prepare("SELECT COALESCE(SUM(s.prix), 0) as total FROM reservations r JOIN services s ON r.service_id = s.id WHERE r.salon_id = ? AND r.date >= date('now','start of month') AND r.statut != 'annulee'").get(salonId).total,
    rdvTotal: db.prepare("SELECT COUNT(*) as n FROM reservations WHERE salon_id = ? AND statut != 'annulee'").get(salonId).n
  });
});

router.get('/api/services', requireSalon, (req, res) => res.json(db.prepare('SELECT * FROM services WHERE salon_id = ?').all(req.session.salonId)));
router.post('/api/services', requireSalon, (req, res) => { const { nom, prix, duree } = req.body; if (!nom||!prix||!duree) return res.status(400).json({ error: 'Champs manquants' }); const result = db.prepare('INSERT INTO services (salon_id, nom, prix, duree) VALUES (?, ?, ?, ?)').run(req.session.salonId, nom, parseFloat(prix), parseInt(duree)); res.json({ success: true, id: result.lastInsertRowid }); });
router.put('/api/services/:id', requireSalon, (req, res) => { const { nom, prix, duree } = req.body; db.prepare('UPDATE services SET nom = ?, prix = ?, duree = ? WHERE id = ? AND salon_id = ?').run(nom, parseFloat(prix), parseInt(duree), req.params.id, req.session.salonId); res.json({ success: true }); });
router.delete('/api/services/:id', requireSalon, (req, res) => { db.prepare('DELETE FROM services WHERE id = ? AND salon_id = ?').run(req.params.id, req.session.salonId); res.json({ success: true }); });
router.put('/api/horaires', requireSalon, (req, res) => { db.prepare('UPDATE salons SET horaires = ? WHERE id = ?').run(JSON.stringify(req.body.horaires), req.session.salonId); res.json({ success: true }); });
router.put('/api/profil', requireSalon, (req, res) => { const { nom, adresse, telephone } = req.body; db.prepare('UPDATE salons SET nom = ?, adresse = ?, telephone = ? WHERE id = ?').run(nom, adresse, telephone, req.session.salonId); res.json({ success: true }); });
router.post('/api/photo', requireSalon, upload.single('photo'), (req, res) => { if (!req.file) return res.status(400).json({ error: 'Aucun fichier' }); const url = `/images/salons/${req.file.filename}`; db.prepare('UPDATE salons SET photo = ? WHERE id = ?').run(url, req.session.salonId); res.json({ success: true, url }); });
router.get('/api/fermetures', requireSalon, (req, res) => res.json(db.prepare('SELECT * FROM jours_fermeture WHERE salon_id = ?').all(req.session.salonId)));
router.post('/api/fermetures', requireSalon, (req, res) => { try { db.prepare('INSERT INTO jours_fermeture (salon_id, date) VALUES (?, ?)').run(req.session.salonId, req.body.date); res.json({ success: true }); } catch { res.status(409).json({ error: 'Date déjà ajoutée' }); } });
router.delete('/api/fermetures/:date', requireSalon, (req, res) => { db.prepare('DELETE FROM jours_fermeture WHERE salon_id = ? AND date = ?').run(req.session.salonId, req.params.date); res.json({ success: true }); });
router.put('/api/reservations/:id/annuler', requireSalon, (req, res) => { db.prepare("UPDATE reservations SET statut = 'annulee' WHERE id = ? AND salon_id = ?").run(req.params.id, req.session.salonId); res.json({ success: true }); });

module.exports = router;
