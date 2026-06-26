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

// ===== Working hours =====
function loadAdminForm() {
  $('#adminStart').value = adminSettings.start;
  $('#adminEnd').value = adminSettings.end;
  $('#adminBreakStart').value = adminSettings.breakStart || '';
  $('#adminBreakEnd').value = adminSettings.breakEnd || '';
  $('#adminSlotMinutes').value = String(adminSettings.slotMinutes);
  $$('#adminDays input').forEach(cb => { cb.checked = adminSettings.days.includes(Number(cb.value)); });
}
$('#saveAdminBtn').addEventListener('click', () => {
  const days = Array.from($$('#adminDays input:checked')).map(c => Number(c.value));
  adminSettings = {
    start: $('#adminStart').value || '09:00',
    end: $('#adminEnd').value || '17:00',
    breakStart: $('#adminBreakStart').value || '',
    breakEnd: $('#adminBreakEnd').value || '',
    slotMinutes: Number($('#adminSlotMinutes').value) || 30,
    days: days.length ? days : DEFAULT_ADMIN.days,
  };
  localStorage.setItem(ADMIN_KEY, JSON.stringify(adminSettings));
  toast('تم حفظ إعدادات المواعيد');
});

// ===== Doctors =====
function renderDoctorsTable() {
  const tbody = $('#doctorsTable tbody');
  const empty = $('#emptyDoctorsMsg');
  tbody.innerHTML = doctors.map((d, i) => `
    <tr>
      <td>${escape(d.name)}</td>
      <td>${escape(d.specialty || '-')}</td>
      <td><button class="btn small danger" data-idx="${i}">🗑️ حذف</button></td>
    </tr>`).join('');
  empty.style.display = doctors.length ? 'none' : '';
  $('#doctorsTable').style.display = doctors.length ? '' : 'none';
  tbody.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('حذف هذا الطبيب؟')) return;
      doctors.splice(Number(btn.dataset.idx), 1);
      saveDoctors();
      refreshDoctorsUI();
    });
  });
}

function populateDocSchedDoctors() {
  const sel = $('#docSchedDoctors');
  const selected = Array.from(sel.selectedOptions).map(o => o.value);
  sel.innerHTML = doctors.map(d => {
    const tag = d.schedule ? ' ⏱' : '';
    return `<option value="${escape(d.name)}"${selected.includes(d.name)?' selected':''}>${escape(d.name)}${d.specialty?' - '+escape(d.specialty):''}${tag}</option>`;
  }).join('');
}

function refreshDoctorsUI() {
  renderDoctorsTable();
  populateDocSchedDoctors();
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

// ===== Per-doctor schedule =====
$('#loadDocSchedBtn').addEventListener('click', () => {
  const picked = Array.from($('#docSchedDoctors').selectedOptions).map(o => o.value);
  if (picked.length !== 1) { toast('اختر طبيب واحد فقط للتحميل'); return; }
  const d = doctors.find(x => x.name === picked[0]);
  const s = (d && d.schedule) || adminSettings;
  $('#docSchedStart').value = s.start || '09:00';
  $('#docSchedEnd').value = s.end || '17:00';
  $('#docSchedBreakStart').value = s.breakStart || '';
  $('#docSchedBreakEnd').value = s.breakEnd || '';
  $('#docSchedSlot').value = String(s.slotMinutes || 30);
  $$('#docSchedDays input').forEach(cb => { cb.checked = (s.days || []).includes(Number(cb.value)); });
  toast('تم تحميل جدول ' + picked[0]);
});

$('#saveDocSchedBtn').addEventListener('click', () => {
  const picked = Array.from($('#docSchedDoctors').selectedOptions).map(o => o.value);
  if (!picked.length) { toast('اختر طبيب أو أكثر'); return; }
  const days = Array.from($$('#docSchedDays input:checked')).map(c => Number(c.value));
  const schedule = {
    start: $('#docSchedStart').value || '09:00',
    end: $('#docSchedEnd').value || '17:00',
    breakStart: $('#docSchedBreakStart').value || '',
    breakEnd: $('#docSchedBreakEnd').value || '',
    slotMinutes: Number($('#docSchedSlot').value) || 30,
    days: days.length ? days : adminSettings.days,
  };
  picked.forEach(name => {
    const d = doctors.find(x => x.name === name);
    if (d) d.schedule = Object.assign({}, schedule);
  });
  saveDoctors();
  populateDocSchedDoctors();
  toast(`تم حفظ الجدول لـ ${picked.length} طبيب`);
});

$('#clearDocSchedBtn').addEventListener('click', () => {
  const picked = Array.from($('#docSchedDoctors').selectedOptions).map(o => o.value);
  if (!picked.length) { toast('اختر طبيب أو أكثر'); return; }
  if (!confirm('إزالة الجدول المخصص للأطباء المحددين؟ (سيستخدم الإعداد الافتراضي)')) return;
  picked.forEach(name => {
    const d = doctors.find(x => x.name === name);
    if (d) delete d.schedule;
  });
  saveDoctors();
  populateDocSchedDoctors();
  toast('تمت الإزالة');
});

// init
loadAdminForm();
refreshDoctorsUI();
