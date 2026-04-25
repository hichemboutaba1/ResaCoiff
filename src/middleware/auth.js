function requireSalon(req, res, next) {
  if (req.session && req.session.salonId) return next();
  res.redirect('/dashboard/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login');
}

module.exports = { requireSalon, requireAdmin };
