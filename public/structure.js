/**
 * structure.js — Hardcoded drive coordinate system.
 * Numbers only. No IDs. No links. Nothing useful to steal.
 *
 * Encoding: "sem.subject.option" or "sem.subject.option.examType"
 *   sem:      1=S1, 2=S2
 *   subject:  1-7 (S1), 1-8 (S2)
 *   option:   depends on subject type (see below)
 *   examType: only when option points to exams folder
 *
 * Subject types:
 *   A = normal    → options: 1=Cours, 2=TD, 3=Exams
 *   B = has TP    → options: 1=Cours, 2=TD, 3=TP, 4=Exams
 *   C = online    → options: 1=Cours, 2=Exams
 *
 * Exam types:
 *   Type A/B → 1=Finals, 2=Interros, 3=Rattrapages (+ 4=Exams TP for B)
 *   Type C   → 1=Finals, 2=Rattrapages
 */

const STRUCTURE = {
  1: {
    label: "Semestre 1",
    icon: "📘",
    color: "blue",
    subjects: {
      1: { name: "analyse", label: "Analyse  1",           icon: "∫",   color: "blue",   type: "A" },
      2: { name: "algebre", label: "Algèbre  1",           icon: "∑",   color: "blue",   type: "A" },
      3: { name: "algo",    label: "Algorithmique  1",     icon: "⟨/⟩", color: "violet", type: "B" },
      4: { name: "mp",      label: "Mécanique  du  point", icon: "📐", color: "blue",   type: "A" },
      5: { name: "strm",    label: "STRM  1",              icon: "0️⃣1️⃣",   color: "blue",   type: "A" },
      6: { name: "tce",     label: "TCE",               icon: "FR",  color: "orange", type: "C" },
      7: { name: "le",      label: "LE", icon: "ENG", color: "violet", type: "C" },
    }
  },
  2: {
    label: "Semestre 2",
    icon: "📗",
    color: "green",
    subjects: {
      1: { name: "analyse", label: "Analyse",           icon: "∫",   color: "blue",   type: "A" },
      2: { name: "algebre", label: "Algèbre",           icon: "∑",   color: "blue",   type: "A" },
      3: { name: "algo",    label: "Algorithmique",     icon: "⟨/⟩", color: "violet", type: "B" },
      4: { name: "elec",    label: "Électrique",      icon: "⚡",  color: "amber",  type: "A" },
      5: { name: "strm",    label: "STRM",              icon: "⚙",   color: "blue",   type: "A" },
      6: { name: "proba",   label: "Stat & Proba",      icon: "σ",   color: "blue",   type: "A" },
      7: { name: "opm",     label: "OPM",               icon: "🔧",  color: "teal",   type: "B" },
      8: { name: "tic",     label: "TIC",               icon: "💻",  color: "violet", type: "C" },
    }
  }
};

const OPTIONS = {
  A: {
    1: { label: "Cours",              icon: "📖", isExams: false },
    2: { label: "TD",                 icon: "✏️",  isExams: false },
    3: { label: "Examens & Contrôles",icon: "📝", isExams: true  },
  },
  B: {
    1: { label: "Cours",              icon: "📖", isExams: false },
    2: { label: "TD",                 icon: "✏️",  isExams: false },
    3: { label: "TP",                 icon: "⌨️", isExams: false },
    4: { label: "Examens & Contrôles",icon: "📝", isExams: true  },
  },
  C: {
    1: { label: "Cours",              icon: "📖", isExams: false },
    2: { label: "Examens & Contrôles",icon: "📝", isExams: true  },
  },
};

const EXAM_TYPES = {
  // A and B share the same exam types (B adds exams de TP)
  A: {
    1: { label: "Examens Finaux",  icon: "🎓" },
    2: { label: "Interrogations",  icon: "📋" },
    3: { label: "Rattrapages",     icon: "🔃" },
  },
  B: {
    1: { label: "Examens Finaux",  icon: "🎓" },
    2: { label: "Interrogations",  icon: "📋" },
    3: { label: "Rattrapages",     icon: "🔃" },
    4: { label: "Examens de TP",   icon: "✏️" },
  },
  C: {
    1: { label: "Examens Finaux",  icon: "🎓" },
    2: { label: "Rattrapages",     icon: "🔃" },
  },
};

// Apps Script URLs
const SCRIPT_A_URL = "https://script.google.com/macros/s/AKfycbx_PGm2jt7RSIhHUkWhKtJG0Y6n3RVblCBAJB3iSRxQzQZzSmoGiRN9zPvaFLAf7P3w-A/exec"; // returns file list
const SCRIPT_B_URL = "https://script.google.com/macros/s/AKfycbzyT12oT4XVy9tOd-A1KE7ppiiB9qz4HWPFrfplJX3Yj3uL4br_g9coWgCofTJ_hXt8/exec"; // returns file link

/**
 * decode(code) → resolves a numeric code to human-readable path info
 * Used by the frontend to know what to render, never sent to the server.
 */
function decode(code) {
  const parts = code.split(".").map(Number);
  const [sem, subjectNum, optionNum, examNum] = parts;

  const semData = STRUCTURE[sem];
  if (!semData) return null;

  const subject = semData.subjects[subjectNum];
  if (!subject) return null;

  if (!optionNum) return { sem, semData, subject, option: null, examType: null };

  const optionMap = OPTIONS[subject.type];
  const option = optionMap[optionNum];
  if (!option) return null;

  let examType = null;
  if (option.isExams && examNum) {
    examType = EXAM_TYPES[subject.type][examNum];
    if (!examType) return null;
  }

  return { sem, semData, subject, option, examType };
}

/**
 * buildCode(...nums) → "1.3.2" etc.
 */
function buildCode(...nums) {
  return nums.filter(n => n != null).join(".");
}
