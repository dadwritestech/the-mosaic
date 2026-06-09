type Send = (cmd: string, body?: Record<string, unknown>) => void;
function el(tag: string, style: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = style;
  if (text !== undefined) e.textContent = text;
  return e;
}
const BTN = 'pointer-events:auto;background:#3a5a8c;color:#fff;border:0;border-radius:7px;padding:7px 12px;cursor:pointer;font-size:13px;font-weight:600';
const BTN_ALT = 'pointer-events:auto;background:#4a4a55;color:#fff;border:0;border-radius:7px;padding:7px 12px;cursor:pointer;font-size:13px;font-weight:600';
const STATUS_COLOR: Record<string, string> = { par: '#d8a200', psn: '#9a3fb0', tox: '#7a2a8f', brn: '#d8642a', slp: '#7a8694', frz: '#37b0d8' };

function hpBar(hp: number, maxHp: number, hpPercent: number): HTMLElement {
  const pct = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
  const outer = el('div', 'height:7px;background:#0f1726;border-radius:4px;overflow:hidden');
  const inner = el('div', `height:100%;width:${pct}%;background:${pct > 50 ? '#37c24a' : pct > 20 ? '#e0b341' : '#e0533a'};border-radius:4px;transition:width .2s`);
  outer.appendChild(inner);
  return outer;
}

function sectionLabel(text: string): HTMLElement {
  return el('div', 'font-size:12px;text-transform:uppercase;color:#7f93b3;margin-bottom:4px;margin-top:10px', text);
}

function rowDivider(): HTMLElement {
  return el('div', 'border-bottom:1px solid #2a364c;margin:8px 0');
}

export function renderSummary(o: any, _send: Send): HTMLElement {
  const mon = o.mon;
  const root = el('div', 'color:#cbd5e1;font-size:14px;line-height:1.5');

  // Header: Species  ♂/♀  Lv.N
  const genderChar = mon.gender === 'M' ? '♂' : mon.gender === 'F' ? '♀' : '';
  const headerLine = el('div', 'font-size:18px;font-weight:700;color:#fff;margin-bottom:2px');
  headerLine.appendChild(el('span', '', `${mon.species}`));
  if (genderChar) headerLine.appendChild(el('span', 'margin-left:6px;color:#9fb3d1', genderChar));
  headerLine.appendChild(el('span', 'margin-left:8px;color:#9fb3d1', `Lv.${mon.level}`));
  root.appendChild(headerLine);

  // Type · Ability · Nature
  const typeStr = mon.types.join(' · ');
  const infoLine = el('div', 'color:#9fb3d1;font-size:13px;margin-bottom:4px');
  infoLine.appendChild(el('span', '', `${typeStr} · Ability: ${mon.ability} · ${mon.nature}`));
  root.appendChild(infoLine);

  root.appendChild(rowDivider());

  // HP bar
  const hpRow = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:6px');
  hpRow.appendChild(el('span', 'color:#fff;font-weight:600;font-size:13px;min-width:70px', `${mon.hp}/${mon.maxHp}`));
  hpRow.appendChild(hpBar(mon.hp, mon.maxHp, mon.hpPercent));
  if (mon.status && STATUS_COLOR[mon.status]) {
    hpRow.appendChild(el('span', `font-size:11px;font-weight:700;color:${STATUS_COLOR[mon.status]};margin-left:4px;text-transform:uppercase`, mon.status));
  }
  root.appendChild(hpRow);

  root.appendChild(rowDivider());

  // Stats grid
  root.appendChild(sectionLabel('Stats'));
  const statLabels = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  const statDisplay = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
  for (let i = 0; i < statLabels.length; i++) {
    const key = statLabels[i];
    const row = el('div', 'display:flex;justify-content:space-between;padding:2px 0');
    row.appendChild(el('span', 'color:#9fb3d1', statDisplay[i]));
    row.appendChild(el('span', 'color:#fff;font-weight:600', String(mon.stats[key])));
    root.appendChild(row);
  }

  // Held item
  if (mon.heldItem) {
    root.appendChild(rowDivider());
    root.appendChild(sectionLabel('Held Item'));
    root.appendChild(el('div', 'color:#fff', mon.heldItem));
  }

  // EXP bar
  root.appendChild(rowDivider());
  root.appendChild(sectionLabel('Experience'));
  const expRow = el('div', 'margin-bottom:4px');
  expRow.appendChild(el('span', 'color:#9fb3d1;font-size:13px', `EXP — ${mon.expToNext} to next level`));
  expRow.appendChild(el('div', 'margin-top:4px'));
  const expBarOuter = el('div', 'height:7px;background:#0f1726;border-radius:4px;overflow:hidden;margin-top:4px');
  const expBarInner = el('div', `height:100%;width:${mon.expPercent}%;background:#5b8dd9;border-radius:4px`);
  expBarOuter.appendChild(expBarInner);
  expRow.appendChild(expBarOuter);
  root.appendChild(expRow);

  // Moves
  root.appendChild(rowDivider());
  root.appendChild(sectionLabel('Moves'));
  for (const m of mon.moves) {
    const moveRow = el('div', 'display:flex;justify-content:space-between;padding:3px 0');
    moveRow.appendChild(el('span', 'color:#fff;font-weight:600', m.name));
    moveRow.appendChild(el('span', 'color:#9fb3d1;font-size:12px', `${m.type.toUpperCase()} PP ${m.pp}/${m.maxpp}`));
    root.appendChild(moveRow);
  }

  return root;
}

export function renderBox(o: any, send: Send): HTMLElement {
  const root = el('div', 'color:#cbd5e1;font-size:14px;line-height:1.5');

  // Navigation row
  const navRow = el('div', 'display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:10px');
  const prevBtn = el('button', BTN, '◀');
  prevBtn.addEventListener('click', () => send('boxNav', { delta: -1 }));
  const label = el('span', 'color:#fff;font-weight:700;font-size:15px', `${o.boxName} (${o.boxIndex + 1}/${o.boxCount})`);
  const nextBtn = el('button', BTN, '▶');
  nextBtn.addEventListener('click', () => send('boxNav', { delta: 1 }));
  navRow.appendChild(prevBtn);
  navRow.appendChild(label);
  navRow.appendChild(nextBtn);
  root.appendChild(navRow);

  root.appendChild(rowDivider());

  // Box grid (6 columns, 30 slots)
  root.appendChild(sectionLabel('Box'));
  const grid = el('div', 'display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:8px');
  for (let i = 0; i < o.slots.length; i++) {
    const slot = o.slots[i];
    if (slot) {
      const btn = el('button', `${BTN};width:100%;text-align:center;font-size:12px;padding:6px 4px`, `${slot.species} L${slot.level}`);
      const uid = slot.uid;
      btn.addEventListener('click', () => send('withdraw', { uid }));
      grid.appendChild(btn);
    } else {
      grid.appendChild(el('div', 'display:flex;align-items:center;justify-content:center;height:32px;color:#4a5568;font-size:14px', '—'));
    }
  }
  root.appendChild(grid);

  root.appendChild(rowDivider());

  // Party
  root.appendChild(sectionLabel('Party'));
  for (const p of o.party) {
    const partyRow = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid #2a364c');
    const info = el('span', 'color:#fff;font-weight:600');
    info.appendChild(el('span', '', `${p.species} L${p.level}`));
    info.appendChild(el('span', 'color:#9fb3d1;font-size:12px;margin-left:6px', `(${p.hpPercent}%)`));
    if (p.status && STATUS_COLOR[p.status]) {
      info.appendChild(el('span', `font-size:10px;font-weight:700;color:${STATUS_COLOR[p.status]};margin-left:4px;text-transform:uppercase`, p.status));
    }
    const depBtn = el('button', BTN_ALT, 'Deposit');
    depBtn.addEventListener('click', () => send('deposit', { uid: p.uid }));
    partyRow.appendChild(info);
    partyRow.appendChild(depBtn);
    root.appendChild(partyRow);
  }

  return root;
}

export function renderPokedex(o: any, _send: Send): HTMLElement {
  const root = el('div', 'color:#cbd5e1;font-size:14px;line-height:1.5');

  // Header
  const header = el('div', 'color:#fff;font-weight:700;font-size:15px;margin-bottom:8px');
  header.appendChild(el('span', '', `Seen ${o.seen} · Caught ${o.caught}`));
  root.appendChild(header);

  root.appendChild(rowDivider());

  // Entries
  for (const entry of o.entries) {
    const row = el('div', 'display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #2a364c');
    const left = el('span', 'color:#fff;font-weight:600', `#${String(entry.num).padStart(3, '0')}  ${entry.name}`);
    const right = entry.caught
      ? el('span', 'color:#ffd36b;font-weight:700;font-size:13px', '★ caught')
      : el('span', 'color:#7f93b3;font-size:13px', 'seen');
    row.appendChild(left);
    row.appendChild(right);
    root.appendChild(row);
  }

  return root;
}

export function renderVsSeeker(o: any, send: Send): HTMLElement {
  const root = el('div', 'color:#cbd5e1;font-size:14px;line-height:1.5');

  // Level cap line
  root.appendChild(el('div', 'color:#fff;font-weight:700;font-size:15px;margin-bottom:8px', `Rematch level cap: Lv.${o.levelCap}`));

  root.appendChild(rowDivider());

  if (!o.ready || o.ready.length === 0) {
    root.appendChild(el('div', 'color:#7f93b3;font-size:13px', 'No trainers are ready for a rematch yet.'));
  } else {
    for (const t of o.ready) {
      const row = el('div', 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #2a364c');
      row.appendChild(el('span', 'color:#fff;font-weight:600', t.name));
      const btn = el('button', BTN, 'Re-challenge');
      btn.addEventListener('click', () => send('rechallenge', { gymId: t.gymId }));
      row.appendChild(btn);
      root.appendChild(row);
    }
  }

  return root;
}
