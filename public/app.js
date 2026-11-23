let currentUser = null;
let isRegistering = false;
let appointments = [];
const $ = id => document.getElementById(id);

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}
function authMessage(message, error=false) {
  $('authMessage').textContent = message;
  $('authMessage').className = 'message' + (error ? ' error' : '');
}
function setAuthMode(register) {
  isRegistering = register;
  $('authHeading').textContent = register ? 'Create your patient account' : 'Sign in to your account';
  $('authSub').textContent = register ? 'Register once to manage your hospital visits.' : 'Enter your details to continue to the patient portal.';
  $('nameField').classList.toggle('hidden', !register);
  $('registerName').required = register;
  $('authSubmit').innerHTML = register ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  $('switchText').textContent = register ? 'Already have an account?' : "Don't have an account?";
  $('switchAuth').textContent = register ? 'Sign in' : 'Create account';
  authMessage('');
}
$('switchAuth').addEventListener('click', () => setAuthMode(!isRegistering));
$('authForm').addEventListener('submit', async event => {
  event.preventDefault(); authMessage('Please wait...');
  try {
    const payload = { email: $('email').value.trim(), password: $('password').value };
    if (isRegistering) payload.name = $('registerName').value.trim();
    const data = await api(isRegistering ? '/api/register' : '/api/login', { method:'POST', body:JSON.stringify(payload) });
    currentUser = data.user; await openPortal();
  } catch (err) { authMessage(err.message, true); }
});
async function openPortal() {
  $('loginScreen').classList.add('hidden');
  $('userName').textContent = currentUser.name;
  $('userRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Patient account';
  $('avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  $('welcomeText').textContent = `Welcome back, ${currentUser.name.split(' ')[0]}!`;
  $('patientName').value = currentUser.name;
  await renderAll(); showView('dashboard');
}
function showView(view) {
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  $(view + 'View').classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  $('pageTitle').textContent = ({dashboard:'Dashboard',book:'Book appointment',appointments:'My appointments'})[view];
  renderAll();
}
document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.go)));
$('logoutBtn').addEventListener('click', async () => {
  try { await api('/api/logout', {method:'POST'}); } catch (_) {}
  currentUser = null; $('loginScreen').classList.remove('hidden'); $('authForm').reset(); setAuthMode(false);
});
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function renderAll() {
  if (!currentUser) return;
  try {
    const data = await api('/api/appointments'); appointments = data.appointments;
    const today = new Date().toISOString().slice(0,10);
    $('totalCount').textContent = appointments.length;
    $('upcomingCount').textContent = appointments.filter(a => a.date >= today && a.status !== 'Cancelled').length;
    $('pendingCount').textContent = appointments.filter(a => a.status === 'Pending').length;
    renderList('dashboardAppointments', appointments.filter(a => a.date >= today && a.status !== 'Cancelled').slice(0,3), false);
    renderList('allAppointments', appointments, true);
  } catch (err) { console.error(err); }
}
function renderList(targetId, items, actions) {
  const target = $(targetId);
  if (!items.length) { target.innerHTML = '<div class="empty-state"><strong>No appointments yet</strong>Book your first appointment to see it listed here.</div>'; return; }
  target.innerHTML = items.map(a => {
    const d = new Date(a.date + 'T00:00:00');
    const day = d.toLocaleDateString('en-KE',{day:'2-digit'}), month = d.toLocaleDateString('en-KE',{month:'short'});
    let actionButtons = '';
    if (actions && currentUser.role === 'admin' && a.status === 'Pending') actionButtons += `<button class="cancel-btn" style="color:#12865f;border-color:#ccebdd" data-status="Confirmed" data-id="${a.id}">Confirm</button>`;
    if (actions && a.status !== 'Cancelled') actionButtons += `<button class="cancel-btn" data-cancel="${a.id}">Cancel</button>`;
    const patient = currentUser.role === 'admin' ? `<p>Patient: ${escapeHTML(a.patient_name)} · ${escapeHTML(a.patient_phone)}</p>` : '';
    return `<article class="appointment-card"><div class="appointment-main"><div class="date-tile"><b>${day}</b><small>${month}</small></div><div><h3>${escapeHTML(a.department)} · ${escapeHTML(a.doctor)}</h3><p>${escapeHTML(a.date)} at ${escapeHTML(a.time)} · ${escapeHTML(a.reason)}</p>${patient}</div></div><div class="status-wrap"><span class="status ${a.status.toLowerCase()}">${escapeHTML(a.status)}</span>${actionButtons}</div></article>`;
  }).join('');
  target.querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', async () => {
    try { await api('/api/appointments/' + btn.dataset.cancel, {method:'DELETE'}); await renderAll(); }
    catch(err) { alert(err.message); }
  }));
  target.querySelectorAll('[data-status]').forEach(btn => btn.addEventListener('click', async () => {
    try { await api('/api/appointments/' + btn.dataset.id + '/status', {method:'PATCH',body:JSON.stringify({status:btn.dataset.status})}); await renderAll(); }
    catch(err) { alert(err.message); }
  }));
}
$('appointmentDate').min = new Date().toISOString().slice(0,10);
$('bookingForm').addEventListener('submit', async event => {
  event.preventDefault();
  const payload = {
    patientName:$('patientName').value.trim(), patientPhone:$('patientPhone').value.trim(),
    department:$('department').value, doctor:$('doctor').value, date:$('appointmentDate').value,
    time:$('appointmentTime').value, reason:$('reason').value.trim()
  };
  const message = $('bookingMessage'); message.textContent = 'Saving appointment...'; message.className = 'message';
  try {
    const data = await api('/api/appointments', {method:'POST',body:JSON.stringify(payload)});
    $('bookingForm').reset(); $('patientName').value = currentUser.name;
    message.textContent = data.message; message.className = 'message'; await renderAll();
  } catch(err) { message.textContent = err.message; message.className = 'message error'; }
});
(async function init() {
  try { const data = await api('/api/me'); if (data.user) { currentUser = data.user; await openPortal(); } }
  catch (err) { console.error(err); }
})();
