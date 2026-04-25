const slug = window.location.pathname.replace(/^\//, '').split('/')[0];
const API = `/${slug}/api`;
let salonData=null, selectedService=null, selectedDate=null, selectedCreneau=null, calYear, calMonth;
const JOURS=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
const MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const JOURS_KEYS=['dim','lun','mar','mer','jeu','ven','sam'];

async function init() {
  const res = await fetch(`${API}/info`);
  if (!res.ok) { document.getElementById('app').innerHTML='<div style="text-align:center;padding:80px;font-size:20px">Salon non trouvé</div>'; return; }
  salonData = await res.json();
  document.title = `Réserver chez ${salonData.nom}`;
  const cover = document.getElementById('cover');
  if (salonData.photo) cover.style.backgroundImage = `url('${salonData.photo}')`;
  document.getElementById('salon-header').innerHTML = `<h1>${salonData.nom}</h1><p>${salonData.adresse}</p>`;
  document.getElementById('salon-info-bar').innerHTML = `<div class="info-chip">📍 <span>${salonData.adresse}</span></div><div class="info-chip">📞 <span>${salonData.telephone||'Non renseigné'}</span></div><div class="info-chip">🕐 <span>${getHorairesAujourdhui()}</span></div>`;
  renderServices();
  const today = new Date(); calYear=today.getFullYear(); calMonth=today.getMonth();
  renderCalendar();
  document.getElementById('cal-prev').addEventListener('click',()=>{ calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click',()=>{ calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); });
  document.getElementById('form-resa').addEventListener('submit', submitReservation);
}

function getHorairesAujourdhui() {
  const key=JOURS_KEYS[new Date().getDay()], h=salonData.horaires[key];
  return h ? `Aujourd'hui : ${h}` : "Fermé aujourd'hui";
}

function renderServices() {
  document.getElementById('services-grid').innerHTML = salonData.services.map(s=>`
    <div class="service-card" data-id="${s.id}" onclick="selectService(${s.id})">
      <div class="service-nom">${s.nom}</div>
      <div class="service-meta"><span class="service-prix">${s.prix}€</span><span class="service-duree">⏱ ${s.duree} min</span></div>
    </div>`).join('');
}

function selectService(id) {
  selectedService=salonData.services.find(s=>s.id===id); selectedDate=null; selectedCreneau=null;
  document.querySelectorAll('.service-card').forEach(c=>c.classList.toggle('selected',parseInt(c.dataset.id)===id));
  show('section-calendrier'); hide('section-creneaux'); hide('section-form'); hide('section-succes');
  renderCalendar(); smoothScroll('section-calendrier');
}

function renderCalendar() {
  document.getElementById('cal-month-label').textContent=`${MOIS[calMonth]} ${calYear}`;
  const grid=document.getElementById('cal-grid');
  const today=new Date(); today.setHours(0,0,0,0);
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  let html='<div class="cal-day-headers">'+JOURS.map(j=>`<span>${j}</span>`).join('')+'</div><div class="cal-days">';
  for(let i=0;i<firstDay;i++) html+='<div class="cal-day empty"></div>';
  for(let d=1;d<=daysInMonth;d++) {
    const date=new Date(calYear,calMonth,d), dateStr=toDateStr(date);
    const isPast=date<today, dayKey=JOURS_KEYS[date.getDay()];
    const isClosed=!salonData.horaires[dayKey], isFermee=salonData.fermetures.includes(dateStr);
    const isToday=date.getTime()===today.getTime(), isSelected=dateStr===selectedDate;
    let cls='cal-day';
    if(isPast) cls+=' past disabled';
    else if(isFermee) cls+=' fermee disabled';
    else if(isClosed) cls+=' disabled';
    if(isToday) cls+=' today';
    if(isSelected) cls+=' selected';
    const clickable=!isPast&&!isClosed&&!isFermee;
    html+=`<div class="${cls}" ${clickable?`onclick="selectDate('${dateStr}')"`:''}>  ${d}</div>`;
  }
  grid.innerHTML=html+'</div>';
}

async function selectDate(dateStr) {
  selectedDate=dateStr; selectedCreneau=null; renderCalendar();
  hide('section-form');
  document.getElementById('creneaux-grid').innerHTML='<p class="no-creneaux">Chargement...</p>';
  show('section-creneaux'); smoothScroll('section-creneaux');
  const res=await fetch(`${API}/creneaux?date=${dateStr}&service_id=${selectedService.id}`);
  const data=await res.json();
  if(!data.creneaux||!data.creneaux.length) { document.getElementById('creneaux-grid').innerHTML='<p class="no-creneaux">Aucun créneau disponible ce jour.</p>'; return; }
  document.getElementById('creneaux-grid').innerHTML=data.creneaux.map(c=>`<button class="creneau-btn" onclick="selectCreneau('${c}')">${c}</button>`).join('');
}

function selectCreneau(h) {
  selectedCreneau=h;
  document.querySelectorAll('.creneau-btn').forEach(b=>b.classList.toggle('selected',b.textContent.trim()===h));
  const d=new Date(selectedDate+'T00:00:00');
  document.getElementById('recap-box').innerHTML=`
    <div class="recap-item"><span>Service :</span><strong>${selectedService.nom} — ${selectedService.prix}€</strong></div>
    <div class="recap-item"><span>Date :</span><strong>${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${calYear}</strong></div>
    <div class="recap-item"><span>Heure :</span><strong>${selectedCreneau}</strong></div>
    <div class="recap-item"><span>Durée :</span><strong>${selectedService.duree} min</strong></div>`;
  show('section-form'); smoothScroll('section-form');
}

async function submitReservation(e) {
  e.preventDefault();
  const btn=document.getElementById('btn-submit'), errEl=document.getElementById('form-error');
  errEl.style.display='none'; btn.innerHTML='<span class="spinner"></span> Confirmation...'; btn.disabled=true;
  const body={ service_id:selectedService.id, date:selectedDate, heure:selectedCreneau,
    client_nom:document.getElementById('client_nom').value.trim(),
    client_email:document.getElementById('client_email').value.trim(),
    client_tel:document.getElementById('client_tel').value.trim() };
  try {
    const res=await fetch(`/${slug}/reserver`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await res.json();
    if(!res.ok||data.error) { errEl.textContent=data.error||'Une erreur est survenue.'; errEl.style.display='block'; btn.innerHTML='Confirmer ma réservation'; btn.disabled=false; return; }
    const d=new Date(selectedDate+'T00:00:00');
    document.getElementById('succes-details').innerHTML=`
      <div class="recap-item"><span>Salon :</span><strong>${salonData.nom}</strong></div>
      <div class="recap-item"><span>Service :</span><strong>${selectedService.nom}</strong></div>
      <div class="recap-item"><span>Date :</span><strong>${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${calYear} à ${selectedCreneau}</strong></div>
      <div class="recap-item"><span>Adresse :</span><strong>${salonData.adresse}</strong></div>`;
    ['section-services','section-calendrier','section-creneaux','section-form'].forEach(hide);
    show('section-succes'); smoothScroll('section-succes');
  } catch { errEl.textContent='Erreur de connexion. Réessayez.'; errEl.style.display='block'; btn.innerHTML='Confirmer ma réservation'; btn.disabled=false; }
}

function show(id){document.getElementById(id).style.display='';}
function hide(id){document.getElementById(id).style.display='none';}
function toDateStr(d){return d.toISOString().split('T')[0];}
function smoothScroll(id){setTimeout(()=>document.getElementById(id).scrollIntoView({behavior:'smooth',block:'start'}),50);}
init();
