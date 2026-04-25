const express = require('express');
const router = express.Router();
const { db } = require('../database');

let stripe;
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

router.post('/create-checkout', async (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).json({ error: 'Stripe non configuré' });
  const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(req.body.salon_id);
  if (!salon) return res.status(404).json({ error: 'Salon non trouvé' });
  try {
    const session = await s.checkout.sessions.create({
      payment_method_types: ['card'], mode: 'subscription',
      line_items: [{ price_data: { currency: 'eur', product_data: { name: 'ResaCoiff — Abonnement mensuel' }, unit_amount: 2900, recurring: { interval: 'month' } }, quantity: 1 }],
      customer_email: salon.email, metadata: { salon_id: salon.id.toString() },
      success_url: `${process.env.APP_URL||'http://localhost:3000'}/dashboard?paiement=ok`,
      cancel_url: `${process.env.APP_URL||'http://localhost:3000'}/dashboard?paiement=annule`
    });
    res.json({ url: session.url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const s = getStripe();
  if (!s) return res.status(503).send('Stripe non configuré');
  let event;
  try { event = s.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch (e) { return res.status(400).send(`Webhook error: ${e.message}`); }
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object; const salonId = sub.metadata?.salon_id;
    if (salonId) db.prepare('UPDATE salons SET stripe_subscription_id = ?, actif = ? WHERE id = ?').run(sub.id, sub.status==='active'?1:0, salonId);
  }
  if (event.type === 'customer.subscription.deleted') {
    const salonId = event.data.object.metadata?.salon_id;
    if (salonId) db.prepare('UPDATE salons SET actif = 0 WHERE id = ?').run(salonId);
  }
  res.json({ received: true });
});

module.exports = router;
