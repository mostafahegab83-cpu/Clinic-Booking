// ============ State ============
const STORAGE_KEY = 'clinic_bookings_v1';

let bookings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let currentStep = 1;
let editingId = null;
const totalSteps = 5;

// ============ Elements ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const stepButtons = $$('.step');
const panels = $$('.step-panel');
const prevBtn = $('#prevBtn');
const nextBtn = $('#nextBtn');
const saveBtn = $('#saveBtn');

// ============ Step Navigation ============
function showStep(n) {
  currentStep = n;
  stepButtons.forEach((b, i) => {
    b.classList.toggle('active', i + 1 === n);
    b.classList.toggle('completed', i + 1 < n);
  });
  panels.forEach((p) => p.classList.toggle('active', +p.dataset.panel === n));
  prevBtn.style.display = n === 1 ? 'none' : '';
  nextBtn.style.display = n === totalSteps ? 'none' : '';
  saveBtn.style.display = n === totalSteps ? '' : 'none';
  updateSummary();
}

stepButtons.forEach((b) => b.addEventListener('click', () => showStep(+b.dataset.step)));
prevBtn.addEventListener('click', () => currentStep > 1 && showStep(currentStep - 1));
nextBtn.addEventListener('click', () => {
  if (!validateStep(currentStep)) return;
  if (currentStep < totalSteps) showStep(currentStep + 1);
});

// ============ Validation ============
const FIELD_LABELS = {
  '#fullName': 'الاسم الكامل',
  '#phone': 'رقم الجوال',
  '#specialty': 'التخصص',
  '#appointmentDate': 'تاريخ الموعد',
  '#doctor': 'اسم الطبيب',
  '#appointmentTime': 'الوقت',
};
function validateStep(n) {
  const required = {
    1: ['#fullName', '#phone'],
    2: ['#specialty'],
    3: ['#appointmentDate', '#doctor'],
    4: ['#appointmentTime'],
    5: [],
  };
  for (const sel of required[n] || []) {
    const el = $(sel);
    if (!el.value.trim()) {
      showStep(n);
      setTimeout(() => el.focus(), 50);
      toast('يرجى تعبئة: ' + (FIELD_LABELS[sel] || sel));
      return false;
    }
  }
  return true;
}

// ============ Admin Working Hours ============
const ADMIN_KEY = 'clinic_admin_v1';
const DEFAULT_ADMIN = {
  start: '09:00',
  end: '17:00',
  breakStart: '12:30',
  breakEnd: '14:00',
  slotMinutes: 30,
  days: [0,1,2,3,4], // الأحد - الخميس
};
let adminSettings = Object.assign({}, DEFAULT_ADMIN, JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}'));

function toMin(t) { const [h,m] = (t||'').split(':').map(Number); return h*60 + (m||0); }
function toHHMM(min) {
  const h = String(Math.floor(min/60)).padStart(2,'0');
  const m = String(min%60).padStart(2,'0');
  return `${h}:${m}`;
}

function generateSlots() {
  const { start, end, breakStart, breakEnd, slotMinutes } = adminSettings;
  const s = toMin(start), e = toMin(end);
  const step = Number(slotMinutes) || 30;
  if (!s || !e || e <= s) return [];
  const bs = breakStart ? toMin(breakStart) : null;
  const be = breakEnd ? toMin(breakEnd) : null;
  const slots = [];
  for (let t = s; t + step <= e; t += step) {
    if (bs !== null && be !== null && t < be && t + step > bs) continue;
    slots.push(toHHMM(t));
  }
  return slots;
}

// ============ Time Slots ============
const doctorInput = $('#doctor');
const timeSlotsEl = $('#timeSlots');
function renderTimeSlots() {
  const dateVal = $('#appointmentDate').value;
  // Check working day
  let dayWarning = '';
  if (dateVal) {
    const day = new Date(dateVal).getDay();
    if (!adminSettings.days.includes(day)) {
      dayWarning = '⚠️ التاريخ المختار خارج أيام العمل';
    }
  }
  const SLOTS = generateSlots();
  const taken = bookings
    .filter(b => b.appointmentDate === dateVal
                 && b.doctor === doctorInput.value.trim()
                 && b.id !== editingId)
    .map(b => b.appointmentTime);
  if (!SLOTS.length) {
    timeSlotsEl.innerHTML = '<p class="muted">لم يتم ضبط ساعات العمل بعد. افتح إعدادات المواعيد.</p>';
    return;
  }
  const html = SLOTS.map(t => {
    const isTaken = taken.includes(t);
    const isSel = $('#appointmentTime').value === t;
    return `<button type="button" class="slot ${isTaken?'taken':''} ${isSel?'selected':''}"
              ${isTaken?'disabled':''} data-time="${t}">${t}</button>`;
  }).join('');
  timeSlotsEl.innerHTML = (dayWarning ? `<p class="muted">${dayWarning}</p>` : '') + html;
  timeSlotsEl.querySelectorAll('.slot:not(.taken)').forEach(b => {
    b.addEventListener('click', () => {
      $('#appointmentTime').value = b.dataset.time;
      renderTimeSlots();
      updateSummary();
    });
  });
}
$('#appointmentTime').addEventListener('input', renderTimeSlots);
$('#appointmentDate').addEventListener('change', renderTimeSlots);
doctorInput.addEventListener('input', renderTimeSlots);

// ============ Admin Panel Wiring ============
const adminPanel = $('#adminPanel');
function loadAdminForm() {
  $('#adminStart').value = adminSettings.start;
  $('#adminEnd').value = adminSettings.end;
  $('#adminBreakStart').value = adminSettings.breakStart || '';
  $('#adminBreakEnd').value = adminSettings.breakEnd || '';
  $('#adminSlotMinutes').value = String(adminSettings.slotMinutes);
  $$('#adminDays input').forEach(cb => {
    cb.checked = adminSettings.days.includes(Number(cb.value));
  });
}
$('#toggleAdmin').addEventListener('click', () => {
  loadAdminForm();
  adminPanel.style.display = adminPanel.style.display === 'none' ? '' : 'none';
});
$('#closeAdminBtn').addEventListener('click', () => { adminPanel.style.display = 'none'; });
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
  $('#duration').value = String(adminSettings.slotMinutes);
  renderTimeSlots();
  toast('تم حفظ إعدادات المواعيد');
  adminPanel.style.display = 'none';
});

// ============ Form Data ============
function readForm() {
  return {
    id: editingId || Date.now().toString(),
    fullName: $('#fullName').value.trim(),
    idNumber: $('#idNumber').value.trim(),
    birthDate: $('#birthDate').value,
    phone: $('#phone').value.trim(),
    gender: $('#gender').value,
    email: $('#email').value.trim(),
    specialty: $('#specialty').value.trim(),
    condition: $('#condition').value.trim(),
    appointmentDate: $('#appointmentDate').value,
    doctor: doctorInput.value.trim(),
    appointmentTime: $('#appointmentTime').value,
    duration: $('#duration').value,
    paymentMethod: $('#paymentMethod').value,
    amount: $('#amount').value,
    notes: $('#notes').value.trim(),
  };
}

function fillForm(b) {
  $('#fullName').value = b.fullName || '';
  $('#idNumber').value = b.idNumber || '';
  $('#birthDate').value = b.birthDate || '';
  $('#phone').value = b.phone || '';
  $('#gender').value = b.gender || '';
  $('#email').value = b.email || '';
  $('#specialty').value = b.specialty || '';
  $('#condition').value = b.condition || '';
  $('#appointmentDate').value = b.appointmentDate || '';
  doctorInput.value = b.doctor || '';
  $('#appointmentTime').value = b.appointmentTime || '';
  $('#duration').value = b.duration || '30';
  $('#paymentMethod').value = b.paymentMethod || 'عند الحضور';
  $('#amount').value = b.amount || '';
  $('#notes').value = b.notes || '';
  renderTimeSlots();
}

function clearForm() {
  ['#fullName','#idNumber','#birthDate','#phone','#gender','#email',
   '#specialty','#condition','#appointmentDate','#doctor',
   '#appointmentTime','#amount','#notes'].forEach(s => $(s).value = '');
  $('#duration').value = '30';
  $('#paymentMethod').value = 'عند الحضور';
  editingId = null;
  renderTimeSlots();
}

// ============ Summary ============
function updateSummary() {
  const d = readForm();
  $('#sName').textContent = d.fullName || '-';
  $('#sCondition').textContent = d.specialty || '-';
  $('#sDate').textContent = d.appointmentDate || '-';
  $('#sTime').textContent = d.appointmentTime ? `${d.appointmentTime} / ${d.duration} د` : '-';
  $('#sDoctor').textContent = d.doctor || '-';
  $('#sPayment').textContent = d.paymentMethod ? (d.paymentMethod + (d.amount ? ` (${d.amount} ر.س)` : '')) : '-';
  const note = $('#summaryNote');
  if (d.appointmentDate && d.appointmentTime) {
    note.textContent = `📅 ${d.appointmentDate} - ${d.appointmentTime}`;
  } else {
    note.textContent = '📅 لم يتم اختيار موعد بعد';
  }
}
document.addEventListener('input', updateSummary);
document.addEventListener('change', updateSummary);

// ============ Save / Edit / Delete ============
saveBtn.addEventListener('click', () => {
  for (let i = 1; i <= totalSteps; i++) if (!validateStep(i)) { showStep(i); return; }
  const data = readForm();
  if (editingId) {
    bookings = bookings.map(b => b.id === editingId ? data : b);
    toast('تم تحديث الحجز');
  } else {
    bookings.push(data);
    toast('تم حفظ الحجز بنجاح');
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  clearForm();
  showStep(1);
  renderTable();
});

function editBooking(id) {
  const b = bookings.find(x => x.id === id);
  if (!b) return;
  editingId = id;
  fillForm(b);
  showStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('وضع التعديل - عدّل البيانات ثم احفظ');
}

function deleteBooking(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الحجز؟')) return;
  bookings = bookings.filter(b => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  renderTable();
  toast('تم حذف الحجز');
}

// ============ Table ============
function renderTable(filter = '') {
  const tbody = $('#bookingsTable tbody');
  const empty = $('#emptyMsg');
  const f = filter.toLowerCase();
  const rows = bookings.filter(b =>
    !f || b.fullName.toLowerCase().includes(f) || b.phone.includes(f)
  );
  tbody.innerHTML = rows.map(b => `
    <tr>
      <td>${escape(b.fullName)}</td>
      <td>${escape(b.phone)}</td>
      <td>${escape(b.doctor)}</td>
      <td>${escape(b.appointmentDate)}</td>
      <td>${escape(b.appointmentTime)}</td>
      <td>${escape(b.paymentMethod || '-')}${b.amount ? ` (${escape(b.amount)})` : ''}</td>
      <td class="row-actions">
        <button class="btn small ghost" onclick="editBooking('${b.id}')">✏️ تعديل</button>
        <button class="btn small danger" onclick="deleteBooking('${b.id}')">🗑️ حذف</button>
      </td>
    </tr>
  `).join('');
  empty.style.display = rows.length ? 'none' : '';
  $('#bookingsTable').style.display = rows.length ? '' : 'none';
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

$('#searchInput').addEventListener('input', (e) => renderTable(e.target.value));

// ============ Toast ============
let toastTimer;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// expose for inline handlers
window.editBooking = editBooking;
window.deleteBooking = deleteBooking;

// ============ Init ============
showStep(1);
renderTable();
renderTimeSlots();
