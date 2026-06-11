/**
 * app.js — Navigation engine.
 * Uses numeric codes only. No Drive IDs ever touch this file.
 *
 * State machine:
 *   depth 0 → semester selection (landing)
 *   depth 1 → subject grid         (code: "sem")
 *   depth 2 → options grid         (code: "sem.subject")
 *   depth 3 → exam types grid      (code: "sem.subject.option")  ← only if option.isExams
 *   depth 4 → FILE LIST MODAL      (code: "sem.subject.option" or "sem.subject.option.examType")
 */

// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
const state = {
  depth:   0,     // 0=landing, 1=subjects, 2=options, 3=examTypes
  sem:     null,  // 1 or 2
  subject: null,  // 1-8
  option:  null,  // 1-4
  // examType is only used when opening the modal, not stored in state
};

// ══════════════════════════════════════════════
//  DOM REFS
// ══════════════════════════════════════════════
const $      = id => document.getElementById(id);
const semTabsEl    = $('semTabs');
const breadcrumbEl = $('breadcrumb');
const gridEl       = $('grid');
const searchWrap   = $('searchWrap');
const searchInput  = $('searchInput');
const toastEl      = $('toast');

// File list modal elements (new)
const fileModalOverlay = $('fileModalOverlay');
const fileModalTitle   = $('fileModalTitle');
const fileModalPath    = $('fileModalPath');
const fileModalList    = $('fileModalList');
const fileModalClose   = $('fileModalClose');

// Drive preview modal (existing)
const modalOverlay = $('modalOverlay');
const modalTitle   = $('modalTitle');
const modalPath    = $('modalPath');
const modalIcon    = $('modalIcon');
const modalOpenBtn = $('modalOpenBtn');
const modalIframe  = $('modalIframe');
const modalLoading = $('modalLoading');
const modalUnconf  = $('modalUnconfigured');
const modalClose   = $('modalClose');

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
let toastTimer;
function showToast(msg, type = 'info') {
  toastEl.textContent = msg;
  toastEl.className   = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

// ══════════════════════════════════════════════
//  RENDER ALL
// ══════════════════════════════════════════════
function renderAll(filter = '') {
  renderSemTabs();
  renderBreadcrumb();
  renderGrid(filter);
}

// ══════════════════════════════════════════════
//  SEM TABS
// ══════════════════════════════════════════════
function renderSemTabs() {
  if (state.depth === 0) {
    semTabsEl.style.display = 'none';
    semTabsEl.innerHTML = '';
    return;
  }
  semTabsEl.style.display = 'flex';
  semTabsEl.innerHTML = Object.entries(STRUCTURE).map(([key, sem]) => `
    <button
      class="sem-btn ${+key === state.sem ? 'active' : ''}"
      role="tab"
      aria-selected="${+key === state.sem}"
      data-sem="${key}"
    >
      <span class="sem-icon">${sem.icon}</span>
      ${sem.label}
    </button>
  `).join('');
  semTabsEl.querySelectorAll('.sem-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      state.sem     = +btn.dataset.sem;
      state.subject = null;
      state.option  = null;
      state.depth   = 1;
      searchInput.value = '';
      renderAll();
      pushHistory();
    })
  );
}

// ══════════════════════════════════════════════
//  BREADCRUMB
// ══════════════════════════════════════════════
function renderBreadcrumb() {
  if (state.depth === 0) { breadcrumbEl.innerHTML = ''; return; }

  const crumbs = [];
  crumbs.push({ label: STRUCTURE[state.sem].label, depth: 1 });

  if (state.depth >= 2) {
    const sub = STRUCTURE[state.sem].subjects[state.subject];
    crumbs.push({ label: sub.label, depth: 2 });
  }
  if (state.depth >= 3) {
    const sub = STRUCTURE[state.sem].subjects[state.subject];
    const opt = OPTIONS[sub.type][state.option];
    crumbs.push({ label: opt.label, depth: 3 });
  }

  breadcrumbEl.innerHTML = crumbs.map((c, i) => {
    const isLast = i === crumbs.length - 1;
    if (isLast) return `<span class="crumb crumb-active">${c.label}</span>`;
    return `<button class="crumb crumb-link" data-depth="${c.depth}">${c.label}</button><span class="crumb-sep" aria-hidden="true">›</span>`;
  }).join('');

  breadcrumbEl.querySelectorAll('.crumb-link').forEach(btn =>
    btn.addEventListener('click', () => {
      const d = +btn.dataset.depth;
      state.depth = d;
      if (d <= 1) { state.subject = null; state.option = null; }
      if (d <= 2) { state.option = null; }
      renderAll();
      pushHistory();
    })
  );
}

// ══════════════════════════════════════════════
//  GRID
// ══════════════════════════════════════════════
function renderGrid(filter = '') {
  gridEl.innerHTML = '';
  gridEl.classList.remove('grid-animate', 'landing-menu-layout', 'files-list-layout');
  void gridEl.offsetWidth;
  gridEl.classList.add('grid-animate');

  // ── DEPTH 0: Semester landing ──
  if (state.depth === 0) {
    searchWrap.hidden = true;
    gridEl.classList.add('landing-menu-layout');
    Object.entries(STRUCTURE).forEach(([key, sem]) => {
      const btn = document.createElement('button');
      btn.className = `landing-sem-card`;
      btn.innerHTML = `
        <span class="landing-sem-icon">${sem.icon}</span>
        <div class="landing-sem-text">
          <span class="landing-sem-title">${sem.label}</span>
          <span class="landing-sem-sub">Accéder aux matières</span>
        </div>
        <span class="landing-sem-arrow">→</span>
      `;
      btn.addEventListener('click', () => {
        state.sem   = +key;
        state.depth = 1;
        renderAll();
        pushHistory();
      });
      gridEl.appendChild(btn);
    });
    return;
  }

  // ── DEPTH 1: Subjects ──
  if (state.depth === 1) {
    searchWrap.hidden = false;
    const subjects = STRUCTURE[state.sem].subjects;
    let entries = Object.entries(subjects);
    if (filter) {
      entries = entries.filter(([, s]) =>
        s.label.toLowerCase().includes(filter.toLowerCase())
      );
    }
    if (!entries.length) {
      gridEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Aucun résultat pour « ${filter} »</div></div>`;
      return;
    }
    entries.forEach(([num, subject], i) => {
      const card = buildCard({
        icon:   subject.icon,
        label:  subject.label,
        sub:    'Matière',
        color:  subject.color,
        delay:  i,
        isFile: false,
        onClick: () => {
          state.subject = +num;
          state.depth   = 2;
          searchInput.value = '';
          renderAll();
          pushHistory();
        }
      });
      gridEl.appendChild(card);
    });
    return;
  }

  // ── DEPTH 2: Options (Cours / TD / TP / Exams) ──
  if (state.depth === 2) {
    searchWrap.hidden = true;
    const subject   = STRUCTURE[state.sem].subjects[state.subject];
    const optionMap = OPTIONS[subject.type];
    Object.entries(optionMap).forEach(([num, opt], i) => {
      const card = buildCard({
        icon:   opt.icon,
        label:  opt.label,
        sub:    opt.isExams ? 'Contrôles & examens' : 'Consulter',
        color:  subject.color,
        delay:  i,
        isFile: false,
        onClick: () => {
          state.option = +num;
          if (opt.isExams) {
            // Go deeper to exam types
            state.depth = 3;
            renderAll();
            pushHistory();
          } else {
            // Directly fetch file list
            openFileModal(buildCode(state.sem, state.subject, +num), opt.label);
          }
        }
      });
      gridEl.appendChild(card);
    });
    return;
  }

  // ── DEPTH 3: Exam types ──
  if (state.depth === 3) {
    searchWrap.hidden = true;
    const subject   = STRUCTURE[state.sem].subjects[state.subject];
    const examMap   = EXAM_TYPES[subject.type];
    Object.entries(examMap).forEach(([num, exam], i) => {
      const card = buildCard({
        icon:   exam.icon,
        label:  exam.label,
        sub:    'Consulter les examens',
        color:  subject.color,
        delay:  i,
        isFile: false,
        onClick: () => {
          // Fetch file list for this specific exam type
          openFileModal(buildCode(state.sem, state.subject, state.option, +num), exam.label);
        }
      });
      gridEl.appendChild(card);
    });
  }
}

// ══════════════════════════════════════════════
//  BUILD CARD
// ══════════════════════════════════════════════
function buildCard({ icon, label, sub, color, delay, isFile, onClick }) {
  const el = document.createElement('div');
  el.className = isFile
    ? `file-list-item card-color-${color || 'purple'}`
    : `card card-branch card-color-${color || 'blue'}`;
  el.setAttribute('role', 'listitem');
  el.style.animationDelay = `${delay * 40}ms`;
  el.tabIndex = 0;

  if (isFile) {
    el.innerHTML = `
      <div class="file-item-left">
        <span class="file-item-icon">${icon}</span>
        <span class="file-item-title">${label}</span>
      </div>
      <div class="file-item-right">
        <span class="file-item-hint">${sub}</span>
        <span class="file-item-arrow">👁️</span>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="card-icon-wrap"><span class="card-icon">${icon}</span></div>
      <div class="card-body">
        <div class="card-label">${label}</div>
        <div class="card-sub">${sub}</div>
      </div>
      <div class="card-arrow"></div>
    `;
  }

  el.addEventListener('click', onClick);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  });
  return el;
}

// ══════════════════════════════════════════════
//  FILE LIST MODAL — Script A call
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
//  FILE LIST MODAL — Intercepted for Rick Roll!
// ══════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//  FILE LIST MODAL — Replaced with 60% Dark Premium Custom Window
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  HELPER 1: Network Engine for Script A & Script B
// ═══════════════════════════════════════════════════════════════

// Since frontend and backend run on the same Render host, use relative paths!
const BACKEND_SERVER_URL = ""; 

// Communicates with your server.js cache to pull names & metadata instantly
async function fetchFileListFromScriptA(code) {
  const response = await fetch(`${BACKEND_SERVER_URL}/api/files?code=${encodeURIComponent(code)}`);
  if (!response.ok) throw new Error("Local proxy file metadata cache lookup failed.");
  return await response.json();
}

// Communicates with your server.js pass-through endpoint to handle individual secure links
async function fetchFileLinkFromScriptB(code, index) {
  const response = await fetch(`${BACKEND_SERVER_URL}/api/link?code=${encodeURIComponent(code)}&index=${index}`);
  if (!response.ok) throw new Error("Local proxy link resolution pass-through failed.");
  return await response.json();
}


// ═══════════════════════════════════════════════════════════════
//  HELPER 2: UI File Row Renderer Utility
// ═══════════════════════════════════════════════════════════════
function buildModalFileRows(files, container, code) {
  if (!files || files.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: #a0a5b5; padding: 3rem 1rem;">
        <span style="font-size: 2.2rem; display: block; margin-bottom: 0.8rem;">📭</span>
        <span style="font-family: inherit; font-size: 0.95rem;">Aucun document disponible dans ce dossier.</span>
      </div>`;
    return;
  }

  container.innerHTML = ''; // Expel loading animation layout

  files.forEach((file) => {
    const row = document.createElement('div');
    
    // Style individual file rows to match your dark layout
    row.style.background = 'rgba(255, 255, 255, 0.02)';
    row.style.border = '1px solid #2d2d34';
    row.style.borderRadius = '8px';
    row.style.padding = '0.9rem 1.2rem';
    row.style.marginBottom = '0.6rem';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.cursor = 'pointer';
    row.style.transition = 'all 0.15s ease-in-out';
    
    // Dynamic micro-interactions using JS hover triggers
    row.onmouseenter = () => { row.style.borderColor = '#7b42bc'; row.style.background = 'rgba(123, 66, 188, 0.06)'; row.style.transform = 'translateX(2px)'; };
    row.onmouseleave = () => { row.style.borderColor = '#2d2d34'; row.style.background = 'rgba(255, 255, 255, 0.02)'; row.style.transform = 'none'; };

    // File name output (clean representation without massive extensions)
    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.8rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
        <span style="font-size: 1.2rem;">📕</span>
        <span style="color: #fff; font-size: 0.95rem; font-weight: 400; overflow: hidden; text-overflow: ellipsis;">${file.name}</span>
      </div>
      <span style="color: #7b42bc; font-size: 0.9rem; font-weight: 500; padding-left: 1rem; flex-shrink: 0;">Consulter →</span>
    `;

    // Connect individual row clicks securely to Script B index mapping execution
    row.addEventListener('click', async () => {
      if (typeof showToast === 'function') showToast('Récupération du lien sécurisé...', 'info');
      try {
        const result = await fetchFileLinkFromScriptB(code, file.index);
        if (result.status === 'ok' && result.link) {
          window.open(result.link, '_blank');
        } else {
          if (typeof showToast === 'function') showToast(result.message || 'Lien introuvable.', 'error');
        }
      } catch (err) {
        if (typeof showToast === 'function') showToast('Erreur de chargement réseau.', 'error');
      }
    });

    container.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════════
//  MAIN ORCHESTRATOR: Renders the 60% viewport interface
// ═══════════════════════════════════════════════════════════════
async function openFileModal(code, folderLabel) {
  // 1. Structural Fullscreen Backdrop Setup
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  overlay.style.backdropFilter = 'blur(8px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';
  overlay.style.animation = 'fadeIn 0.2s ease forwards';

  // 2. Main Window Component Box — Taking up exactly 60% width and 60% height on desktop
  const win = document.createElement('div');
  win.style.width = '60vw';
  win.style.height = '60vh';
  win.style.background = 'linear-gradient(145deg, #1d1d22 0%, #0a0a0c 100%)';
  win.style.border = '1px solid #32323a';
  win.style.borderRadius = '14px';
  win.style.padding = '2.2rem';
  win.style.display = 'flex';
  win.style.flexDirection = 'column';
  win.style.boxShadow = '0 30px 60px rgba(0, 0, 0, 0.7)';
  win.style.animation = 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards';

  // 3. Populate Title Header (Clean and free of backend targets) & Main View Layout Frame
  win.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #28282f;">
      <div>
        <h2 style="color: #fff; font-size: 1.35rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; margin: 0;">${folderLabel}</h2>
      </div>
      <button id="customWinCloseBtn" style="background: rgba(255,255,255,0.04); color: #a0a5b5; border: 1px solid #28282f; width: 34px; height: 34px; border-radius: 50%; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s;">✕</button>
    </div>
    
    <div id="modalFilesBody" style="flex: 1; overflow-y: auto; padding-right: 0.4rem;">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #a0a5b5; gap: 0.8rem; font-size: 0.95rem;">
        <div class="spinner" style="border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #7b42bc; border-radius: 50%; width: 28px; height: 28px; animation: spin 0.8s linear infinite;"></div>
        <span>Récupération des documents...</span>
      </div>
    </div>
  `;

  overlay.appendChild(win);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const bodyContainer = win.querySelector('#modalFilesBody');
  const closeBtn = win.querySelector('#customWinCloseBtn');

  const closeWindow = () => { document.body.removeChild(overlay); document.body.style.overflow = ''; };
  closeBtn.addEventListener('click', closeWindow);
  closeBtn.onmouseenter = () => { closeBtn.style.color = '#fff'; closeBtn.style.borderColor = '#7b42bc'; closeBtn.style.background = 'rgba(123, 66, 188, 0.1)'; };
  closeBtn.onmouseleave = () => { closeBtn.style.color = '#a0a5b5'; closeBtn.style.borderColor = '#28282f'; closeBtn.style.background = 'rgba(255,255,255,0.04)'; };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeWindow(); });

  // Helper inside the orchestrator to build individual maximized file rows
  const buildModalFileRows = (files, container) => {
    if (!files || files.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #a0a5b5; padding: 3rem 1rem;">
          <span style="font-size: 2.2rem; display: block; margin-bottom: 0.8rem;">📭</span>
          <span style="font-size: 0.95rem;">Aucun document disponible ici</span>
        </div>`;
      return;
    }

    container.innerHTML = ''; 

    files.forEach((file) => {
      const row = document.createElement('div');
      row.style.background = 'rgba(255, 255, 255, 0.02)';
      row.style.border = '1px solid #2d2d34';
      row.style.borderRadius = '8px';
      row.style.padding = '0.9rem 1.2rem';
      row.style.marginBottom = '0.6rem';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.cursor = 'pointer';
      row.style.transition = 'all 0.15s ease-in-out';
      
      row.onmouseenter = () => { row.style.borderColor = '#7b42bc'; row.style.background = 'rgba(123, 66, 188, 0.06)'; row.style.transform = 'translateX(2px)'; };
      row.onmouseleave = () => { row.style.borderColor = '#2d2d34'; row.style.background = 'rgba(255, 255, 255, 0.02)'; row.style.transform = 'none'; };

      // Left-side wrapper: Takes 100% available space up until the arrow margin barrier
      const textWrapper = document.createElement('div');
      textWrapper.style.display = 'flex';
      textWrapper.style.alignItems = 'center';
      textWrapper.style.gap = '0.8rem';
      textWrapper.style.overflow = 'hidden';
      textWrapper.style.flexGrow = '1';              
      textWrapper.style.marginRight = '24px';         

      textWrapper.innerHTML = `
        <span style="font-size: 1.2rem; flex-shrink: 0;">📕</span>
        <span style="color: #fff; font-size: 0.95rem; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">
          ${file.name}
        </span>
      `;

      // Right-side wrapper: Clean structural arrow symbol
      const actionIconBox = document.createElement('div');
      actionIconBox.innerHTML = `<span style="font-size: 1.2rem; display: flex; align-items: center; font-family: system-ui, sans-serif;">→</span>`;
      actionIconBox.style.color = '#7b42bc';
      actionIconBox.style.fontWeight = '600';
      actionIconBox.style.flexShrink = '0';          
      actionIconBox.style.transition = 'transform 0.15s ease';

      row.addEventListener('mouseenter', () => { actionIconBox.style.transform = 'translateX(3px)'; actionIconBox.style.color = '#9d5bf0'; });
      row.addEventListener('mouseleave', () => { actionIconBox.style.transform = 'translateX(0px)'; actionIconBox.style.color = '#7b42bc'; });

      row.appendChild(textWrapper);
      row.appendChild(actionIconBox);

      // Secure link execution block triggered on click
      row.addEventListener('click', async () => {
        if (typeof showToast === 'function') showToast('Récupération du lien sécurisé...', 'info');
        try {
          const result = await fetchFileLinkFromScriptB(code, file.index);
          if (result.status === 'ok' && result.link) {
            window.open(result.link, '_blank');
          } else {
            if (typeof showToast === 'function') showToast(result.message || 'Lien introuvable.', 'error');
          }
        } catch (err) {
          if (typeof showToast === 'function') showToast('Erreur de chargement réseau.', 'error');
        }
      });

      container.appendChild(row);
    });
  };

  // 4. FIRE THE EXECUTION PIPELINE LIVE (Calls Script A)
  try {
    const data = await fetchFileListFromScriptA(code);
    
    if (data.status === 'error') {
      bodyContainer.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 2rem 0;">⚠️ Erreur Backend: ${data.message}</div>`;
    } else if (data.status === 'empty') {
      buildModalFileRows([], bodyContainer);
    } else {
      buildModalFileRows(data.files, bodyContainer);
    }
  } catch (error) {
    bodyContainer.innerHTML = `
      <div style="text-align: center; color: #ef4444; padding: 2rem 0;">
        ⚠️ Échec du chargement sécurisé des données. Vérifiez votre connectivité réseau.
      </div>`;
  }
}

// Global programmatic injection of styling micro-animations and mobile responsiveness
if (!document.getElementById('custom-modal-layout-styles')) {
  const styles = document.createElement("style");
  styles.id = 'custom-modal-layout-styles';
  styles.innerText = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scaleUp { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    
    #modalFilesBody::-webkit-scrollbar { width: 6px; }
    #modalFilesBody::-webkit-scrollbar-track { background: transparent; }
    #modalFilesBody::-webkit-scrollbar-thumb { background: #28282f; border-radius: 10px; }
    #modalFilesBody::-webkit-scrollbar-thumb:hover { background: #32323a; }

    /* 📱 MOBILE RESPONSIVE OVERRIDES (Triggers when screen is under 768px wide) */
    @media (max-width: 768px) {
      div[style*="width: 60vw"] {
        width: 92vw !important;
        height: 75vh !important; 
        padding: 1.4rem 1rem !important;
      }
      
      #modalFilesBody div {
        padding: 0.8rem 0.9rem !important;
      }
    }
  `;
  document.head.appendChild(styles);
}

function closeFileModal() {
  fileModalOverlay.hidden = true;
  document.body.classList.remove('modal-open');
  fileModalList.innerHTML = '';
}

fileModalClose.addEventListener('click', closeFileModal);
fileModalOverlay.addEventListener('click', e => {
  if (e.target === fileModalOverlay) closeFileModal();
});

// ══════════════════════════════════════════════
//  OPEN FILE — Script B call
// ══════════════════════════════════════════════
async function openFileDrive(code, fileIndex, fileName) {
  showToast('Ouverture du document…', 'info');
  try {
    const res  = await fetch(`${SCRIPT_B_URL}?code=${encodeURIComponent(code)}&index=${fileIndex}`);
    const data = await res.json();

    if (data.status === 'ok' && data.link) {
      window.open(data.link, '_blank');
    } else {
      showToast('Impossible d\'ouvrir ce fichier.', 'error');
    }
  } catch (err) {
    showToast('Erreur réseau.', 'error');
    console.error('Script B error:', err);
  }
}

// ══════════════════════════════════════════════
//  FILE ICON HELPER
// ══════════════════════════════════════════════
function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (ext === 'pdf')               return '📕';
  if (['doc','docx'].includes(ext)) return '📘';
  if (['ppt','pptx'].includes(ext)) return '📊';
  if (['xls','xlsx'].includes(ext)) return '🟢';
  if (['zip','rar'].includes(ext))  return '📦';
  return '📄';
}

// ══════════════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════════════
function pushHistory() {
  const s = { depth: state.depth, sem: state.sem, subject: state.subject, option: state.option };
  const hash = state.depth === 0 ? '#menu'
    : state.depth === 1 ? `#s${state.sem}`
    : state.depth === 2 ? `#s${state.sem}.${state.subject}`
    : `#s${state.sem}.${state.subject}.${state.option}`;
  history.pushState(s, '', hash);
}

window.addEventListener('popstate', e => {
  if (e.state) {
    Object.assign(state, e.state);
    renderAll();
  }
});

// ══════════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════════
searchInput.addEventListener('input', () => {
  if (state.depth === 1) renderGrid(searchInput.value);
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { searchInput.value = ''; renderGrid(); searchInput.blur(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !fileModalOverlay.hidden) { closeFileModal(); return; }
  if (e.key === 'Escape' && !modalOverlay.hidden)     { closeModal();     return; }
  if (e.key === '/' && document.activeElement !== searchInput && fileModalOverlay.hidden && modalOverlay.hidden) {
    if (state.depth === 1) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  }
  if (e.key === 'Backspace' && document.activeElement === document.body && state.depth > 0 && fileModalOverlay.hidden) {
    state.depth = Math.max(0, state.depth - 1);
    if (state.depth < 2) state.option  = null;
    if (state.depth < 1) state.subject = null;
    renderAll();
  }
});

// ══════════════════════════════════════════════
//  EXISTING DRIVE PREVIEW MODAL (kept intact)
// ══════════════════════════════════════════════
function closeModal() {
  modalOverlay.hidden = true;
  document.body.classList.remove('modal-open');
  modalIframe.src    = '';
  modalIframe.hidden = true;
}
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

// ══════════════════════════════════════════════
//  selectSem exposed for sidebar reset button
// ══════════════════════════════════════════════
function selectSem(key) {
  if (key === null) {
    state.depth   = 0;
    state.sem     = null;
    state.subject = null;
    state.option  = null;
  } else {
    state.sem     = +key;
    state.subject = null;
    state.option  = null;
    state.depth   = 1;
  }
  searchInput.value = '';
  renderAll();
  pushHistory();
}

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
renderAll();
