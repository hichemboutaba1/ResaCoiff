const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const path = require('path');
const { db } = require('../database');
const { requireAdmin } = require('../middleware/auth');

router.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../../views/admin/login.html')));

router.post('/login', async (req, res) => {
  const { email, mot_de_passe } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  if (!admin) return res.json({ error: 'Identifiants incorrects' });
  const ok = await bcrypt.compare(mot_de_passe, admin.mot_de_passe);
  if (!ok) return res.json({ error: 'Identifiants incorrects' });
  req.session.isAdmin = true; req.session.adminId = admin.id;
  res.json({ success: true });
});

router.post('/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });
router.get('/', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '../../views/admin/index.html')));

router.get('/api/salons', requireAdmin, (req, res) => {
  res.json(db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM reservations r WHERE r.salon_id = s.id AND r.statut != 'annulee') as total_resa, (SELECT COUNT(*) FROM reservations r WHERE r.salon_id = s.id AND r.date = date('now') AND r.statut != 'annulee') as resa_today FROM salons s ORDER BY s.created_at DESC`).all());
});

router.put('/api/salons/:id/toggle', requireAdmin, (req, res) => {
  const salon = db.prepare('SELECT actif FROM salons WHERE id = ?').get(req.params.id);
  if (!salon) return res.status(404).json({ error: 'Salon non trouvé' });
  db.prepare('UPDATE salons SET actif = ? WHERE id = ?').run(salon.actif ? 0 : 1, req.params.id);
  res.json({ success: true, actif: !salon.actif });
});

router.post('/api/salons', requireAdmin, async (req, res) => {
  const { slug, nom, adresse, email, telephone, mot_de_passe } = req.body;
  if (!slug||!nom||!email||!mot_de_passe) return res.status(400).json({ error: 'Champs manquants' });
  const exists = db.prepare('SELECT id FROM salons WHERE slug = ? OR email = ?').get(slug, email);
  if (exists) return res.status(409).json({ error: 'Slug ou email déjà utilisé' });
  const hash = await bcrypt.hash(mot_de_passe, 10);
  const result = db.prepare('INSERT INTO salons (slug, nom, adresse, email, telephone, mot_de_passe, actif) VALUES (?, ?, ?, ?, ?, ?, 1)').run(slug, nom, adresse||'', email, telephone||'', hash);
  res.json({ success: true, id: result.lastInsertRowid });
});

router.get('/api/stats', requireAdmin, (req, res) => {
  res.json({
    totalSalons: db.prepare('SELECT COUNT(*) as n FROM salons').get().n,
    salonsActifs: db.prepare('SELECT COUNT(*) as n FROM salons WHERE actif = 1').get().n,
    totalResa: db.prepare("SELECT COUNT(*) as n FROM reservations WHERE statut != 'annulee'").get().n,
    resaAujourdhui: db.prepare("SELECT COUNT(*) as n FROM reservations WHERE date = date('now') AND statut != 'annulee'").get().n
  });
});

router.delete('/api/salons/:id', requireAdmin, (req, res) => { db.prepare('DELETE FROM salons WHERE id = ?').run(req.params.id); res.json({ success: true }); });

module.exports = router;
