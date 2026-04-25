require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const { init } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe webhook doit être avant express.json (besoin du raw body)
const stripeRouter = require('./src/routes/stripe');
app.use('/stripe', stripeRouter);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sessions
const SQLiteStore = require('connect-sqlite3')(session);
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './data' }),
  secret: process.env.SESSION_SECRET || 'resacoiff-secret-dev-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Routes
app.use('/dashboard', require('./src/routes/dashboard'));
app.use('/admin', require('./src/routes/admin'));

// Page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

// Salons (en dernier pour ne pas intercepter les routes fixes)
app.use('/', require('./src/routes/salon'));

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'views/404.html'));
});

// Init DB puis démarrage
init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 ResaCoiff démarré sur http://localhost:${PORT}`);
    console.log(`   → Accueil     : http://localhost:${PORT}/`);
    console.log(`   → Démo salon  : http://localhost:${PORT}/demo-salon`);
    console.log(`   → Dashboard   : http://localhost:${PORT}/dashboard`);
    console.log(`   → Admin       : http://localhost:${PORT}/admin\n`);
  });
});
