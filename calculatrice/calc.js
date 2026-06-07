/**
 * calc.js — Isolated calculation tracking for the academic score matrix entries.
 */
const calcData = {
    s1: [
        { name: "Analyse 1", coef: 4, credit: 5, hasTP: false },
        { name: "Algèbre 1", coef: 3, credit: 5, hasTP: false },
        { name: "Physique 1 (Mécanique)", coef: 2, credit: 4, hasTP: false },
        { name: "Langue étrangère 1", coef: 1, credit: 2, hasTP: false },
        { name: "Terminologie sc.", coef: 1, credit: 2, hasTP: false },
        { name: "Structure machine 1", coef: 3, credit: 5, hasTP: true },
        { name: "Algorithmique 1", coef: 4, credit: 6, hasTP: true }
    ],
    s2: [
        { name: "Physique 2", coef: 2, credit: 3, hasTP: false },
        { name: "Algorithmique 2", coef: 4, credit: 6, hasTP: true },
        { name: "Structure machine 2", coef: 2, credit: 4, hasTP: true },
        { name: "Analyse 2", coef: 4, credit: 6, hasTP: false },
        { name: "Algèbre 2", coef: 2, credit: 4, hasTP: false },
        { name: "Intro. Probabilités", coef: 2, credit: 3, hasTP: false },
        { name: "OPM", coef: 1, credit: 2, hasTP: true },
        { name: "TIC", coef: 1, credit: 2, hasTP: true }
    ]
};

let gradesState = { s1: {}, s2: {} };

function initCalculator() {
    renderCalcTable(calcData.s1, document.getElementById('s1-tbody'), 's1');
    renderCalcTable(calcData.s2, document.getElementById('s2-tbody'), 's2');
    runCalculations();
}

function renderCalcTable(modules, tbody, sem) {
    if(!tbody) return;
    tbody.innerHTML = '';
    modules.forEach((mod, idx) => {
        const tr = document.createElement('tr');
        const tpDis = !mod.hasTP ? 'disabled placeholder="-"' : 'placeholder="TP"';
        
        tr.innerHTML = `
            <td><strong>${mod.name}</strong></td>
            <td>${mod.coef}</td>
            <td>${mod.credit}</td>
            <td><input type="number" min="0" max="20" step="0.1" class="c-input" data-sem="${sem}" data-idx="${idx}" data-field="exam" placeholder="Exam"></td>
            <td><input type="number" min="0" max="20" step="0.1" class="c-input" data-sem="${sem}" data-idx="${idx}" data-field="td" placeholder="TD"></td>
            <td><input type="number" min="0" max="20" step="0.1" class="c-input" data-sem="${sem}" data-idx="${idx}" data-field="tp" ${tpDis}></td>
            <td id="avg-${sem}-${idx}" style="font-weight:600; color:var(--purple-accent)">0.00</td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.c-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const { sem, idx, field } = e.target.dataset;
            if (!gradesState[sem][idx]) gradesState[sem][idx] = { exam: 0, td: 0, tp: 0 };
            gradesState[sem][idx][field] = parseFloat(e.target.value) || 0;
            runCalculations();
        });
    });
}

function runCalculations() {
    const resS1 = evaluateSemester('s1');
    const resS2 = evaluateSemester('s2');

    document.getElementById('s1-avg').textContent = resS1.avg.toFixed(2);
    document.getElementById('s1-credit').textContent = resS1.credits;
    document.getElementById('s2-avg').textContent = resS2.avg.toFixed(2);
    document.getElementById('s2-credit').textContent = resS2.credits;

    const generalAvg = (resS1.avg + resS2.avg) / 2;
    let totalCredits = generalAvg >= 10 ? 60 : (resS1.credits + resS2.credits);

    document.getElementById('year-avg').textContent = generalAvg.toFixed(2);
    document.getElementById('year-credit').textContent = totalCredits;

    const decision = document.getElementById('year-decision');
    if (generalAvg >= 10) {
        decision.textContent = "Admis"; decision.className = "summary-value decision success";
    } else {
        decision.textContent = "Ajourné"; decision.className = "summary-value decision fail";
    }
}

function evaluateSemester(sem) {
    let totalCoef = 0, weightedSum = 0, earnedCredits = 0;
    const modules = calcData[sem];

    modules.forEach((mod, idx) => {
        const score = gradesState[sem][idx] || { exam: 0, td: 0, tp: 0 };
        let modAvg = mod.hasTP ? (score.exam * 0.6 + score.td * 0.2 + score.tp * 0.2) : (score.exam * 0.6 + score.td * 0.4);
        
        const cell = document.getElementById(`avg-${sem}-${idx}`);
        if(cell) cell.textContent = modAvg.toFixed(2);

        weightedSum += (modAvg * mod.coef);
        totalCoef += mod.coef;
        if(modAvg >= 10) earnedCredits += mod.credit;
    });

    const avg = totalCoef > 0 ? (weightedSum / totalCoef) : 0;
    return { avg, credits: avg >= 10 ? 30 : earnedCredits };
}

window.addEventListener('DOMContentLoaded', initCalculator);