// ============ Reports Dashboard ============
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const bookings = JSON.parse(localStorage.getItem('clinic_bookings_v1') || '[]');
const auditLog = JSON.parse(localStorage.getItem('clinic_audit_v1') || '[]');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function num(v) { return Number(v) || 0; }

// ---------- Filters ----------
function getFiltered() {
  const from = $('#fFrom').value, to = $('#fTo').value;
  const doc = $('#fDoctor').value, pay = $('#fPayment').value, st = $('#fStatus').value;
  return bookings.filter(b => {
    if (from && (b.appointmentDate || '') < from) return false;
    if (to && (b.appointmentDate || '') > to) return false;
    if (doc && b.doctor !== doc) return false;
    if (pay && b.paymentMethod !== pay) return false;
    if (st && (b.status || 'مجدول') !== st) return false;
    return true;
  });
}

function populateDoctorFilter() {
  const docs = [...new Set(bookings.map(b => b.doctor).filter(Boolean))];
  $('#fDoctor').innerHTML = '<option value="">الكل</option>' +
    docs.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
}

['#fFrom','#fTo','#fDoctor','#fPayment','#fStatus','#scheduleGroup'].forEach(s => {
  document.addEventListener('change', e => { if (e.target.matches(s)) renderAll(); });
});
$('#clearF').addEventListener('click', () => {
  ['#fFrom','#fTo','#fDoctor','#fPayment','#fStatus'].forEach(s => $(s).value = '');
  renderAll();
});

// ---------- Tabs ----------
$$('#tabs .tab').forEach(t => t.addEventListener('click', () => {
  $$('#tabs .tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $$('.report-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === t.dataset.tab));
}));

// ---------- Chart Helpers ----------
const charts = {};
function makeChart(id, type, labels, datasets, opts={}) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type, data: { labels, datasets },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, ...opts }
  });
}

// ---------- KPIs ----------
function renderKpis(rows) {
  const revenue = rows.reduce((s,b) => s + num(b.amount), 0);
  const attended = rows.filter(b => b.status === 'حضر').length;
  const noShow = rows.filter(b => b.status === 'لم يحضر').length;
  $('#kpiTotal').textContent = rows.length;
  $('#kpiRevenue').textContent = revenue.toLocaleString();
  $('#kpiAttended').textContent = attended;
  $('#kpiNoShow').textContent = noShow;
  $('#kpiConversion').textContent = rows.length ? ((attended/rows.length)*100).toFixed(1)+'%' : '0%';
  $('#kpiNoShowRate').textContent = rows.length ? ((noShow/rows.length)*100).toFixed(1)+'%' : '0%';
}

// ---------- 1. Schedule ----------
function groupKey(date, mode) {
  if (!date) return '-';
  const d = new Date(date);
  if (mode === 'month') return date.slice(0,7);
  if (mode === 'week') {
    const onejan = new Date(d.getFullYear(),0,1);
    const week = Math.ceil((((d - onejan)/86400000) + onejan.getDay()+1)/7);
    return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
  }
  return date;
}
function renderSchedule(rows) {
  const mode = $('#scheduleGroup').value;
  const buckets = {};
  rows.forEach(b => {
    const k = groupKey(b.appointmentDate, mode);
    buckets[k] = (buckets[k] || 0) + 1;
  });
  const labels = Object.keys(buckets).sort();
  const data = labels.map(l => buckets[l]);
  makeChart('scheduleChart', 'line', labels, [{
    label:'عدد المواعيد', data, borderColor:'#2c4cdf', backgroundColor:'rgba(44,76,223,0.2)', tension:0.3, fill:true
  }]);
  // table by date + doctor
  const tbl = {};
  rows.forEach(b => {
    const k = `${b.appointmentDate}||${b.doctor}`;
    tbl[k] = (tbl[k] || 0) + 1;
  });
  const trs = Object.entries(tbl).sort().map(([k,v]) => {
    const [d,doc] = k.split('||');
    return `<tr><td>${esc(d)}</td><td>${esc(doc)}</td><td>${v}</td></tr>`;
  }).join('');
  $('#scheduleTable tbody').innerHTML = trs;
}

// ---------- 2. Doctor Performance ----------
function renderDoctor(rows) {
  const map = {};
  rows.forEach(b => {
    const d = b.doctor || '-';
    if (!map[d]) map[d] = { patients: new Set(), revenue: 0, count: 0 };
    map[d].patients.add(b.phone || b.fullName);
    map[d].revenue += num(b.amount);
    map[d].count++;
  });
  const labels = Object.keys(map);
  const counts = labels.map(d => map[d].count);
  makeChart('doctorChart', 'bar', labels, [{
    label:'عدد المرضى', data: counts, backgroundColor:'#2c4cdf'
  }]);
  $('#doctorTable tbody').innerHTML = labels.map(d =>
    `<tr><td>${esc(d)}</td><td>${map[d].count}</td><td>${map[d].revenue.toLocaleString()}</td></tr>`
  ).join('');
}

// ---------- 3. Revenue ----------
function renderRevenue(rows) {
  const byDate = {};
  rows.forEach(b => {
    const k = b.appointmentDate || '-';
    byDate[k] = (byDate[k] || 0) + num(b.amount);
  });
  const labels = Object.keys(byDate).sort();
  const data = labels.map(l => byDate[l]);
  makeChart('revenueChart', 'line', labels, [{
    label:'الإيراد (ج.م)', data, borderColor:'#16a34a', backgroundColor:'rgba(22,163,74,0.2)', tension:0.3, fill:true
  }]);
  const tbl = {};
  rows.forEach(b => {
    const k = `${b.appointmentDate}||${b.doctor}`;
    tbl[k] = (tbl[k] || 0) + num(b.amount);
  });
  $('#revenueTable tbody').innerHTML = Object.entries(tbl).sort().map(([k,v]) => {
    const [d,doc] = k.split('||');
    return `<tr><td>${esc(d)}</td><td>${esc(doc)}</td><td>${v.toLocaleString()}</td></tr>`;
  }).join('');
}

// ---------- 4. Payment ----------
function renderPayment(rows) {
  const map = {};
  rows.forEach(b => {
    const k = b.paymentMethod || '-';
    if (!map[k]) map[k] = { count:0, amount:0 };
    map[k].count++;
    map[k].amount += num(b.amount);
  });
  const labels = Object.keys(map);
  const data = labels.map(l => map[l].count);
  makeChart('paymentChart', 'pie', labels, [{
    data, backgroundColor:['#2c4cdf','#16a34a','#f59e0b','#dc2626','#8b5cf6']
  }]);
  $('#paymentTable tbody').innerHTML = labels.map(l =>
    `<tr><td>${esc(l)}</td><td>${map[l].count}</td><td>${map[l].amount.toLocaleString()}</td></tr>`
  ).join('');
}

// ---------- 5. Patient Activity ----------
function renderPatient(rows) {
  const map = {};
  rows.forEach(b => {
    const k = b.phone || b.fullName;
    if (!map[k]) map[k] = { name: b.fullName, phone: b.phone, count: 0 };
    map[k].count++;
  });
  const list = Object.values(map).sort((a,b) => b.count - a.count);
  $('#patientTable tbody').innerHTML = list.map(p =>
    `<tr><td>${esc(p.name)}</td><td>${esc(p.phone)}</td><td>${p.count}</td><td>${p.count>1?'متكرر':'جديد'}</td></tr>`
  ).join('');
}

// ---------- 6. No-Show ----------
function renderNoShow(rows) {
  const ns = rows.filter(b => b.status === 'لم يحضر');
  $('#noshowTable tbody').innerHTML = ns.map(b =>
    `<tr><td>${esc(b.fullName)}</td><td>${esc(b.doctor)}</td><td>${esc(b.appointmentDate)}</td><td>${esc(b.status)}</td></tr>`
  ).join('') || '<tr><td colspan="4" style="text-align:center;color:#888">لا توجد حالات</td></tr>';
}

// ---------- 7. Contact ----------
function renderContact(rows) {
  const map = {};
  rows.forEach(b => {
    const k = b.phone || b.fullName;
    if (!map[k] || (b.appointmentDate || '') > (map[k].lastDate || '')) {
      map[k] = { name: b.fullName, phone: b.phone, lastDate: b.appointmentDate };
    }
  });
  $('#contactTable tbody').innerHTML = Object.values(map).map(p =>
    `<tr><td>${esc(p.name)}</td><td>${esc(p.phone)}</td><td>${esc(p.lastDate)}</td></tr>`
  ).join('');
}

// ---------- 8. Audit ----------
function bookingInfo(id, fallbackName) {
  const b = bookings.find(x => String(x.id) === String(id));
  return {
    name: b?.fullName || b?.patientName || b?.name || fallbackName || '-',
    contact: b?.phone || b?.mobile || b?.contact || '-'
  };
}
function renderAudit() {
  const rows = [...auditLog].reverse();
  $('#auditTable tbody').innerHTML = rows.map(a => {
    const info = bookingInfo(a.bookingId, a.details);
    return `<tr><td>${esc(a.action)}</td><td>${esc(a.user)}</td><td>${new Date(a.timestamp).toLocaleString('ar-EG')}</td><td>${esc(info.name)}</td><td>${esc(info.contact)}</td><td>${esc(a.details||'')}</td></tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:#888">لا توجد سجلات</td></tr>';
}

// ---------- 9. Conversion ----------
function renderConversion(rows) {
  const total = rows.length;
  const attended = rows.filter(b => b.status === 'حضر').length;
  const noShow = rows.filter(b => b.status === 'لم يحضر').length;
  const rate = total ? (attended/total*100).toFixed(1) : 0;
  $('#cTotal').textContent = total;
  $('#cAttended').textContent = attended;
  $('#cNoShow').textContent = noShow;
  $('#cRate').textContent = rate + '%';
  makeChart('conversionChart', 'pie',
    ['حضر','لم يحضر','أخرى'],
    [{ data: [attended, noShow, total-attended-noShow], backgroundColor:['#16a34a','#dc2626','#9ca3af'] }]
  );
}

// ---------- Export ----------
function exportSheet(rows, name) {
  if (!window.XLSX) { alert('تعذر تحميل Excel'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0,30));
  XLSX.writeFile(wb, `${name}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-export]');
  if (!btn) return;
  const rows = getFiltered();
  const t = btn.dataset.export;
  if (t === 'schedule') {
    const mode = $('#scheduleGroup').value;
    const m = {};
    rows.forEach(b => { const k=groupKey(b.appointmentDate,mode); m[k]=(m[k]||0)+1; });
    exportSheet(Object.entries(m).map(([k,v])=>({'الفترة':k,'عدد المواعيد':v})), 'schedule');
  } else if (t === 'doctor') {
    const map = {};
    rows.forEach(b => { const d=b.doctor||'-'; if(!map[d])map[d]={c:0,r:0}; map[d].c++; map[d].r+=num(b.amount); });
    exportSheet(Object.entries(map).map(([d,v])=>({'الطبيب':d,'عدد المرضى':v.c,'الإيرادات':v.r})), 'doctor_performance');
  } else if (t === 'revenue') {
    const map={}; rows.forEach(b=>{const k=`${b.appointmentDate}|${b.doctor}`;map[k]=(map[k]||0)+num(b.amount);});
    exportSheet(Object.entries(map).map(([k,v])=>{const[d,doc]=k.split('|');return{'التاريخ':d,'الطبيب':doc,'الإيراد':v};}),'revenue');
  } else if (t === 'payment') {
    const map={}; rows.forEach(b=>{const k=b.paymentMethod||'-';if(!map[k])map[k]={c:0,a:0};map[k].c++;map[k].a+=num(b.amount);});
    exportSheet(Object.entries(map).map(([k,v])=>({'طريقة الدفع':k,'العدد':v.c,'الإجمالي':v.a})), 'payment');
  } else if (t === 'patient') {
    const map={}; rows.forEach(b=>{const k=b.phone||b.fullName;if(!map[k])map[k]={name:b.fullName,phone:b.phone,c:0};map[k].c++;});
    exportSheet(Object.values(map).map(p=>({'الاسم':p.name,'الجوال':p.phone,'عدد الزيارات':p.c,'النوع':p.c>1?'متكرر':'جديد'})), 'patients');
  } else if (t === 'noshow') {
    exportSheet(rows.filter(b=>b.status==='لم يحضر').map(b=>({'الاسم':b.fullName,'الطبيب':b.doctor,'التاريخ':b.appointmentDate,'الحالة':b.status})), 'noshow');
  } else if (t === 'contact') {
    const map={}; rows.forEach(b=>{const k=b.phone||b.fullName;if(!map[k]||(b.appointmentDate||'')>(map[k].d||''))map[k]={n:b.fullName,p:b.phone,d:b.appointmentDate};});
    exportSheet(Object.values(map).map(p=>({'الاسم':p.n,'الجوال':p.p,'آخر زيارة':p.d})), 'contacts');
  } else if (t === 'audit') {
    exportSheet(auditLog.map(a=>{const i=bookingInfo(a.bookingId, a.details);return{'الإجراء':a.action,'المستخدم':a.user,'التاريخ':a.timestamp,'اسم العميل':i.name,'وسيلة الاتصال':i.contact,'التفاصيل':a.details||''};}), 'audit');
  } else if (t === 'conversion') {
    const total=rows.length, att=rows.filter(b=>b.status==='حضر').length, ns=rows.filter(b=>b.status==='لم يحضر').length;
    exportSheet([{'إجمالي':total,'حضر':att,'لم يحضر':ns,'نسبة التحويل':total?(att/total*100).toFixed(1)+'%':'0%'}], 'conversion');
  }
});

// ---------- Render All ----------
function renderAll() {
  const rows = getFiltered();
  renderKpis(rows);
  renderSchedule(rows);
  renderDoctor(rows);
  renderRevenue(rows);
  renderPayment(rows);
  renderPatient(rows);
  renderNoShow(rows);
  renderContact(rows);
  renderAudit();
  renderConversion(rows);
}

populateDoctorFilter();
renderAll();
