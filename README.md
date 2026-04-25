# ResaCoiff

SaaS multi-tenant de réservation en ligne pour coiffeurs et barbiers.

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Copier et configurer les variables d'environnement
cp .env.example .env
# Éditez .env avec vos valeurs

# 3. Lancer le serveur
npm start
```

Accès : http://localhost:3000

## Comptes de test

| Rôle | URL | Email | Mot de passe |
|------|-----|-------|--------------|
| Admin | /admin | admin@resacoiff.fr | admin123 |
| Coiffeur démo | /dashboard | demo@elegance.fr | demo123 |
| Vitrine démo | /demo-salon | — | — |

## Déploiement sur Railway

1. Créez un compte sur [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Connectez ce dépôt
4. Ajoutez les variables d'environnement (voir `.env.example`)
5. Railway déploie automatiquement

## Structure

```
ResaCoiff/
├── server.js              # Point d'entrée Express
├── src/
│   ├── database.js        # SQLite + seed
│   ├── routes/
│   │   ├── salon.js       # Vitrine + API réservations
│   │   ├── dashboard.js   # Dashboard coiffeur
│   │   ├── admin.js       # Panel admin
│   │   └── stripe.js      # Webhooks Stripe
│   ├── middleware/
│   │   └── auth.js        # Authentification sessions
│   └── utils/
│       └── email.js       # Nodemailer
├── views/                 # HTML pages
├── public/                # CSS, JS, images
└── data/                  # SQLite (créé automatiquement)
```

## Variables d'environnement

Voir `.env.example` pour la liste complète et documentée.
