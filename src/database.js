const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'resacoiff.db');

const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

async function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS salons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      nom TEXT NOT NULL,
      adresse TEXT,
      email TEXT NOT NULL,
      telephone TEXT,
      photo TEXT DEFAULT '/images/default-salon.jpg',
      horaires TEXT DEFAULT '{"lun":"09:00-19:00","mar":"09:00-19:00","mer":"09:00-19:00","jeu":"09:00-19:00","ven":"09:00-19:00","sam":"09:00-18:00","dim":""}',
      mot_de_passe TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      actif INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id INTEGER NOT NULL,
      nom TEXT NOT NULL,
      prix REAL NOT NULL,
      duree INTEGER NOT NULL,
      FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      client_nom TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_tel TEXT,
      date TEXT NOT NULL,
      heure TEXT NOT NULL,
      statut TEXT DEFAULT 'confirmee',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS jours_fermeture (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salon_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      mot_de_passe TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await seedData();
}

async function seedData() {
  const adminExists = db.prepare('SELECT id FROM admins WHERE email = ?').get('admin@resacoiff.fr');
  if (!adminExists) {
    const hash = await bcrypt.hash('admin123', 10);
    db.prepare('INSERT INTO admins (email, mot_de_passe) VALUES (?, ?)').run('admin@resacoiff.fr', hash);
    console.log('✓ Admin créé : admin@resacoiff.fr / admin123');
  }

  const salonExists = db.prepare('SELECT id FROM salons WHERE slug = ?').get('demo-salon');
  if (!salonExists) {
    const hash = await bcrypt.hash('demo123', 10);
    const result = db.prepare(`
      INSERT INTO salons (slug, nom, adresse, email, telephone, photo, horaires, mot_de_passe, actif)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      'demo-salon', 'Salon Élégance', '12 rue de la Paix, 75001 Paris',
      'demo@elegance.fr', '01 23 45 67 89', '/images/default-salon.jpg',
      JSON.stringify({ lun:'09:00-19:00', mar:'09:00-19:00', mer:'09:00-19:00', jeu:'09:00-19:00', ven:'09:00-19:00', sam:'09:00-18:00', dim:'' }),
      hash
    );
    const salonId = result.lastInsertRowid;
    const services = [
      { nom: 'Coupe homme', prix: 25, duree: 30 },
      { nom: 'Coupe femme', prix: 45, duree: 60 },
      { nom: 'Barbe', prix: 15, duree: 20 }
    ];
    const insertService = db.prepare('INSERT INTO services (salon_id, nom, prix, duree) VALUES (?, ?, ?, ?)');
    const serviceIds = services.map(s => insertService.run(salonId, s.nom, s.prix, s.duree).lastInsertRowid);
    const insertResa = db.prepare(`INSERT INTO reservations (salon_id, service_id, client_nom, client_email, client_tel, date, heure, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const today = new Date();
    [
      { nom:'Jean Dupont',   email:'jean@example.fr',   tel:'06 11 22 33 44', j:0,  h:'10:00', s:0 },
      { nom:'Marie Martin',  email:'marie@example.fr',  tel:'06 55 66 77 88', j:0,  h:'14:30', s:1 },
      { nom:'Ahmed Bensaid', email:'ahmed@example.fr',  tel:'06 99 00 11 22', j:1,  h:'11:00', s:2 },
      { nom:'Sophie Leroy',  email:'sophie@example.fr', tel:'06 33 44 55 66', j:2,  h:'15:00', s:1 },
      { nom:'Lucas Petit',   email:'lucas@example.fr',  tel:'06 77 88 99 00', j:-1, h:'09:30', s:0 }
    ].forEach(r => {
      const d = new Date(today); d.setDate(d.getDate() + r.j);
      insertResa.run(salonId, serviceIds[r.s], r.nom, r.email, r.tel, d.toISOString().split('T')[0], r.h, 'confirmee');
    });
    console.log('✓ Salon de démo créé : /demo-salon (demo@elegance.fr / demo123)');
  }
}

module.exports = { db, init };
