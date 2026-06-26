// ============ Admin Page Script ============
const ADMIN_KEY = 'clinic_admin_v1';
const DOCTORS_KEY = 'clinic_doctors_v1';
const DEFAULT_ADMIN = {
  start: '09:00', end: '17:00',
  breakStart: '12:30', breakEnd: '14:00',
  slotMinutes: 30, days: [0,1,2,3,4],
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let adminSettings = Object.assign({}, DEFAULT_ADMIN, JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}'));
let doctors = JSON.parse(localStorage.getItem(DOCTORS_KEY) || '[]');
let selectedDoctorName = null;

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(() => el.classList.remove('show'), 2500);
}

function saveDoctors() { localStorage.setItem(DOCTORS_KEY, JSON.stringify(doctors)); }

// ===== Doctors table =====
function renderDoctorsTable() {
  const tbody = $('#doctorsTable tbody');
  const empty = $('#emptyDoctorsMsg');
  tbody.innerHTML = doctors.map((d, i) => `
    <tr>
      <td>${escape(d.name)}</td>
      <td>${escape(d.specialty || '-')}</td>
      <td>${d.schedule ? '✅ مخصص' : '— افتراضي'}</td>
      <td><button class="btn small danger" data-idx="${i}">🗑️ حذف</button></td>
    </tr>`).join('');
  empty.style.display = doctors.length ? 'none' : '';
  $('#doctorsTable').style.display = doctors.length ? '' : 'none';
  tbody.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('حذف هذا الطبيب؟')) return;
      const removed = doctors.splice(Number(btn.dataset.idx), 1)[0];
      if (removed && removed.name === selectedDoctorName) {
        selectedDoctorName = null;
        $('#docSchedSection').style.display = 'none';
      }
      saveDoctors();
      refreshDoctorsUI();
    });
  });
}

function renderDoctorChips() {
  const wrap = $('#doctorChips');
  if (!doctors.length) {
    wrap.innerHTML = '<span class="muted">أضف طبيب أولاً</span>';
    return;
  }
  wrap.innerHTML = doctors.map(d => {
    const active = d.name === selectedDoctorName ? ' active' : '';
    const dot = d.schedule ? '<span class="sched-dot">●</span>' : '';
    return `<button type="button" class="doc-chip${active}" data-name="${escape(d.name)}">${dot}${escape(d.name)}</button>`;
  }).join('');
  wrap.querySelectorAll('.doc-chip').forEach(btn => {
    btn.addEventListener('click', () => selectDoctor(btn.dataset.name));
  });
}

function selectDoctor(name) {
  selectedDoctorName = name;
  const d = doctors.find(x => x.name === name);
  if (!d) return;
  const s = d.schedule || adminSettings;
  $('#docSchedTitle').textContent = `إعدادات ساعات العمل  للطبيب ${name}`;
  $('#docSchedStart').value = s.start || '09:00';
  $('#docSchedEnd').value = s.end || '17:00';
  $('#docSchedBreakStart').value = s.breakStart || '';
  $('#docSchedBreakEnd').value = s.breakEnd || '';
  $('#docSchedSlot').value = String(s.slotMinutes || 30);
  $$('#docSchedDays input').forEach(cb => { cb.checked = (s.days || []).includes(Number(cb.value)); });
  $('#docSchedSection').style.display = '';
  renderDoctorChips();
}

function refreshDoctorsUI() {
  renderDoctorsTable();
  renderDoctorChips();
}

$('#addDoctorBtn').addEventListener('click', () => {
  const name = $('#newDoctorName').value.trim();
  const specialty = $('#newDoctorSpecialty').value.trim();
  if (!name) { toast('أدخل اسم الطبيب'); return; }
  if (!specialty) { toast('أدخل التخصص'); return; }
  doctors.push({ name, specialty });
  saveDoctors();
  $('#newDoctorName').value = '';
  $('#newDoctorSpecialty').value = '';
  refreshDoctorsUI();
  toast('تمت إضافة الطبيب');
});

$('#saveDocSchedBtn').addEventListener('click', () => {
  if (!selectedDoctorName) { toast('اختر طبيب أولاً'); return; }
  const d = doctors.find(x => x.name === selectedDoctorName);
  if (!d) return;
  const days = Array.from($$('#docSchedDays input:checked')).map(c => Number(c.value));
  d.schedule = {
    start: $('#docSchedStart').value || '09:00',
    end: $('#docSchedEnd').value || '17:00',
    breakStart: $('#docSchedBreakStart').value || '',
    breakEnd: $('#docSchedBreakEnd').value || '',
    slotMinutes: Number($('#docSchedSlot').value) || 30,
    days: days.length ? days : DEFAULT_ADMIN.days,
  };
  // also persist a global default so booking page has reasonable fallback
  localStorage.setItem(ADMIN_KEY, JSON.stringify(d.schedule));
  adminSettings = Object.assign({}, d.schedule);
  saveDoctors();
  refreshDoctorsUI();
  toast(`تم حفظ إعدادات ${selectedDoctorName}`);
});

$('#clearDocSchedBtn').addEventListener('click', () => {
  if (!selectedDoctorName) { toast('اختر طبيب أولاً'); return; }
  if (!confirm('إزالة الجدول المخصص لهذا الطبيب؟ (سيستخدم الإعداد الافتراضي)')) return;
  const d = doctors.find(x => x.name === selectedDoctorName);
  if (d) { delete d.schedule; saveDoctors(); }
  selectDoctor(selectedDoctorName);
  refreshDoctorsUI();
  toast('تمت الإزالة');
});

// init
refreshDoctorsUI();
