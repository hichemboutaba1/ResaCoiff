const MOIS=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

async function init() {
  navigateTo('dashboard');
  document.querySelectorAll('.nav-item').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigateTo(el.dataset.page);}));
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  const titles={dashboard:'Tableau de bord',salons:'Salons inscrits',ajouter:'Ajouter un salon'};
  document.getElementById('page-title').textContent=titles[page]||page;
  const pages={dashboard:pageDashboard,salons:pageSalons,ajouter:pageAjouter};
  if(pages[page]) pages[page]();
}

async function pageDashboard() {
  const stats=await api('/admin/api/stats');
  setContent(`<div class="stats-grid">
    <div class="stat-card"><div class="stat-card-label">Total salons</div><div class="stat-card-value">${stats.totalSalons}</div></div>
    <div class="stat-card"><div class="stat-card-label">Salons actifs</div><div class="stat-card-value or">${stats.salonsActifs}</div></div>
    <div class="stat-card"><div class="stat-card-label">RDV aujourd'hui</div><div class="stat-card-value">${stats.resaAujourdhui}</div></div>
    <div class="stat-card"><div class="stat-card-label">Total RDV</div><div class="stat-card-value">${stats.totalResa}</div></div>
  </div><div class="card"><p style="font-size:14px;color:var(--gris)">Plateforme ResaCoiff — Administration centrale.<br>Gérez tous les salons inscrits, leurs accès et leurs abonnements.</p></div>`);
}

async function pageSalons() {
  const salons=await api('/admin/api/salons');
  if(!salons.length){setContent('<div class="empty-state"><div style="font-size:40px">✂️</div><p>Aucun salon inscrit.</p></div>');return;}
  setContent(`<div class="table-wrap"><table><thead><tr><th>Salon</th><th>Contact</th><th>RDV</th><th>Créé le</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${salons.map(s=>`
    <tr>
      <td><strong>${s.nom}</strong><div style="font-size:12px;color:var(--gris)">/${s.slug}</div></td>
      <td><div style="font-size:13px">${s.email}</div><div style="font-size:12px;color:var(--gris)">${s.telephone||'—'}</div></td>
      <td><strong>${s.total_resa}</strong> total<br><span style="font-size:12px;color:var(--gris)">${s.resa_today} aujourd'hui</span></td>
      <td style="font-size:13px">${formatDate(s.created_at)}</td>
      <td><span class="badge ${s.actif?'badge-vert':'badge-rouge'}">${s.actif?'Actif':'Inactif'}</span></td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap">
        <a href="/${s.slug}" target="_blank" class="btn btn-outline btn-sm">Voir</a>
        <button class="btn btn-sm ${s.actif?'btn-danger':'btn-success'}" onclick="toggleSalon(${s.id})">${s.actif?'Désactiver':'Activer'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSalon(${s.id},'${esc(s.nom)}')">Suppr.</button>
      </div></td>
    </tr>`).join('')}</tbody></table></div>`);
}

async function toggleSalon(id){await api(`/admin/api/salons/${id}/toggle`,'PUT');pageSalons();}
async function deleteSalon(id,nom){if(!confirm(`Supprimer "${nom}" ? Irréversible.`))return;await api(`/admin/api/salons/${id}`,'DELETE');pageSalons();}

function pageAjouter(){
  setContent(`<div class="form-card"><h2 style="margin-bottom:20px">Nouveau salon</h2>
    <div id="add-error" class="alert alert-error" style="display:none"></div>
    <div id="add-success" class="alert alert-success" style="display:none"></div>
    <div class="form-grid">
      <div class="form-group"><label>Nom du salon *</label><input type="text" id="a-nom" placeholder="Salon Élégance"></div>
      <div class="form-group"><label>Slug (URL) *</label><input type="text" id="a-slug" placeholder="salon-elegance" oninput="updateSlugPreview()"><div class="slug-preview">URL : <code>resacoiff.fr/<span id="slug-preview">...</span></code></div></div>
    </div>
    <div class="form-group"><label>Email *</label><input type="email" id="a-email" placeholder="contact@salon.fr"></div>
    <div class="form-grid">
      <div class="form-group"><label>Téléphone</label><input type="tel" id="a-tel" placeholder="06 12 34 56 78"></div>
      <div class="form-group"><label>Adresse</label><input type="text" id="a-adresse" placeholder="12 rue de la Paix, Paris"></div>
    </div>
    <div class="form-group"><label>Mot de passe *</label><input type="password" id="a-mdp" placeholder="Minimum 8 caractères"></div>
    <button class="btn btn-or" onclick="addSalon()">Créer le salon</button></div>`);
}

function updateSlugPreview(){document.getElementById('slug-preview').textContent=document.getElementById('a-slug').value||'...';}

async function addSalon(){
  const data={nom:document.getElementById('a-nom').value.trim(),slug:document.getElementById('a-slug').value.trim().toLowerCase(),email:document.getElementById('a-email').value.trim(),telephone:document.getElementById('a-tel').value.trim(),adresse:document.getElementById('a-adresse').value.trim(),mot_de_passe:document.getElementById('a-mdp').value};
  const err=document.getElementById('add-error'),ok=document.getElementById('add-success');
  err.style.display='none';ok.style.display='none';
  if(!data.nom||!data.slug||!data.email||!data.mot_de_passe){err.textContent='Tous les champs * sont requis.';err.style.display='block';return;}
  const res=await api('/admin/api/salons','POST',data);
  if(res.error){err.textContent=res.error;err.style.display='block';}
  else{ok.textContent=`Salon créé ! Lien : resacoiff.fr/${data.slug}`;ok.style.display='block';['a-nom','a-slug','a-email','a-tel','a-adresse','a-mdp'].forEach(id=>document.getElementById(id).value='');document.getElementById('slug-preview').textContent='...';}
}

async function api(url,method='GET',body=null){
  const opts={method,headers:{}};
  if(body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
  const res=await fetch(url,opts);
  if(res.status===401){window.location.href='/admin/login';return null;}
  return res.json().catch(()=>({}));
}

function setContent(html){document.getElementById('admin-content').innerHTML=html;}
function esc(str){return String(str).replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function formatDate(str){const d=new Date(str);return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;}
async function logout(){await fetch('/admin/logout',{method:'POST'});window.location.href='/admin/login';}
init();
