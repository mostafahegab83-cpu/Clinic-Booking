// ============ State ============
const STORAGE_KEY = 'clinic_bookings_v1';
const AUDIT_KEY = 'clinic_audit_v1';
const USER_KEY = 'clinic_current_user';

let bookings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let auditLog = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
let currentUser = localStorage.getItem(USER_KEY) || '';
if (!currentUser) {
  currentUser = (prompt('أدخل اسم المستخدم (للتدقيق):', 'admin') || 'admin').trim() || 'admin';
  localStorage.setItem(USER_KEY, currentUser);
}
function logAudit(action, bookingId, details='') {
  auditLog.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2,6),
    action, bookingId, user: currentUser,
    timestamp: new Date().toISOString(),
    details,
  });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLog));
}

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

function getScheduleFor(doctorName) {
  if (doctorName) {
    const d = doctors.find(x => x.name === doctorName);
    if (d && d.schedule) return Object.assign({}, adminSettings, d.schedule);
  }
  return adminSettings;
}

function generateSlots(doctorName) {
  const cfg = getScheduleFor(doctorName);
  const { start, end, breakStart, breakEnd, slotMinutes } = cfg;
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
  const docName = doctorInput.value.trim();
  const cfg = getScheduleFor(docName);
  // Check working day
  let dayWarning = '';
  if (dateVal) {
    const day = new Date(dateVal).getDay();
    if (!cfg.days.includes(day)) {
      dayWarning = '⚠️ التاريخ المختار خارج أيام عمل الطبيب';
    }
  }
  const SLOTS = generateSlots(docName);
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
doctorInput.addEventListener('change', renderTimeSlots);

// ============ Doctors (read-only on booking page; managed in admin.html) ============
const DOCTORS_KEY = 'clinic_doctors_v1';
let doctors = JSON.parse(localStorage.getItem(DOCTORS_KEY) || '[]');

function uniqueSpecialties() {
  return [...new Set(doctors.map(d => d.specialty).filter(Boolean))];
}

function populateSpecialtyDropdown() {
  const sel = $('#specialty');
  const cur = sel.value;
  const opts = uniqueSpecialties().map(s => `<option value="${escape(s)}">${escape(s)}</option>`).join('');
  sel.innerHTML = '<option value="">اختر التخصص</option>' + opts;
  if (cur && uniqueSpecialties().includes(cur)) sel.value = cur;
}

function populateDoctorDropdown() {
  const sel = $('#doctor');
  const cur = sel.value;
  const spec = $('#specialty').value;
  const list = doctors.filter(d => !spec || d.specialty === spec);
  const opts = list.map(d => `<option value="${escape(d.name)}">${escape(d.name)}${d.specialty ? ' - ' + escape(d.specialty) : ''}</option>`).join('');
  sel.innerHTML = '<option value="">اختر الطبيب</option>' + opts;
  if (cur && list.some(d => d.name === cur)) sel.value = cur;
}

function refreshDoctorsUI() {
  populateSpecialtyDropdown();
  populateDoctorDropdown();
}

// re-read doctors/admin settings when returning to the tab (admin page may have updated them)
window.addEventListener('focus', () => {
  doctors = JSON.parse(localStorage.getItem(DOCTORS_KEY) || '[]');
  adminSettings = Object.assign({}, DEFAULT_ADMIN, JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}'));
  refreshDoctorsUI();
  renderTimeSlots();
});

$('#specialty').addEventListener('change', () => {
  populateDoctorDropdown();
  renderTimeSlots();
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
    status: $('#status').value || 'مجدول',
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
  populateDoctorDropdown();
  doctorInput.value = b.doctor || '';
  $('#appointmentTime').value = b.appointmentTime || '';
  $('#duration').value = b.duration || '30';
  $('#paymentMethod').value = b.paymentMethod || 'نقدي';
  $('#amount').value = b.amount || '';
  $('#status').value = b.status || 'مجدول';
  $('#notes').value = b.notes || '';
  renderTimeSlots();
}

function clearForm() {
  ['#fullName','#idNumber','#birthDate','#phone','#gender','#email',
   '#specialty','#condition','#appointmentDate','#doctor',
   '#appointmentTime','#amount','#notes'].forEach(s => $(s).value = '');
  $('#duration').value = '30';
  $('#paymentMethod').value = 'نقدي';
  $('#status').value = 'مجدول';
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
  $('#sPayment').textContent = d.paymentMethod ? (d.paymentMethod + (d.amount ? ` (${d.amount} ج.م)` : '')) : '-';
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
    logAudit('Edit', data.id, data.fullName);
    toast('تم تحديث الحجز');
  } else {
    bookings.push(data);
    logAudit('Create', data.id, data.fullName);
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
  const b = bookings.find(x => x.id === id);
  bookings = bookings.filter(b => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  logAudit('Delete', id, b ? b.fullName : '');
  renderTable();
  toast('تم حذف الحجز');
}

// ============ Table ============
function renderTable() {
  const tbody = $('#bookingsTable tbody');
  const empty = $('#emptyMsg');
  const f = ($('#searchInput')?.value || '').toLowerCase();
  const from = $('#searchDateFrom')?.value || '';
  const to = $('#searchDateTo')?.value || '';
  const status = $('#searchStatus')?.value || '';
  const rows = bookings.filter(b => {
    if (f && !(b.fullName?.toLowerCase().includes(f) || (b.phone||'').includes(f))) return false;
    if (from && (b.appointmentDate || '') < from) return false;
    if (to && (b.appointmentDate || '') > to) return false;
    if (status && (b.status || 'مجدول') !== status) return false;
    return true;
  });
  const STATUS_OPTS = ['مجدول','مؤكد','حضر','لم يحضر','ملغي'];
  tbody.innerHTML = rows.map(b => {
    const cur = b.status || 'مجدول';
    const opts = STATUS_OPTS.map(s => `<option value="${s}" ${s===cur?'selected':''}>${s}</option>`).join('');
    const cls = ({'حضر':'st-ok','لم يحضر':'st-no','ملغي':'st-cancel','مؤكد':'st-confirm','مجدول':'st-pending'})[cur] || '';
    return `
    <tr>
      <td>${escape(b.fullName)}</td>
      <td>${escape(b.phone)}</td>
      <td>${escape(b.doctor)}</td>
      <td>${escape(b.appointmentDate)}</td>
      <td>${escape(b.appointmentTime)}</td>
      <td>${escape(b.paymentMethod || '-')}${b.amount ? ` (${escape(b.amount)} ج.م)` : ''}</td>
      <td><select class="status-cell ${cls}" onchange="updateStatus('${b.id}', this.value)">${opts}</select></td>
      <td class="row-actions">
        <button class="btn small ghost" onclick="editBooking('${b.id}')">✏️ تعديل</button>
        <button class="btn small danger" onclick="deleteBooking('${b.id}')">🗑️ حذف</button>
      </td>
    </tr>`;
  }).join('');
  empty.style.display = rows.length ? 'none' : '';
  $('#bookingsTable').style.display = rows.length ? '' : 'none';
}

function updateStatus(id, value) {
  const b = bookings.find(x => x.id === id);
  if (!b) return;
  b.status = value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  logAudit('Edit', id, `الحالة: ${value}`);
  renderTable();
  toast('تم تحديث الحالة: ' + value);
}
window.updateStatus = updateStatus;

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

$('#searchInput').addEventListener('input', () => renderTable());
$('#searchDateFrom').addEventListener('change', () => renderTable());
$('#searchDateTo').addEventListener('change', () => renderTable());
$('#searchStatus').addEventListener('change', () => renderTable());
$('#clearFiltersBtn').addEventListener('click', () => {
  $('#searchInput').value = '';
  $('#searchDateFrom').value = '';
  $('#searchDateTo').value = '';
  $('#searchStatus').value = '';
  renderTable();
});

// ============ Excel Export / Import ============
const EXCEL_COLS = [
  ['id','المعرف'],['fullName','الاسم الكامل'],['idNumber','رقم الهوية'],
  ['birthDate','تاريخ الميلاد'],['phone','الجوال'],['gender','الجنس'],
  ['email','البريد'],['specialty','التخصص'],['condition','وصف الحالة'],
  ['appointmentDate','تاريخ الموعد'],['doctor','الطبيب'],
  ['appointmentTime','الوقت'],['duration','المدة (د)'],
  ['paymentMethod','طريقة الدفع'],['amount','الرسوم (ج.م)'],
  ['status','حالة الحجز'],['notes','ملاحظات'],
];

$('#exportExcelBtn').addEventListener('click', () => {
  if (!window.XLSX) { toast('تعذر تحميل مكتبة Excel'); return; }
  const f = ($('#searchInput')?.value || '').toLowerCase();
  const from = $('#searchDateFrom')?.value || '';
  const to = $('#searchDateTo')?.value || '';
  const rows = bookings.filter(b => {
    if (f && !(b.fullName?.toLowerCase().includes(f) || (b.phone||'').includes(f))) return false;
    if (from && (b.appointmentDate || '') < from) return false;
    if (to && (b.appointmentDate || '') > to) return false;
    return true;
  });
  const data = rows.map(b => {
    const r = {};
    EXCEL_COLS.forEach(([k,label]) => r[label] = b[k] ?? '');
    return r;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: EXCEL_COLS.map(c => c[1]) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الحجوزات');
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `bookings_${stamp}.xlsx`);
  toast('تم تصدير الحجوزات');
});

$('#importExcelBtn').addEventListener('click', () => $('#importExcelFile').click());
$('#importExcelFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!window.XLSX) { toast('تعذر تحميل مكتبة Excel'); return; }
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const labelToKey = Object.fromEntries(EXCEL_COLS.map(([k,l]) => [l,k]));
    let added = 0;
    rows.forEach(r => {
      const b = {};
      Object.keys(r).forEach(label => {
        const k = labelToKey[label] || label;
        b[k] = String(r[label] ?? '');
      });
      if (!b.id) b.id = Date.now().toString() + Math.random().toString(36).slice(2,6);
      if (!b.fullName) return;
      // avoid duplicates by id
      const idx = bookings.findIndex(x => x.id === b.id);
      if (idx >= 0) bookings[idx] = { ...bookings[idx], ...b };
      else bookings.push(b);
      added++;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    renderTable();
    toast(`تم استيراد ${added} سجل`);
  } catch (err) {
    console.error(err);
    toast('فشل استيراد الملف');
  } finally {
    e.target.value = '';
  }
});

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

// ============ Available Slots Modal ============
const availableModal = $('#availableModal');
const availableList = $('#availableList');
const DAY_NAMES = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

function populateAvailableDoctorFilter() {
  const sel = $('#availableDoctorFilter');
  const current = sel.value;
  const fromDoctors = doctors.map(d => d.name).filter(Boolean);
  const fromBookings = bookings.map(b => b.doctor).filter(Boolean);
  const names = [...new Set([...fromDoctors, ...fromBookings])].sort();
  sel.innerHTML = '<option value="">كل الأطباء</option>' +
    names.map(n => `<option value="${escape(n)}">${escape(n)}</option>`).join('');
  if (names.includes(current)) sel.value = current;
}

function renderAvailableSlots() {
  populateAvailableDoctorFilter();
  const days = Number($('#availableDays').value) || 7;
  const doctorFilter = $('#availableDoctorFilter').value.trim();
  const cfg = getScheduleFor(doctorFilter);
  const slots = generateSlots(doctorFilter);
  if (!slots.length) {
    availableList.innerHTML = '<p class="muted">لم يتم ضبط ساعات العمل. افتح إعدادات المواعيد.</p>';
    return;
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const nowMin = new Date().getHours()*60 + new Date().getMinutes();
  const todayStr = today.toISOString().slice(0,10);
  let html = '';
  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const iso = d.toISOString().slice(0,10);
    const dow = d.getDay();
    if (!cfg.days.includes(dow)) continue;
    const taken = bookings
      .filter(b => b.appointmentDate === iso && (!doctorFilter || b.doctor === doctorFilter))
      .map(b => b.appointmentTime);
    const slotHtml = slots.map(t => {
      const isPast = iso === todayStr && toMin(t) <= nowMin;
      const isTaken = taken.includes(t);
      const cls = isTaken ? 'taken' : (isPast ? 'past' : 'free');
      const label = isTaken ? 'محجوز' : (isPast ? 'منتهي' : 'متاح');
      return `<div class="avail-slot ${cls}"><span class="t">${t}</span><span class="s">${label}</span></div>`;
    }).join('');
    const freeCount = slots.filter(t => !taken.includes(t) && !(iso===todayStr && toMin(t)<=nowMin)).length;
    const heading = doctorFilter ? `${DAY_NAMES[dow]} - ${iso} — ${escape(doctorFilter)}` : `${DAY_NAMES[dow]} - ${iso}`;
    html += `
      <div class="day-block">
        <div class="day-header">
          <strong>${heading}</strong>
          <span class="muted">${freeCount} موعد متاح / كل ${cfg.slotMinutes} د</span>
        </div>
        <div class="avail-grid">${slotHtml}</div>
      </div>`;
  }
  availableList.innerHTML = html || '<p class="muted">لا توجد أيام عمل في الفترة المحددة.</p>';
}

$('#showAvailableBtn').addEventListener('click', () => {
  renderAvailableSlots();
  availableModal.style.display = 'flex';
});
$('#closeAvailableBtn').addEventListener('click', () => { availableModal.style.display = 'none'; });
availableModal.addEventListener('click', (e) => {
  if (e.target === availableModal) availableModal.style.display = 'none';
});
$('#availableDays').addEventListener('change', renderAvailableSlots);
$('#availableDoctorFilter').addEventListener('change', renderAvailableSlots);

// ============ Init ============
refreshDoctorsUI();
showStep(1);
renderTable();
renderTimeSlots();
