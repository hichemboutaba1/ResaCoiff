const JOURS_LABELS = { lun:'Lundi', mar:'Mardi', mer:'Mercredi', jeu:'Jeudi', ven:'Vendredi', sam:'Samedi', dim:'Dimanche' };
const JOURS_ORDER = ['lun','mar','mer','jeu','ven','sam','dim'];
const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

let salon = null;
let currentPage = 'reservations';
let currentPeriode = 'jour';

async function init() {
  salon = await api('/dashboard/api/salon');
  document.getElementById('sidebar-salon-name').textContent = salon.nom;
  navigateTo('reservations');
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); navigateTo(el.dataset.page); });
  });
}

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = { reservations:'Réservations', services:'Services', horaires:'Horaires', fermetures:'Jours de fermeture', stats:'Statistiques', profil:'Mon salon' };
  document.getElementById('page-title').textContent = titles[page] || page;
  document.getElementById('header-actions').innerHTML = '';
  const pages = { reservations: pageReservations, services: pageServices, horaires: pageHoraires, fermetures: pageFermetures, stats: pageStats, profil: pageProfil };
  if (pages[page]) pages[page]();
  if (window.innerWidth < 768) closeSidebar();
}

// ===== RESERVATIONS =====
async function pageReservations() {
  setContent(`
    <div class="filter-bar">
      <button class="filter-btn ${currentPeriode==='jour'?'active':''}" onclick="setFiltre('jour')">Aujourd'hui</button>
      <button class="filter-btn ${currentPeriode==='semaine'?'active':''}" onclick="setFiltre('semaine')">Cette semaine</button>
      <button class="filter-btn ${currentPeriode==='mois'?'active':''}" onclick="setFiltre('mois')">Ce mois</button>
      <button class="filter-btn ${currentPeriode==='tout'?'active':''}" onclick="setFiltre('tout')">Tout</button>
    </div>
    <div id="resa-table"></div>
  `);
  loadReservations();
}

function setFiltre(p) {
  currentPeriode = p;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  loadReservations();
}

async function loadReservations() {
  const resas = await api(`/dashboard/api/reservations?periode=${currentPeriode}`);
  const el = document.getElementById('resa-table');
  if (!resas.length) {
    el.innerHTML = '<div class="empty-state"><div style="font-size:40px">📅</div><p>Aucune réservation pour cette période.</p></div>';
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Client</th><th>Service</th><th>Date</th><th>Heure</th><th>Statut</th><th>Action</th>
        </tr></thead>
        <tbody>
          ${resas.map(r => `
            <tr>
              <td>
                <strong>${r.client_nom}</strong>
                <div style="font-size:12px;color:var(--gris)">${r.client_email}</div>
                ${r.client_tel ? `<div style="font-size:12px;color:var(--gris)">${r.client_tel}</div>` : ''}
              </td>
              <td>
                <strong>${r.service_nom}</strong>
                <div style="font-size:12px;color:var(--gris)">${r.service_prix}€ · ${r.service_duree} min</div>
              </td>
              <td>${formatDate(r.date)}</td>
              <td><strong>${r.heure}</strong></td>
              <td>${badgeStatut(r.statut)}</td>
              <td>
                ${r.statut !== 'annulee' ? `<button class="btn btn-danger btn-sm" onclick="annulerResa(${r.id})">Annuler</button>` : '—'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function annulerResa(id) {
  if (!confirm('Annuler ce rendez-vous ?')) return;
  await api(`/dashboard/api/reservations/${id}/annuler`, 'PUT');
  loadReservations();
}

// ===== SERVICES =====
async function pageServices() {
  document.getElementById('header-actions').innerHTML = `<button class="btn btn-or btn-sm" onclick="openServiceModal()">+ Ajouter</button>`;
  const services = await api('/dashboard/api/services');
  const html = !services.length
    ? '<div class="empty-state"><div style="font-size:40px">✂️</div><p>Aucun service. Ajoutez votre premier service.</p></div>'
    : `<div class="services-list">${services.map(s => `
        <div class="service-row">
          <div class="service-info">
            <h3>${s.nom}</h3>
            <p>Durée : ${s.duree} min</p>
          </div>
          <span class="service-prix-tag">${s.prix}€</span>
          <div class="service-actions">
            <button class="btn btn-outline btn-sm" onclick="openServiceModal(${s.id},'${esc(s.nom)}',${s.prix},${s.duree})">Modifier</button>
            <button class="btn btn-danger btn-sm" onclick="deleteService(${s.id})">Suppr.</button>
          </div>
        </div>
      `).join('')}</div>`;
  setContent(html);

  setContent(`
    ${html}
    <div class="modal-bg" id="modal-service">
      <div class="modal-box">
        <button class="modal-close" onclick="closeModal('modal-service')">✕</button>
        <div class="modal-title" id="modal-service-title">Ajouter un service</div>
        <input type="hidden" id="service-edit-id">
        <div class="form-group"><label>Nom du service</label><input type="text" id="service-nom" placeholder="Ex: Coupe homme"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group"><label>Prix (€)</label><input type="number" id="service-prix" placeholder="25" min="0" step="0.5"></div>
          <div class="form-group"><label>Durée (min)</label><input type="number" id="service-duree" placeholder="30" min="10" step="5"></div>
        </div>
        <div id="service-error" class="alert alert-error" style="display:none"></div>
        <div class="modal-actions">
          <button class="btn btn-outline btn-sm" onclick="closeModal('modal-service')">Annuler</button>
          <button class="btn btn-or btn-sm" onclick="saveService()">Enregistrer</button>
        </div>
      </div>
    </div>
  `);
}

function openServiceModal(id, nom, prix, duree) {
  document.getElementById('service-edit-id').value = id || '';
  document.getElementById('service-nom').value = nom || '';
  document.getElementById('service-prix').value = prix || '';
  document.getElementById('service-duree').value = duree || '';
  document.getElementById('modal-service-title').textContent = id ? 'Modifier le service' : 'Ajouter un service';
  document.getElementById('service-error').style.display = 'none';
  openModal('modal-service');
}

async function saveService() {
  const id = document.getElementById('service-edit-id').value;
  const nom = document.getElementById('service-nom').value.trim();
  const prix = document.getElementById('service-prix').value;
  const duree = document.getElementById('service-duree').value;
  const err = document.getElementById('service-error');
  if (!nom || !prix || !duree) { err.textContent = 'Tous les champs sont requis.'; err.style.display = 'block'; return; }

  if (id) await api(`/dashboard/api/services/${id}`, 'PUT', { nom, prix, duree });
  else await api('/dashboard/api/services', 'POST', { nom, prix, duree });

  closeModal('modal-service');
  pageServices();
}

async function deleteService(id) {
  if (!confirm('Supprimer ce service ?')) return;
  await api(`/dashboard/api/services/${id}`, 'DELETE');
  pageServices();
}

// ===== HORAIRES =====
async function pageHoraires() {
  const h = salon.horaires;
  let rows = JOURS_ORDER.map(j => {
    const plage = h[j] || '';
    const ferme = !plage;
    const [debut, fin] = plage ? plage.split('-') : ['09:00', '19:00'];
    return `
      <div class="heure-row" id="row-${j}">
        <label>${JOURS_LABELS[j]}</label>
        <div class="heure-inputs">
          <input type="time" id="debut-${j}" value="${debut}" ${ferme ? 'disabled' : ''}>
          <span>—</span>
          <input type="time" id="fin-${j}" value="${fin}" ${ferme ? 'disabled' : ''}>
          <label class="heure-closed">
            <input type="checkbox" id="ferme-${j}" ${ferme ? 'checked' : ''} onchange="toggleJour('${j}')">
            Fermé
          </label>
        </div>
      </div>
    `;
  }).join('');

  setContent(`
    <div class="card" style="max-width:600px">
      <div class="horaires-grid">${rows}</div>
      <div style="margin-top:20px">
        <button class="btn btn-or" onclick="saveHoraires()">Enregistrer les horaires</button>
      </div>
      <div id="horaires-msg" style="margin-top:12px"></div>
    </div>
  `);
}

function toggleJour(j) {
  const ferme = document.getElementById(`ferme-${j}`).checked;
  document.getElementById(`debut-${j}`).disabled = ferme;
  document.getElementById(`fin-${j}`).disabled = ferme;
}

async function saveHoraires() {
  const horaires = {};
  JOURS_ORDER.forEach(j => {
    const ferme = document.getElementById(`ferme-${j}`).checked;
    if (ferme) { horaires[j] = ''; }
    else {
      const debut = document.getElementById(`debut-${j}`).value;
      const fin = document.getElementById(`fin-${j}`).value;
      horaires[j] = `${debut}-${fin}`;
    }
  });

  await api('/dashboard/api/horaires', 'PUT', { horaires });
  salon.horaires = horaires;
  const msg = document.getElementById('horaires-msg');
  msg.innerHTML = '<div class="alert alert-success">Horaires enregistrés !</div>';
  setTimeout(() => msg.innerHTML = '', 3000);
}

// ===== FERMETURES =====
async function pageFermetures() {
  document.getElementById('header-actions').innerHTML = '';
  setContent(`
    <div class="card" style="max-width:500px">
      <h3 style="margin-bottom:16px">Ajouter un jour de fermeture</h3>
      <div style="display:flex;gap:10px;align-items:flex-end">
        <div class="form-group" style="flex:1;margin:0">
          <label>Date</label>
          <input type="date" id="input-fermeture">
        </div>
        <button class="btn btn-or" onclick="addFermeture()">Ajouter</button>
      </div>
      <div id="fermetures-error" class="alert alert-error" style="display:none;margin-top:12px"></div>
      <h3 style="margin:24px 0 12px">Jours fermés</h3>
      <div id="fermetures-list">Chargement...</div>
    </div>
  `);
  loadFermetures();
}

async function loadFermetures() {
  const items = await api('/dashboard/api/fermetures');
  const el = document.getElementById('fermetures-list');
  if (!items.length) { el.innerHTML = '<p style="color:var(--gris);font-size:14px">Aucun jour de fermeture.</p>'; return; }
  el.innerHTML = `<div class="fermetures-list">${items.map(f => `
    <div class="fermeture-chip">
      ${formatDate(f.date)}
      <button onclick="deleteFermeture('${f.date}')">✕</button>
    </div>
  `).join('')}</div>`;
}

async function addFermeture() {
  const date = document.getElementById('input-fermeture').value;
  const err = document.getElementById('fermetures-error');
  if (!date) { err.textContent = 'Choisissez une date.'; err.style.display = 'block'; return; }
  err.style.display = 'none';
  const res = await api('/dashboard/api/fermetures', 'POST', { date });
  if (res.error) { err.textContent = res.error; err.style.display = 'block'; return; }
  document.getElementById('input-fermeture').value = '';
  loadFermetures();
}

async function deleteFermeture(date) {
  await api(`/dashboard/api/fermetures/${date}`, 'DELETE');
  loadFermetures();
}

// ===== STATS =====
async function pageStats() {
  const stats = await api('/dashboard/api/stats');
  setContent(`
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-label">Aujourd'hui</div>
        <div class="stat-card-value">${stats.rdvAujourdhui}</div>
        <div style="font-size:12px;color:var(--gris);margin-top:4px">rendez-vous</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Ce mois</div>
        <div class="stat-card-value">${stats.rdvMois}</div>
        <div style="font-size:12px;color:var(--gris);margin-top:4px">rendez-vous</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Revenus du mois</div>
        <div class="stat-card-value or">${stats.revenusMois.toFixed(0)}€</div>
        <div style="font-size:12px;color:var(--gris);margin-top:4px">estimés</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Total RDV</div>
        <div class="stat-card-value">${stats.rdvTotal}</div>
        <div style="font-size:12px;color:var(--gris);margin-top:4px">depuis l'ouverture</div>
      </div>
    </div>
    <div class="card" style="max-width:500px">
      <p style="color:var(--gris);font-size:14px">Votre page de réservation :</p>
      <div style="margin-top:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <code style="background:var(--gris-clair);padding:8px 14px;border-radius:8px;font-size:14px">resacoiff.fr/${salon.slug}</code>
        <a href="/${salon.slug}" target="_blank" class="btn btn-or btn-sm">Voir ↗</a>
      </div>
    </div>
  `);
}

// ===== PROFIL =====
async function pageProfil() {
  setContent(`
    <div class="card" style="max-width:640px">
      <h3 style="margin-bottom:20px">Informations du salon</h3>
      <div class="profil-grid">
        <div class="form-group"><label>Nom du salon</label><input type="text" id="p-nom" value="${esc(salon.nom)}"></div>
        <div class="form-group"><label>Téléphone</label><input type="tel" id="p-tel" value="${esc(salon.telephone || '')}"></div>
      </div>
      <div class="form-group"><label>Adresse</label><input type="text" id="p-adresse" value="${esc(salon.adresse || '')}"></div>
      <div id="profil-msg" style="margin-bottom:12px"></div>
      <button class="btn btn-or" onclick="saveProfil()">Enregistrer</button>

      <hr style="margin:28px 0;border:none;border-top:1px solid #e5e7eb">
      <h3 style="margin-bottom:16px">Photo de couverture</h3>
      ${salon.photo ? `<img src="${salon.photo}" style="width:100%;height:160px;object-fit:cover;border-radius:8px;margin-bottom:14px">` : ''}
      <input type="file" id="photo-input" accept="image/*" style="margin-bottom:10px">
      <div id="photo-msg"></div>
      <button class="btn btn-noir btn-sm" onclick="uploadPhoto()" style="margin-top:8px">Changer la photo</button>

      <hr style="margin:28px 0;border:none;border-top:1px solid #e5e7eb">
      <p style="font-size:13px;color:var(--gris)">Votre lien de réservation :</p>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px">
        <code style="background:var(--gris-clair);padding:8px 14px;border-radius:8px;font-size:13px">/${salon.slug}</code>
        <a href="/${salon.slug}" target="_blank" class="btn btn-or btn-sm">Voir ↗</a>
      </div>
    </div>
  `);
}

async function saveProfil() {
  const nom = document.getElementById('p-nom').value.trim();
  const adresse = document.getElementById('p-adresse').value.trim();
  const telephone = document.getElementById('p-tel').value.trim();
  await api('/dashboard/api/profil', 'PUT', { nom, adresse, telephone });
  salon.nom = nom; salon.adresse = adresse; salon.telephone = telephone;
  document.getElementById('sidebar-salon-name').textContent = nom;
  const msg = document.getElementById('profil-msg');
  msg.innerHTML = '<div class="alert alert-success">Profil enregistré !</div>';
  setTimeout(() => msg.innerHTML = '', 3000);
}

async function uploadPhoto() {
  const file = document.getElementById('photo-input').files[0];
  const msg = document.getElementById('photo-msg');
  if (!file) { msg.innerHTML = '<div class="alert alert-error">Choisissez un fichier.</div>'; return; }
  const fd = new FormData();
  fd.append('photo', file);
  const res = await fetch('/dashboard/api/photo', { method: 'POST', body: fd });
  const data = await res.json();
  if (data.url) { salon.photo = data.url; msg.innerHTML = '<div class="alert alert-success">Photo mise à jour !</div>'; pageProfil(); }
  else msg.innerHTML = '<div class="alert alert-error">Erreur lors de l\'upload.</div>';
}

// ===== UTILS =====
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  if (res.status === 401) { window.location.href = '/dashboard/login'; return null; }
  return res.json().catch(() => ({}));
}

function setContent(html) { document.getElementById('dash-content').innerHTML = html; }
function esc(str) { return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

function badgeStatut(s) {
  const map = { confirmee: 'badge-vert', annulee: 'badge-rouge', pending: 'badge-or' };
  return `<span class="badge ${map[s]||'badge-gris'}">${s}</span>`;
}

function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

async function logout() {
  await fetch('/dashboard/logout', { method: 'POST' });
  window.location.href = '/dashboard/login';
}

init();
