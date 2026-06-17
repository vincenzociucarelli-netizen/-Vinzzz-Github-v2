/**
 * Unit test rapido per la logica multi-select del Coach Level Picker
 * (vedi /app/frontend/app/coach/profile.tsx lines 1156-1179).
 *
 * Smart Coach può stare da solo o abbinato a 1°/2°/3° Grado.
 * Allievo Allenatore è esclusivo (no Smart Coach in abbinamento).
 *
 * Esegui con: node /app/frontend/scripts/test-coach-level-toggle.js
 */

const isSmartCoach = (lvl) => lvl.toLowerCase().includes('smart');
const isAllievo = (lvl) => lvl.toLowerCase().includes('allievo');

function toggleLevel(currentRaw, lvl) {
  const selectedLevels = (currentRaw || '').split(',').map(s => s.trim()).filter(Boolean);
  const already = selectedLevels.includes(lvl);
  let next;
  if (already) {
    next = selectedLevels.filter(x => x !== lvl);
  } else if (isSmartCoach(lvl)) {
    next = [...selectedLevels.filter(x => !isAllievo(x)), lvl];
  } else if (isAllievo(lvl)) {
    next = [lvl];
  } else {
    next = [...selectedLevels.filter(x => isSmartCoach(x)), lvl];
  }
  next.sort((a, b) => (isSmartCoach(a) ? -1 : isSmartCoach(b) ? 1 : 0));
  return next.join(', ');
}

function assertEq(actual, expected, label) {
  const pass = actual === expected;
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${label}\n      actual:   "${actual}"\n      expected: "${expected}"`);
  if (!pass) process.exitCode = 1;
}

// 1. Solo Smart Coach
assertEq(toggleLevel('', 'Smart Coach'), 'Smart Coach', 'Add Smart Coach to empty');

// 2. Smart Coach + 1° Grado
assertEq(toggleLevel('Smart Coach', '1° Grado'), 'Smart Coach, 1° Grado', 'Add 1° Grado preserves Smart Coach');

// 3. Sostituzione tra gradi: 1° -> 2° (Smart Coach resta)
assertEq(toggleLevel('Smart Coach, 1° Grado', '2° Grado'), 'Smart Coach, 2° Grado', 'Switch 1°→2° keeps Smart Coach');

// 4. Allievo esclusivo: rimuove Smart Coach e altri gradi
assertEq(toggleLevel('Smart Coach, 1° Grado', 'Allievo Allenatore'), 'Allievo Allenatore', 'Allievo exclusive: removes all others');

// 5. Smart Coach su Allievo: rimuove Allievo
assertEq(toggleLevel('Allievo Allenatore', 'Smart Coach'), 'Smart Coach', 'Smart Coach removes Allievo (incompatible)');

// 6. Toggle off Smart Coach lasciando 1° Grado
assertEq(toggleLevel('Smart Coach, 1° Grado', 'Smart Coach'), '1° Grado', 'Toggle off Smart Coach keeps 1° Grado');

// 7. Toggle off 1° Grado lasciando Smart Coach
assertEq(toggleLevel('Smart Coach, 1° Grado', '1° Grado'), 'Smart Coach', 'Toggle off 1° Grado keeps Smart Coach');

// 8. Solo 3° Grado (no Smart Coach)
assertEq(toggleLevel('', '3° Grado'), '3° Grado', 'Add 3° Grado to empty');

// 9. 2° Grado da solo, poi Smart Coach
assertEq(toggleLevel('2° Grado', 'Smart Coach'), 'Smart Coach, 2° Grado', 'Add Smart Coach to 2° Grado (compatible)');

console.log('\nTest completi.');
