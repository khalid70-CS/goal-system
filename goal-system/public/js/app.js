// Helpers
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const fmtDate = (s) => {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' });
};

const pLabel = (p) => ({ high:'عالية', medium:'متوسطة', low:'منخفضة' }[p] || p);
const sLabel = (s) => ({ idea:'فكرة', active:'نشط', completed:'مكتمل', archived:'مؤرشف' }[s] || s);

const esc = (t) => {
  const d = document.createElement('div'); d.textContent = t;
  return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

// Theme
function initTheme() {
  const saved = localStorage.getItem('gs_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved ? saved === 'dark' : prefersDark;
  document.documentElement.classList.toggle('dark', isDark);
  updateThemeIcon(isDark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('gs_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const moon = $('#moon-icon');
  const sun = $('#sun-icon');
  const label = $('#theme-label');
  if (!moon || !sun) return;
  moon.classList.toggle('hidden', isDark);
  sun.classList.toggle('hidden', !isDark);
  if (label) label.textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';
}

// Toasts
function toast(msg, type = 'info') {
  const c = $('#toast-container');
  const el = document.createElement('div');
  const styles = { success: 'toast-success', error: 'toast-error', info: 'toast-info' };
  el.className = `toast ${styles[type] || 'toast-info'}`;
  el.innerHTML = `<span>${esc(msg)}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; setTimeout(() => el.remove(), 300); }, 3500);
}

// Modal
function openModal(title, bodyHtml) {
  const overlay = $('#modal-overlay');
  const content = $('#modal-content');
  content.innerHTML = `
    <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <h3 class="text-lg font-bold text-gray-900 dark:text-white">${esc(title)}</h3>
      <button onclick="closeModal()" class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="p-6">${bodyHtml}</div>
  `;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('#modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// Router
let currentRoute = '';

function parseHash() {
  const h = location.hash.slice(1) || 'dashboard';
  const parts = h.split('/');
  return { route: parts[0], params: parts.slice(1) };
}

async function navigate(route, ...params) {
  location.hash = params.length ? `${route}/${params.join('/')}` : route;
}

async function render() {
  const { route, params } = parseHash();
  currentRoute = route;
  updateNav();
  updateTitle(route);

  const content = $('#content');
  content.innerHTML = '<div class="flex items-center justify-center py-20"><div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div></div>';

  try {
    switch (route) {
      case 'dashboard': content.innerHTML = await renderDashboard(); break;
      case 'goals': content.innerHTML = await renderGoals(); break;
      case 'goal': content.innerHTML = await renderGoalWorkspace(params[0]); break;
      case 'session': content.innerHTML = await renderSession(params[0], params[1]); break;
      case 'notes': content.innerHTML = await renderNotes(); break;
      case 'archive': content.innerHTML = await renderArchive(); break;
      case 'settings': content.innerHTML = await renderSettings(); break;
      default: content.innerHTML = await renderDashboard();
    }
    attachEvents(content);
  } catch (e) {
    console.error(e);
    content.innerHTML = `<div class="text-center py-20 text-red-500">حدث خطأ: ${esc(e.message)}</div>`;
  }
}

function updateNav() {
  $$('.nav-link').forEach(l => {
    const r = l.dataset.route;
    const active = currentRoute === r || (currentRoute === 'goal' && r === 'goals') || (currentRoute === 'session' && r === 'goals');
    l.classList.toggle('active', active);
  });
}

function updateTitle(route) {
  const titles = { dashboard: 'الرئيسية', goals: 'الأهداف', goal: 'مساحة العمل', session: 'جلسة العمل', notes: 'الملاحظات', archive: 'الأرشيف', settings: 'الإعدادات' };
  $('#page-title').textContent = titles[route] || 'الرئيسية';
}

function toggleSidebar() {
  $('#sidebar').classList.toggle('open');
  $('#mobile-overlay').classList.toggle('hidden');
}

// Views

// Dashboard
async function renderDashboard() {
  const goals = await api.get('/goals?status=active');
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  goals.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const topGoals = goals.slice(0, 3);

  const allSessions = await api.get('/sessions');
  const lastSession = allSessions[0];
  const incompleteSession = allSessions.find(s => !s.isCompleted);

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklySessions = allSessions.filter(s => new Date(s.date) >= weekAgo);
  const totalNotes = (await api.get('/notes')).length;

  const stats = [
    { label: 'أهداف نشطة', value: goals.length, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'جلسات هذا الأسبوع', value: weeklySessions.length, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'إجمالي الجلسات', value: allSessions.length, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'ملاحظات', value: totalNotes, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ];

  return `
    <div class="space-y-8 animate-fade-in">
      <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-8 text-white shadow-xl">
        <div class="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10"></div>
        <div class="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/5"></div>
        <div class="relative">
          <h2 class="mb-2 text-2xl font-bold">مرحباً بك في يومك</h2>
          <p class="text-primary-100">ماذا تريد أن تنجز اليوم؟ ابدأ بأولوياتك.</p>
        </div>
      </div>

      <section>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><circle cx="12" cy="12" r="3"/></svg>
            أولويات اليوم
          </h3>
          <button onclick="openCreateGoalModal()" class="btn-primary md:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            <span>هدف جديد</span>
          </button>
        </div>
        ${topGoals.length === 0 ? renderEmptyState('أهداف', 'لا توجد أهداف نشطة', 'ابدأ رحلتك بإنشاء أول هدف. كل رحلة كبيرة تبدأ بخطوة واحدة.', 'openCreateGoalModal()') : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${topGoals.map((g, i) => renderGoalCard(g, i)).join('')}
          </div>
        `}
      </section>

      ${incompleteSession ? `
        <section class="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 dark:border-amber-900/50 dark:bg-amber-900/10">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="mb-1 font-bold text-amber-900 dark:text-amber-400 flex items-center gap-2">
                <svg class="h-5 w-5 fill-amber-500 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                لديك جلسة غير مكتملة
              </h3>
              <p class="text-sm text-amber-700 dark:text-amber-500">${esc(incompleteSession.title)}</p>
            </div>
            <a href="#session/${incompleteSession.goalId}/${incompleteSession.id}" class="btn-primary bg-amber-600 hover:bg-amber-700 self-start">
              استئناف الجلسة
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </a>
          </div>
        </section>
      ` : lastSession ? `
        <section class="workspace-section">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="mb-1 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
                آخر جلسة
              </h3>
              <p class="text-sm text-gray-600 dark:text-slate-400">${esc(lastSession.title)}</p>
              ${lastSession.stopPoint ? `<p class="mt-1 text-xs text-gray-500 dark:text-slate-500">توقفت عند: ${esc(lastSession.stopPoint)}</p>` : ''}
            </div>
            <a href="#goal/${lastSession.goalId}" class="btn-secondary self-start">
              الذهاب للهدف
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </a>
          </div>
        </section>
      ` : ''}

      <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${stats.map((s, i) => `
          <div class="rounded-2xl border border-gray-200 bg-white p-5 text-center dark:border-slate-800 dark:bg-slate-900" style="animation: fadeIn 0.35s ease-out ${i * 0.05}s forwards; opacity: 0;">
            <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${s.bg}">
              <span class="text-2xl font-bold ${s.color}">${s.value}</span>
            </div>
            <div class="text-sm text-gray-500 dark:text-slate-400">${s.label}</div>
          </div>
        `).join('')}
      </section>
    </div>
  `;
}

// Goals
async function renderGoals() {
  const goals = await api.get('/goals?status=idea,active,completed');
  return `
    <div class="space-y-6 animate-fade-in">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">أهدافي</h2>
        <button onclick="openCreateGoalModal()" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          <span class="hidden sm:inline">هدف جديد</span>
        </button>
      </div>
      ${goals.length === 0
        ? renderEmptyState('أهداف', 'لا توجد أهداف بعد', 'ابدأ رحلتك بإنشاء أول هدف. كل إنجاز كبير يبدأ بقرار صغير.', 'openCreateGoalModal()')
        : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${goals.map((g, i) => renderGoalCard(g, i)).join('')}</div>`}
    </div>
  `;
}

// Goal workspace
async function renderGoalWorkspace(goalId) {
  let goal;
  try {
    goal = await api.get(`/goals/${encodeURIComponent(goalId)}`);
  } catch (e) {
    if (e.status === 404 || e.status === 400) return '<div class="text-center py-20 text-gray-500">الهدف غير موجود</div>';
    throw e;
  }
  const { plans, sessions, resources, notes } = goal;

  const lastSession = sessions[0];
  const incompleteSession = sessions.find(s => !s.isCompleted);

  const pColors = { high: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', medium: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', low: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  const sClasses = { active: 'status-active', completed: 'status-completed', archived: 'status-archived', idea: 'status-idea' };

  return `
    <div class="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div class="workspace-section">
        <div class="mb-4 flex items-start justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">${esc(goal.name)}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <span class="status-badge ${sClasses[goal.status]}">${sLabel(goal.status)}</span>
              ${goal.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="openEditGoalModal('${goal.id}')" class="btn-ghost" title="تعديل"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>
            ${goal.status !== 'archived'
              ? `<button onclick="archiveGoal('${goal.id}')" class="btn-ghost" title="أرشفة"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" x2="14" y1="12" y2="12"/></svg></button>`
              : `<button onclick="restoreGoal('${goal.id}')" class="btn-ghost" title="استعادة"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>`
            }
            <button onclick="deleteGoal('${goal.id}')" class="btn-ghost hover:text-red-600" title="حذف"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
          </div>
        </div>
        ${goal.description ? `<p class="mb-4 text-gray-600 dark:text-slate-400">${esc(goal.description)}</p>` : ''}
        ${lastSession ? `
          <div class="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 dark:bg-slate-800/50">
            <div>
              <div class="mb-1 text-xs text-gray-400 dark:text-slate-500">آخر نقطة توقف</div>
              <div class="text-sm font-medium text-gray-700 dark:text-slate-200">${esc(lastSession.stopPoint) || 'لم يُسجل'}</div>
            </div>
            <div>
              <div class="mb-1 text-xs text-gray-400 dark:text-slate-500">الخطوة التالية</div>
              <div class="text-sm font-medium text-primary-700 dark:text-primary-400">${esc(lastSession.nextStep) || 'لم يُحدد'}</div>
            </div>
          </div>
        ` : ''}
        <div class="flex gap-3">
          ${incompleteSession
            ? `<a href="#session/${goalId}/${incompleteSession.id}" class="btn-primary bg-amber-600 hover:bg-amber-700"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>استئناف الجلسة</a>`
            : `<button onclick="startSession('${goalId}')" class="btn-primary"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>بدء جلسة جديدة</button>`
          }
        </div>
      </div>

      <!-- Plans -->
      <div class="workspace-section">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            الخطة
          </h3>
          <button onclick="openAddPlanModal('${goalId}')" class="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
            <svg class="inline h-4 w-4 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            إضافة
          </button>
        </div>
        ${plans.length === 0 ? '<p class="py-4 text-center text-sm text-gray-400 dark:text-slate-500">لا توجد خطط. أضف خطة لتحقيق هدفك.</p>' : `
          <div class="space-y-3">${plans.map(p => `
            <div class="plan-phase ${p.status === 'active' ? 'border-primary-300 bg-primary-50/30 dark:border-primary-800 dark:bg-primary-900/10' : ''}">
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium text-gray-800 dark:text-slate-200">${esc(p.name)}</div>
                  ${p.description ? `<div class="mt-1 text-sm text-gray-500 dark:text-slate-400">${esc(p.description)}</div>` : ''}
                </div>
                <div class="flex items-center gap-2">
                  ${p.status === 'active' ? '<span class="status-badge status-active">نشطة</span>' : ''}
                  <button onclick="deletePlan('${p.id}')" class="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}</div>
        `}
      </div>

      <!-- Resources -->
      <div class="workspace-section">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            الموارد
          </h3>
          <button onclick="openAddResourceModal('${goalId}')" class="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
            <svg class="inline h-4 w-4 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            إضافة
          </button>
        </div>
        ${resources.length === 0 ? '<p class="py-4 text-center text-sm text-gray-400 dark:text-slate-500">لا توجد موارد. أضف مصادر تساعدك.</p>' : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${resources.map(r => `
            <div class="resource-link group">
              <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                ${resourceIcon(r.type)}
              </div>
              <div class="flex-1 min-w-0">
                <div class="truncate text-sm font-medium text-gray-800 dark:text-slate-200">${esc(r.name)}</div>
                ${r.description ? `<div class="truncate text-xs text-gray-500 dark:text-slate-500">${esc(r.description)}</div>` : ''}
              </div>
              ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:text-primary-700 dark:text-primary-400" onclick="event.stopPropagation()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg></a>` : ''}
              <button onclick="deleteResource('${r.id}')" class="opacity-0 text-gray-400 hover:text-red-500 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          `).join('')}</div>
        `}
      </div>

      <!-- Notes -->
      <div class="workspace-section">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>
            الملاحظات
          </h3>
          <button onclick="openAddNoteModal('${goalId}')" class="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
            <svg class="inline h-4 w-4 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            إضافة
          </button>
        </div>
        ${notes.length === 0 ? '<p class="py-4 text-center text-sm text-gray-400 dark:text-slate-500">لا توجد ملاحظات. دوّن أفكارك هنا.</p>' : `
          <div class="space-y-3">${notes.map(n => `
            <div class="note-card group">
              <p class="mb-2 text-sm text-gray-700 dark:text-slate-300">${esc(n.content)}</p>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400 dark:text-slate-500">${fmtDate(n.createdAt)}</span>
                <button onclick="deleteNote('${n.id}')" class="opacity-0 text-gray-400 hover:text-red-500 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `).join('')}</div>
        `}
      </div>

      <!-- Session History -->
      <div class="workspace-section">
        <h3 class="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
          سجل الجلسات
        </h3>
        ${sessions.length === 0 ? '<p class="py-4 text-center text-sm text-gray-400 dark:text-slate-500">لا توجد جلسات بعد. ابدأ أول جلسة.</p>' : `
          <div class="space-y-3">${sessions.map(s => `
            <a href="#session/${goalId}/${s.id}">
              <div class="session-history-item cursor-pointer">
                <div class="flex items-center justify-between mb-2">
                  <div class="font-medium text-gray-800 dark:text-slate-200">${esc(s.title)}</div>
                  <span class="status-badge ${s.isCompleted ? 'status-completed' : 'status-idea'}">${s.isCompleted ? 'مكتملة' : 'قيد التنفيذ'}</span>
                </div>
                ${s.summary ? `<p class="text-sm text-gray-600 dark:text-slate-400 mb-2">${esc(s.summary)}</p>` : ''}
                <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-500">
                  <span>${fmtDate(s.date)}</span>
                  ${s.duration ? `<span>${s.duration} دقيقة</span>` : ''}
                </div>
              </div>
            </a>
          `).join('')}</div>
        `}
      </div>
    </div>
  `;
}

// Session
async function renderSession(goalId, sessionId) {
  let goal, session;
  try {
    [goal, session] = await Promise.all([
      api.get(`/goals/${encodeURIComponent(goalId)}`),
      api.get(`/sessions/${encodeURIComponent(sessionId)}`) // session + tasks + notes
    ]);
  } catch (e) {
    if (e.status === 404 || e.status === 400) return '<div class="text-center py-20 text-gray-500">الجلسة غير موجودة</div>';
    throw e;
  }
  const { tasks, notes } = session;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return `
    <div class="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div class="workspace-section">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <div class="mb-1 text-sm text-gray-500 dark:text-slate-400">
              <a href="#goal/${goalId}" class="hover:text-primary-600 dark:hover:text-primary-400">${esc(goal.name)}</a>
              <span class="mx-2">/</span>
              <span>جلسة عمل</span>
            </div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">${esc(session.title)}</h2>
          </div>
          <div>
            ${session.isCompleted
              ? `<div class="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>مكتملة</div>`
              : `<div class="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 animate-pulse-slow dark:bg-amber-900/20 dark:text-amber-400"><svg class="fill-amber-500 text-amber-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>جارية</div>`
            }
          </div>
        </div>
        ${!session.isCompleted ? `
          <div class="flex flex-wrap gap-3">
            <button onclick="completeSession('${sessionId}')" class="btn-primary bg-emerald-600 hover:bg-emerald-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              إنهاء الجلسة
            </button>
            <button onclick="cancelSession('${sessionId}')" class="btn-danger">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              إلغاء
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Tasks -->
      <div class="workspace-section">
        <h3 class="mb-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          المهام (${completedCount}/${tasks.length})
        </h3>
        ${!session.isCompleted ? `
          <div class="flex gap-2 mb-4">
            <input type="text" id="new-task-input" placeholder="مهمة جديدة..." class="input-field flex-1" onkeydown="if(event.key==='Enter') addTask('${sessionId}')">
            <button onclick="addTask('${sessionId}')" class="btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
          </div>
        ` : ''}
        <div class="space-y-2">
          ${tasks.length === 0 ? '<div class="py-6 text-center text-sm text-gray-400 dark:text-slate-500">لا توجد مهام. أضف أول مهمة للبدء.</div>' : tasks.map(t => `
            <div class="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/50 ${t.status === 'completed' ? 'opacity-60' : ''}">
              <input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} onchange="toggleTask('${t.id}', this.checked)" ${session.isCompleted ? 'disabled' : ''} class="task-checkbox">
              <span class="flex-1 text-sm ${t.status === 'completed' ? 'text-gray-400 line-through dark:text-slate-500' : 'text-gray-700 dark:text-slate-200'}">${esc(t.title)}</span>
              ${!session.isCompleted ? `<button onclick="deleteTask('${t.id}')" class="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Session Notes -->
      <div class="workspace-section">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>
            ملاحظات الجلسة
          </h3>
          ${!session.isCompleted ? `
            <button onclick="openAddSessionNoteModal('${sessionId}')" class="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
              <svg class="inline h-4 w-4 ml-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              إضافة
            </button>
          ` : ''}
        </div>
        <div class="space-y-3">
          ${notes.length === 0 ? '<div class="py-4 text-center text-sm text-gray-400 dark:text-slate-500">لا توجد ملاحظات للجلسة.</div>' : notes.map(n => `
            <div class="note-card group">
              <p class="mb-2 text-sm text-gray-700 dark:text-slate-300">${esc(n.content)}</p>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400 dark:text-slate-500">${fmtDate(n.createdAt)}</span>
                <button onclick="deleteNote('${n.id}')" class="opacity-0 text-gray-400 hover:text-red-500 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Session Meta -->
      ${!session.isCompleted ? `
        <div class="workspace-section">
          <h3 class="mb-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            معلومات الجلسة
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">نقطة التوقف</label>
              <textarea id="stop-point" rows="2" class="input-field resize-none" placeholder="أين توقفت؞">${esc(session.stopPoint || '')}</textarea>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الخطوة التالية</label>
              <textarea id="next-step" rows="2" class="input-field resize-none" placeholder="ماذا ستفعل في الجلسة القادمة؟">${esc(session.nextStep || '')}</textarea>
            </div>
          </div>
          <div class="mt-4">
            <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">ملخص الجلسة</label>
            <textarea id="session-summary" rows="3" class="input-field resize-none" placeholder="ملخص ما أنجزته...">${esc(session.summary || '')}</textarea>
          </div>
        </div>
      ` : `
        <div class="workspace-section">
          <h3 class="mb-4 font-bold text-gray-900 dark:text-white">تفاصيل الجلسة</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="rounded-xl bg-gray-50 p-4 dark:bg-slate-800/50">
              <div class="mb-1 text-xs text-gray-400 dark:text-slate-500">نقطة التوقف</div>
              <div class="text-sm text-gray-700 dark:text-slate-200">${esc(session.stopPoint) || '—'}</div>
            </div>
            <div class="rounded-xl bg-gray-50 p-4 dark:bg-slate-800/50">
              <div class="mb-1 text-xs text-gray-400 dark:text-slate-500">الخطوة التالية</div>
              <div class="text-sm text-primary-700 dark:text-primary-400">${esc(session.nextStep) || '—'}</div>
            </div>
          </div>
          ${session.summary ? `
            <div class="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-slate-800/50">
              <div class="mb-1 text-xs text-gray-400 dark:text-slate-500">ملخص الجلسة</div>
              <div class="text-sm text-gray-700 dark:text-slate-200">${esc(session.summary)}</div>
            </div>
          ` : ''}
        </div>
      `}
    </div>
  `;
}

// Notes
async function renderNotes() {
  const notes = await api.get('/notes');
  const goals = await api.get('/goals?status=active,completed');

  return `
    <div class="space-y-6 animate-fade-in">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">الملاحظات</h2>
        <button onclick="openCreateNoteModal()" class="btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          <span class="hidden sm:inline">ملاحظة جديدة</span>
        </button>
      </div>
      ${notes.length === 0
        ? renderEmptyState('ملاحظات', 'لا توجد ملاحظات', 'دوّن أفكارك وملاحظاتك في مكان واحد. كل فكرة قد تكون بداية لشيء عظيم.', 'openCreateNoteModal()')
        : `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${notes.map((n, i) => {
          const g = n.goalId ? goals.find(x => x.id === n.goalId) : null;
          return `
            <div class="note-card group" style="animation: fadeIn 0.35s ease-out ${i * 0.05}s forwards; opacity: 0;">
              <p class="mb-3 text-sm text-gray-700 dark:text-slate-300">${esc(n.content)}</p>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  ${g ? `<span class="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">${esc(g.name)}</span>` : ''}
                  <span class="text-xs text-gray-400 dark:text-slate-500">${fmtDate(n.createdAt)}</span>
                </div>
                <button onclick="deleteNote('${n.id}')" class="opacity-0 text-gray-400 hover:text-red-500 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}</div>`}
    </div>
  `;
}

// Archive
async function renderArchive() {
  const goals = (await api.get('/goals?status=archived')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return `
    <div class="space-y-6 animate-fade-in">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">الأرشيف</h2>
      ${goals.length === 0
        ? renderEmptyState('أرشيف', 'الأرشيف فارغ', 'الأهداف المؤرشفة تظهر هنا. يمكنك استعادتها في أي وقت.', null)
        : `<div class="space-y-4">${goals.map((g, i) => `
          <div class="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900" style="animation: fadeIn 0.35s ease-out ${i * 0.05}s forwards; opacity: 0;">
            <div>
              <h3 class="font-bold text-gray-700 dark:text-slate-200">${esc(g.name)}</h3>
              <p class="mt-1 text-sm text-gray-400 dark:text-slate-500">تم الأرشفة: ${fmtDate(g.updatedAt)}</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="restoreGoal('${g.id}')" class="btn-secondary text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                استعادة
              </button>
              <button onclick="deleteGoal('${g.id}')" class="btn-danger text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                حذف
              </button>
            </div>
          </div>
        `).join('')}</div>`}
    </div>
  `;
}

// Settings
async function renderSettings() {
  return `
    <div class="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white">الإعدادات</h2>
      <div class="workspace-section space-y-6">
        <div>
          <h3 class="mb-4 font-bold text-gray-900 dark:text-white">البيانات</h3>
          <div class="space-y-3">
            <div class="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-800/50">
              <div>
                <div class="font-medium text-gray-800 dark:text-slate-200">تصدير البيانات</div>
                <div class="text-sm text-gray-500 dark:text-slate-400">تحميل نسخة احتياطية من جميع بياناتك</div>
              </div>
              <button onclick="exportData()" class="btn-secondary self-start">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                تصدير
              </button>
            </div>
            <div class="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-800/50">
              <div>
                <div class="font-medium text-gray-800 dark:text-slate-200">استيراد البيانات</div>
                <div class="text-sm text-gray-500 dark:text-slate-400">استعادة بيانات من ملف نسخ احتياطي سابق</div>
              </div>
              <button onclick="document.getElementById('import-file').click()" class="btn-secondary self-start">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                استيراد
              </button>
              <input type="file" id="import-file" class="hidden" accept=".json" onchange="importData(this)">
            </div>
            <div class="flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50/30 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/30 dark:bg-red-900/10">
              <div>
                <div class="font-medium text-red-800 dark:text-red-400">مسح جميع البيانات</div>
                <div class="text-sm text-red-600/70 dark:text-red-400/70">حذف كل الأهداف والجلسات والملاحظات بشكل نهائي</div>
              </div>
              <button onclick="clearAllData()" class="btn-danger self-start">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                مسح
              </button>
            </div>
          </div>
        </div>
        <div class="border-t border-gray-100 pt-6 dark:border-slate-800">
          <h3 class="mb-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            عن النظام
          </h3>
          <div class="space-y-2 text-sm text-gray-500 dark:text-slate-400">
            <p>نظام إدارة الأهداف الشخصية</p>
            <p>الإصدار 1.0</p>
            <p class="pt-2 text-xs text-gray-400 dark:text-slate-500">التقنيات: Vanilla JS, Tailwind CSS, Node.js + Express, SQLite</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// View helpers
function renderGoalCard(goal, index = 0) {
  const pColors = { high: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', medium: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', low: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
  return `
    <a href="#goal/${goal.id}" style="animation: fadeIn 0.35s ease-out ${index * 0.05}s forwards; opacity: 0; display: block;">
      <div class="goal-card priority-${goal.priority}">
        <div class="mb-3 flex items-start justify-between">
          <h4 class="font-bold text-gray-900 dark:text-white">${esc(goal.name)}</h4>
          <span class="status-badge ${pColors[goal.priority]}">${pLabel(goal.priority)}</span>
        </div>
        ${goal.description ? `<p class="mb-3 line-clamp-2 text-sm text-gray-500 dark:text-slate-400">${esc(goal.description)}</p>` : ''}
        <div class="flex flex-wrap gap-2 mb-3">${goal.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
          <span>${goal.updatedAt ? fmtDate(goal.updatedAt) : fmtDate(goal.createdAt)}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    </a>
  `;
}

function renderEmptyState(iconName, title, desc, action) {
  const icons = {
    أهداف: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>',
    ملاحظات: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>',
    أرشيف: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" x2="14" y1="12" y2="12"/></svg>'
  };
  return `
    <div class="empty-state">
      <div class="mb-4 text-gray-300 dark:text-slate-600">${icons[iconName] || icons.أهداف}</div>
      <h3 class="mb-2 text-lg font-bold text-gray-900 dark:text-white">${esc(title)}</h3>
      <p class="mb-6 max-w-sm text-sm text-gray-500 dark:text-slate-400">${esc(desc)}</p>
      ${action ? `<button onclick="${action}" class="btn-primary">${action.includes('Goal') ? 'إنشاء هدف' : action.includes('Note') ? 'إضافة ملاحظة' : 'بدء'}</button>` : ''}
    </div>
  `;
}

function resourceIcon(type) {
  const icons = {
    video: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>',
    book: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
    course: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    article: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
    file: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
    link: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
  };
  return icons[type] || icons.link;
}

function attachEvents(root) {
  // auto-attach any onclick handlers already in HTML
}

// Actions

// Goals
window.openCreateGoalModal = () => {
  openModal('إنشاء هدف جديد', `
    <form onsubmit="event.preventDefault(); createGoal(this);" class="space-y-4">
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">اسم الهدف *</label><input name="name" required class="input-field" placeholder="مثال: تعلم اللغة الإنجليزية"></div>
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الوصف</label><textarea name="description" rows="3" class="input-field resize-none" placeholder="وصف الهدف..."></textarea></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الأولوية</label>
          <select name="priority" class="input-field"><option value="high">عالية</option><option value="medium" selected>متوسطة</option><option value="low">منخفضة</option></select>
        </div>
        <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الوسوم</label><input name="tags" class="input-field" placeholder="تعليم، تقنية..."></div>
      </div>
      <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeModal()" class="btn-secondary">إلغاء</button><button type="submit" class="btn-primary">إنشاء</button></div>
    </form>
  `);
};

window.createGoal = async (form) => {
  const fd = new FormData(form);
  const tags = (fd.get('tags') || '').split(/[,،]/).map(t => t.trim()).filter(Boolean);
  await api.post('/goals', { name: fd.get('name'), description: fd.get('description'), priority: fd.get('priority'), tags });
  closeModal(); toast('تم إنشاء الهدف بنجاح', 'success'); render();
};

window.openEditGoalModal = async (id) => {
  const g = await api.get(`/goals/${id}`);
  openModal('تعديل الهدف', `
    <form onsubmit="event.preventDefault(); updateGoal('${id}', this);" class="space-y-4">
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">اسم الهدف *</label><input name="name" value="${esc(g.name)}" required class="input-field"></div>
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الوصف</label><textarea name="description" rows="3" class="input-field resize-none">${esc(g.description || '')}</textarea></div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الأولوية</label>
          <select name="priority" class="input-field"><option value="high" ${g.priority === 'high' ? 'selected' : ''}>عالية</option><option value="medium" ${g.priority === 'medium' ? 'selected' : ''}>متوسطة</option><option value="low" ${g.priority === 'low' ? 'selected' : ''}>منخفضة</option></select>
        </div>
        <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الحالة</label>
          <select name="status" class="input-field"><option value="idea" ${g.status === 'idea' ? 'selected' : ''}>فكرة</option><option value="active" ${g.status === 'active' ? 'selected' : ''}>نشط</option><option value="completed" ${g.status === 'completed' ? 'selected' : ''}>مكتمل</option></select>
        </div>
      </div>
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الوسوم</label><input name="tags" value="${esc(g.tags.join('، '))}" class="input-field"></div>
      <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeModal()" class="btn-secondary">إلغاء</button><button type="submit" class="btn-primary">حفظ</button></div>
    </form>
  `);
};

window.updateGoal = async (id, form) => {
  const fd = new FormData(form);
  const tags = (fd.get('tags') || '').split(/[,،]/).map(t => t.trim()).filter(Boolean);
  await api.patch(`/goals/${id}`, { name: fd.get('name'), description: fd.get('description'), status: fd.get('status'), priority: fd.get('priority'), tags });
  closeModal(); toast('تم تحديث الهدف', 'success'); render();
};

window.archiveGoal = async (id) => { if (!confirm('هل أنت متأكد من الأرشفة؟')) return; await api.patch(`/goals/${id}`, { status: 'archived' }); toast('تم الأرشفة', 'success'); navigate('goals'); };
window.restoreGoal = async (id) => { await api.patch(`/goals/${id}`, { status: 'active' }); toast('تم الاستعادة', 'success'); render(); };
window.deleteGoal = async (id) => {
  if (!confirm('هل أنت متأكد من الحذف النهائي مع جميع البيانات؟')) return;
  await api.delete(`/goals/${id}`);
  toast('تم الحذف', 'success'); navigate('goals');
};

// Sessions
window.startSession = async (goalId) => {
  const session = await api.post('/sessions', { goalId, title: `جلسة عمل ${new Date().toLocaleDateString('ar-SA')}` });
  navigate('session', goalId, session.id); toast('بدأت الجلسة. بالتوفيق!', 'success');
};

window.completeSession = async (sid) => {
  const sp = ($('#stop-point')?.value || '');
  const ns = ($('#next-step')?.value || '');
  const sm = ($('#session-summary')?.value || '');
  const s = await api.get(`/sessions/${sid}`);
  await api.patch(`/sessions/${sid}`, { stopPoint: sp, nextStep: ns, summary: sm, isCompleted: true, duration: s.duration || Math.round((Date.now() - new Date(s.date).getTime()) / 60000) });
  toast('تم إنهاء الجلسة', 'success'); render();
};

window.cancelSession = async (sid) => { if (!confirm('إلغاء الجلسة؟')) return; await api.delete(`/sessions/${sid}`); toast('تم الإلغاء', 'info'); history.back(); };

// Tasks
window.addTask = async (sid) => {
  const inp = $('#new-task-input'); const t = inp.value.trim(); if (!t) return;
  await api.post('/tasks', { sessionId: sid, title: t });
  inp.value = ''; render();
};
window.toggleTask = async (tid, checked) => {
  await api.patch(`/tasks/${tid}`, { status: checked ? 'completed' : 'pending' });
  render();
};
window.deleteTask = async (tid) => { await api.delete(`/tasks/${tid}`); render(); };

// Plans
window.openAddPlanModal = (gid) => {
  openModal('إضافة خطة', `
    <form onsubmit="event.preventDefault(); addPlan('${gid}', this);" class="space-y-4">
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">اسم الخطة *</label><input name="name" required class="input-field" placeholder="مثال: المرحلة الأولى"></div>
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الوصف</label><textarea name="description" rows="2" class="input-field resize-none"></textarea></div>
      <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeModal()" class="btn-secondary">إلغاء</button><button type="submit" class="btn-primary">إضافة</button></div>
    </form>
  `);
};
window.addPlan = async (gid, form) => {
  const fd = new FormData(form);
  await api.post('/plans', { goalId: gid, name: fd.get('name'), description: fd.get('description') });
  closeModal(); toast('تم إضافة الخطة', 'success'); render();
};
window.deletePlan = async (pid) => { if (!confirm('حذف الخطة؟')) return; await api.delete(`/plans/${pid}`); render(); };

// Resources
window.openAddResourceModal = (gid) => {
  openModal('إضافة مورد', `
    <form onsubmit="event.preventDefault(); addResource('${gid}', this);" class="space-y-4">
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">اسم المورد *</label><input name="name" required class="input-field" placeholder="مثال: دورة Udemy"></div>
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الرابط</label><input name="url" type="url" class="input-field" placeholder="https://..."></div>
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">النوع</label>
        <select name="type" class="input-field"><option value="link">رابط</option><option value="course">دورة</option><option value="book">كتاب</option><option value="video">فيديو</option><option value="article">مقال</option></select>
      </div>
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">الوصف</label><textarea name="description" rows="2" class="input-field resize-none"></textarea></div>
      <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeModal()" class="btn-secondary">إلغاء</button><button type="submit" class="btn-primary">إضافة</button></div>
    </form>
  `);
};
window.addResource = async (gid, form) => {
  const fd = new FormData(form);
  await api.post('/resources', { goalId: gid, name: fd.get('name'), url: fd.get('url'), type: fd.get('type'), description: fd.get('description') });
  closeModal(); toast('تم إضافة المورد', 'success'); render();
};
window.deleteResource = async (rid) => { await api.delete(`/resources/${rid}`); render(); };

// Notes
window.openAddNoteModal = (gid) => {
  openModal('إضافة ملاحظة', `
    <form onsubmit="event.preventDefault(); addNote('${gid}', this);" class="space-y-4">
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">المحتوى *</label><textarea name="content" required rows="4" class="input-field resize-none" placeholder="اكتب ملاحظتك..."></textarea></div>
      <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeModal()" class="btn-secondary">إلغاء</button><button type="submit" class="btn-primary">حفظ</button></div>
    </form>
  `);
};
window.openCreateNoteModal = () => {
  openModal('إضافة ملاحظة', `
    <form onsubmit="event.preventDefault(); createNote(this);" class="space-y-4">
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">المحتوى *</label><textarea name="content" required rows="4" class="input-field resize-none" placeholder="اكتب ملاحظتك..."></textarea></div>
      <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeModal()" class="btn-secondary">إلغاء</button><button type="submit" class="btn-primary">حفظ</button></div>
    </form>
  `);
};
window.openAddSessionNoteModal = (sid) => {
  openModal('إضافة ملاحظة', `
    <form onsubmit="event.preventDefault(); addSessionNote('${sid}', this);" class="space-y-4">
      <div><label class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">المحتوى *</label><textarea name="content" required rows="4" class="input-field resize-none" placeholder="اكتب ملاحظتك..."></textarea></div>
      <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="closeModal()" class="btn-secondary">إلغاء</button><button type="submit" class="btn-primary">حفظ</button></div>
    </form>
  `);
};
window.addNote = async (gid, form) => {
  const fd = new FormData(form);
  await api.post('/notes', { content: fd.get('content'), goalId: gid });
  closeModal(); toast('تم إضافة الملاحظة', 'success'); render();
};
window.createNote = async (form) => {
  const fd = new FormData(form);
  await api.post('/notes', { content: fd.get('content') });
  closeModal(); toast('تم إضافة الملاحظة', 'success'); render();
};
window.addSessionNote = async (sid, form) => {
  const fd = new FormData(form);
  await api.post('/notes', { content: fd.get('content'), sessionId: sid });
  closeModal(); toast('تم إضافة الملاحظة', 'success'); render();
};
window.deleteNote = async (nid) => { await api.delete(`/notes/${nid}`); render(); };

// Settings
window.exportData = async () => {
  const data = await api.get('/export');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `goal-system-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
  toast('تم التصدير', 'success');
};
window.importData = async (input) => {
  const file = input.files[0]; if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await api.post('/import', data);
    toast('تم الاستيراد', 'success'); navigate('dashboard');
  } catch (e) { toast(e instanceof SyntaxError ? 'ملف غير صالح' : e.message, 'error'); }
  input.value = '';
};
window.clearAllData = async () => { if (!confirm('مسح الكل؟')) return; await api.delete('/data'); location.reload(); };

// Start app
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  render();
  window.addEventListener('hashchange', render);
  window.addEventListener('unhandledrejection', (e) => { toast(e.reason?.message || 'حدث خطأ غير متوقع', 'error'); });
  $('#theme-toggle').addEventListener('click', toggleTheme);
});
