// ============================================================
//  FITWAGER — Health Challenge App  |  Phase 2
//  Login + Challenge Creation + Activity Logging
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, doc,
  updateDoc, setDoc, deleteDoc, arrayUnion, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---- FIREBASE CONFIG ----
const firebaseConfig = {
  apiKey: "AIzaSyATlStOCI8l6kgW0qe2Eysl2uPvc_F3Yyk",
  authDomain: "health-challenge-22404.firebaseapp.com",
  projectId: "health-challenge-22404",
  storageBucket: "health-challenge-22404.firebasestorage.app",
  messagingSenderId: "645884378214",
  appId: "1:645884378214:web:abc9fece52b346b81601a7"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ============================================================
//  METRIC DEFINITIONS
// ============================================================
const METRIC_DEFS = {
  workout: {
    icon: '💪', label: 'Workout',
    dynamicDesc: 'Goal adjusts based on avg weekly frequency',
    classicDesc: 'Points per workout session (max 5/week)',
    classicDefault: 2, classicUnit: 'pts per session',
  },
  steps: {
    icon: '👟', label: 'Steps',
    dynamicDesc: 'Goal adjusts based on avg daily steps',
    classicDesc: 'Points for hitting daily step goal',
    classicDefault: 1.5, classicUnit: 'pts per day',
  },
  sleep: {
    icon: '😴', label: 'Sleep',
    dynamicDesc: 'Goal adjusts based on avg hours slept (min 5h, max 8h)',
    classicDesc: 'Points for hitting nightly sleep goal',
    classicDefault: 1, classicUnit: 'pts per night',
  },
  water: {
    icon: '💧', label: 'Water',
    dynamicDesc: 'Goal adjusts based on avg daily cups (min 8, max 15)',
    classicDesc: 'Points for hitting daily water goal',
    classicDefault: 1, classicUnit: 'pts per day',
  },
  macros: {
    icon: '🥗', label: 'Macros',
    dynamicDesc: 'Tracked for personal awareness — no points',
    classicDesc: 'Tracked for personal awareness — no points',
    classicDefault: 0, classicUnit: 'tracking only',
  },
};

// ============================================================
//  THEME TOGGLE
// ============================================================
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = themeToggle.querySelector('.theme-icon');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('fw-theme', theme);
}
setTheme(localStorage.getItem('fw-theme') || 'dark');
themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ============================================================
//  SCREEN / PAGE HELPERS
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.querySelector(`.nav-link[data-page="${name}"]`)?.classList.add('active');
  if (name === 'log') refreshLogPage();
}
window.showPage = showPage;

// ============================================================
//  AUTH
// ============================================================
let currentUser = null;

document.getElementById('googleSignInBtn').addEventListener('click', async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err) { console.error(err); alert('Sign in failed. Please try again.'); }
});

document.getElementById('signOutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('userAvatar').src = user.photoURL || '';
    document.getElementById('userName').textContent = user.displayName || user.email;
    document.getElementById('greetName').textContent = (user.displayName || 'there').split(' ')[0];
    showScreen('appScreen');
    showPage('dashboard');
    await loadDashboard();
    await loadMyChallenges();
  } else {
    currentUser = null;
    showScreen('loginScreen');
  }
});

// ============================================================
//  NAV
// ============================================================
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => { e.preventDefault(); showPage(link.dataset.page); });
});

// ============================================================
//  TABS
// ============================================================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${name}`)?.classList.add('active');
  });
});

// ============================================================
//  PAYOUT CALCULATOR
// ============================================================
let firstSplitPct = 65;

function calcPayout(wager, participants, firstPct = firstSplitPct) {
  const secondPct = 100 - firstPct;
  const total     = Math.round(wager * participants * 100) / 100;
  const third     = wager;
  const remaining = Math.round((total - third) * 100) / 100;
  const first     = Math.round(remaining * (firstPct / 100) * 100) / 100;
  const second    = Math.round((remaining - first) * 100) / 100;
  return { total, remaining, first, second, third, firstPct, secondPct };
}

function updatePayoutPreview() {
  const wager   = parseFloat(document.getElementById('challengeWager').value) || 0;
  const preview = document.getElementById('payoutPreview');
  if (!wager || wager <= 0) {
    preview.innerHTML = '<span style="color:var(--text3)">Enter wager amount to see payout breakdown</span>';
    return;
  }
  const counts  = [2, 3, 4, 5, 6];
  const cur     = firstSplitPct;
  const sec     = 100 - cur;
  const rows    = counts.map(n => {
    const p = calcPayout(wager, n, cur);
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:7px 8px;color:var(--text2);font-size:13px;">${n} people</td>
      <td style="padding:7px 8px;font-weight:600;color:var(--accent);font-family:'Syne',sans-serif;">$${p.total}</td>
      <td style="padding:7px 8px;color:var(--text);font-weight:600;">$${p.first}</td>
      <td style="padding:7px 8px;color:var(--text);font-weight:600;">$${p.second}</td>
      <td style="padding:7px 8px;color:var(--text);font-weight:600;">$${p.third}</td>
    </tr>`;
  }).join('');
  preview.innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;">1st / 2nd Split of Remaining Pot</span>
        <button type="button" id="resetSplitBtn" style="font-size:11px;color:var(--accent2);background:none;border:none;cursor:pointer;padding:0;">Reset to 65/35</button>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:13px;color:var(--text2);">🥇 1st</span>
        <input type="range" id="splitSlider" min="50" max="90" step="5" value="${cur}" style="flex:1;accent-color:var(--accent);cursor:pointer;"/>
        <span style="font-size:13px;color:var(--text2);">🥈 2nd</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;">
        <span style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--accent);">${cur}%</span>
        <span style="font-size:11px;color:var(--text3);align-self:center;">of remaining after 3rd</span>
        <span style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--accent2);">${sec}%</span>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">🥉 3rd always gets <strong style="color:var(--text);">$${wager}</strong> back · Payouts update live as people join</div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid var(--border);">
          <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Participants</th>
          <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Pot</th>
          <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">🥇 1st</th>
          <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">🥈 2nd</th>
          <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">🥉 3rd</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  document.getElementById('splitSlider')?.addEventListener('input', (e) => {
    firstSplitPct = parseInt(e.target.value); updatePayoutPreview();
  });
  document.getElementById('resetSplitBtn')?.addEventListener('click', () => {
    firstSplitPct = 65; updatePayoutPreview();
  });
}
document.getElementById('challengeWager').addEventListener('input', updatePayoutPreview);

// ============================================================
//  METRIC TOGGLES (challenge creation)
// ============================================================
function getActiveMetrics() {
  return [...document.querySelectorAll('.metric-toggle.active')].map(el => el.dataset.metric);
}

document.querySelectorAll('.metric-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    updateClassicPointConfig();
  });
});

function updateClassicPointConfig() {
  const mode    = document.getElementById('challengeMode').value;
  const metrics = getActiveMetrics();
  const config  = document.getElementById('classicPointConfig');
  const fields  = document.getElementById('classicPointFields');

  if (mode !== 'classic' || metrics.length === 0) {
    config.style.display = 'none';
    return;
  }
  config.style.display = 'block';
  fields.innerHTML = metrics
    .filter(m => m !== 'macros')
    .map(m => {
      const def = METRIC_DEFS[m];
      return `
        <div class="config-row">
          <span class="config-row-icon">${def.icon}</span>
          <div style="flex:1;">
            <div class="config-row-label">${def.label}</div>
            <div style="font-size:11px;color:var(--text3);">${def.classicDesc}</div>
          </div>
          <input type="number" class="input config-row-input" id="classic_${m}"
            value="${def.classicDefault}" min="0" max="10" step="0.5"/>
          <span class="config-row-unit">${def.classicUnit}</span>
        </div>`;
    }).join('');
}

// ============================================================
//  MODE SELECTOR
// ============================================================
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    document.getElementById('challengeMode').value = card.dataset.mode;
    updateClassicPointConfig();
  });
});

// ============================================================
//  CREATE CHALLENGE MODAL
// ============================================================
const createModal = document.getElementById('createChallengeModal');

document.getElementById('openCreateChallenge').addEventListener('click', () => {
  const now      = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  document.getElementById('challengeStart').value = firstDay;
  document.getElementById('challengeEnd').value   = lastDay;
  createModal.classList.add('active');
});

function closeCreateModal() {
  createModal.classList.remove('active');
  document.getElementById('createChallengeForm').reset();
  document.getElementById('payoutPreview').innerHTML = '<span style="color:var(--text3)">Enter wager amount to see payout breakdown</span>';
  document.getElementById('classicPointConfig').style.display = 'none';
  firstSplitPct = 65;
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  document.querySelector('.mode-card[data-mode="dynamic"]').classList.add('active');
  document.getElementById('challengeMode').value = 'dynamic';
  // Reset metric toggles to default (workout + steps active)
  document.querySelectorAll('.metric-toggle').forEach(t => {
    t.classList.toggle('active', ['workout','steps'].includes(t.dataset.metric));
  });
}

document.getElementById('closeCreateChallenge').addEventListener('click', closeCreateModal);
document.getElementById('cancelCreateChallenge').addEventListener('click', closeCreateModal);
createModal.addEventListener('click', (e) => { if (e.target === createModal) closeCreateModal(); });

// ============================================================
//  GENERATE INVITE CODE
// ============================================================
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ============================================================
//  CREATE CHALLENGE
// ============================================================
document.getElementById('createChallengeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const name      = document.getElementById('challengeName').value.trim();
  const startDate = document.getElementById('challengeStart').value;
  const endDate   = document.getElementById('challengeEnd').value;
  const wager     = parseFloat(document.getElementById('challengeWager').value);
  const mode      = document.getElementById('challengeMode').value;
  const metrics   = getActiveMetrics();

  if (!name || !startDate || !endDate || !wager) { alert('Please fill in all fields.'); return; }
  if (new Date(startDate) >= new Date(endDate)) { alert('End date must be after start date.'); return; }
  if (metrics.length === 0) { alert('Please select at least one active metric.'); return; }

  // Collect classic point values if applicable
  const classicPoints = {};
  if (mode === 'classic') {
    metrics.forEach(m => {
      const el = document.getElementById(`classic_${m}`);
      classicPoints[m] = el ? parseFloat(el.value) || 0 : 0;
    });
  }

  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.textContent = 'Creating...';
  submitBtn.disabled = true;

  try {
    const challengeData = {
      name, startDate, endDate, wager, mode, metrics,
      inviteCode: generateCode(),
      payout: { firstSplitPct },
      classicPoints: mode === 'classic' ? classicPoints : {},
      adminId:   currentUser.uid,
      adminName: currentUser.displayName || currentUser.email,
      participants: [{
        uid: currentUser.uid, name: currentUser.displayName || currentUser.email,
        email: currentUser.email, photo: currentUser.photoURL || '',
        role: 'admin', joinedAt: new Date().toISOString()
      }],
      createdAt: serverTimestamp(),
      status: 'active'
    };

    const docRef = await addDoc(collection(db, 'challenges'), challengeData);
    closeCreateModal();
    await loadMyChallenges();
    await loadDashboard();
    showPage('challenges');
    showChallengeDetail(docRef.id, {...challengeData, id: docRef.id});

  } catch (err) {
    console.error(err);
    alert('Failed to create challenge. Please try again.');
  } finally {
    submitBtn.textContent = 'Create Challenge ⚡';
    submitBtn.disabled = false;
  }
});

// ============================================================
//  LOAD MY CHALLENGES
// ============================================================
async function loadMyChallenges() {
  if (!currentUser) return;
  const listEl = document.getElementById('myChallengesList');
  listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">Loading...</div>';
  try {
    const allSnap = await getDocs(collection(db, 'challenges'));
    const challenges = [];
    allSnap.forEach(d => {
      const data = d.data();
      const isMember = (data.participants || []).some(p => p.uid === currentUser.uid);
      if (isMember) challenges.push({id: d.id, ...data});
    });
    if (challenges.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><span>💪</span><p>No challenges yet. Create your first one!</p></div>';
      return;
    }
    listEl.innerHTML = challenges.map(c => renderChallengeCard(c)).join('');
    listEl.querySelectorAll('.challenge-card').forEach(card => {
      card.addEventListener('click', () => {
        const c = challenges.find(x => x.id === card.dataset.id);
        if (c) showChallengeDetail(c.id, c);
      });
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<div class="empty-state"><span>⚠️</span><p>Failed to load challenges.</p></div>';
  }
}

function renderChallengeCard(c) {
  const isAdmin   = c.adminId === currentUser?.uid;
  const count     = (c.participants || []).length;
  const daysLeft  = Math.max(0, Math.ceil((new Date(c.endDate) - new Date()) / 86400000));
  const modeLabel = c.mode === 'dynamic' ? '⚡ Dynamic' : '📋 Classic';
  const metricIcons = (c.metrics || ['workout','steps']).map(m => METRIC_DEFS[m]?.icon || '').join(' ');
  return `
    <div class="challenge-card" data-id="${c.id}">
      <div class="challenge-card-name">${escHtml(c.name)}</div>
      <div class="challenge-card-meta">
        <span class="badge badge-accent">${modeLabel}</span>
        ${isAdmin ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-purple">Participant</span>'}
        <span class="badge badge-warn">${daysLeft > 0 ? daysLeft + ' days left' : 'Ended'}</span>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:8px;">${formatDate(c.startDate)} → ${formatDate(c.endDate)}</div>
      <div style="font-size:16px;margin-bottom:4px;">${metricIcons}</div>
      <div class="challenge-card-footer">
        <span class="participant-count">👥 ${count} participant${count !== 1 ? 's' : ''}</span>
        <span class="wager-amount">$${c.wager}/person</span>
      </div>
    </div>`;
}

// ============================================================
//  DASHBOARD
// ============================================================
async function loadDashboard() {
  if (!currentUser) return;
  try {
    const allSnap = await getDocs(collection(db, 'challenges'));
    let active = 0, minDays = Infinity;
    const now = new Date();
    const activeChallenges = [];

    allSnap.forEach(d => {
      const data = d.data();
      const isMember = (data.participants || []).some(p => p.uid === currentUser.uid);
      if (!isMember) return;
      const end = new Date(data.endDate);
      if (end >= now && data.status === 'active') {
        active++;
        const days = Math.ceil((end - now) / 86400000);
        if (days < minDays) minDays = days;
        activeChallenges.push({id: d.id, ...data});
      }
    });

    document.getElementById('statActiveChallenges').textContent = active;
    document.getElementById('statTotalPoints').textContent = '—';
    document.getElementById('statCurrentRank').textContent = '—';
    document.getElementById('statDaysLeft').textContent = minDays === Infinity ? '—' : minDays;

    const listEl = document.getElementById('activeChallengesList');
    if (activeChallenges.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span>🏁</span><p>No active challenges yet.<br/>Create one or join via invite!</p><button class="btn-primary" onclick="showPage('challenges')">Browse Challenges</button></div>`;
    } else {
      listEl.innerHTML = activeChallenges.map(c => renderChallengeCard(c)).join('');
      listEl.querySelectorAll('.challenge-card').forEach(card => {
        card.addEventListener('click', () => {
          const c = activeChallenges.find(x => x.id === card.dataset.id);
          if (c) showChallengeDetail(c.id, c);
        });
      });
    }
  } catch (err) { console.error(err); }
}

// ============================================================
//  CHALLENGE DETAIL MODAL
// ============================================================
const detailModal = document.getElementById('challengeDetailModal');
document.getElementById('closeDetailModal').addEventListener('click', () => detailModal.classList.remove('active'));
detailModal.addEventListener('click', (e) => { if (e.target === detailModal) detailModal.classList.remove('active'); });

function showChallengeDetail(id, c) {
  const isAdmin  = c.adminId === currentUser?.uid;
  const count    = (c.participants || []).length;
  const splitPct = c.payout?.firstSplitPct ?? 65;
  const p        = calcPayout(c.wager, count, splitPct);
  const daysLeft = Math.max(0, Math.ceil((new Date(c.endDate) - new Date()) / 86400000));
  const metrics  = c.metrics || ['workout','steps'];

  document.getElementById('detailChallengeName').textContent = c.name;
  document.getElementById('challengeDetailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><label>Point System</label><span>${c.mode === 'dynamic' ? '⚡ Dynamic' : '📋 Classic'}</span></div>
      <div class="detail-item"><label>Wager</label><span>$${c.wager} per person</span></div>
      <div class="detail-item"><label>Start Date</label><span>${formatDate(c.startDate)}</span></div>
      <div class="detail-item"><label>End Date</label><span>${formatDate(c.endDate)}</span></div>
      <div class="detail-item"><label>Days Remaining</label><span>${daysLeft > 0 ? daysLeft + ' days' : 'Ended'}</span></div>
      <div class="detail-item"><label>Total Pot</label><span>$${p.total}</span></div>
    </div>

    <div style="margin-bottom:20px;">
      <div class="section-title" style="margin-top:0;">Active Metrics</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${metrics.map(m => `<span class="badge badge-accent">${METRIC_DEFS[m]?.icon} ${METRIC_DEFS[m]?.label}</span>`).join('')}
      </div>
    </div>

    ${isAdmin ? `
    <div class="invite-box">
      <h4>🔗 Invite Code — Share with participants</h4>
      <div class="invite-code-display">
        <span class="invite-code">${c.inviteCode}</span>
        <button class="btn-copy" onclick="copyCode('${c.inviteCode}')">Copy</button>
      </div>
      <p style="font-size:12px;color:var(--text3);margin-top:8px;">Participants go to Challenges → Join via Code and enter this code</p>
    </div>` : ''}

    <div style="margin-bottom:20px;">
      <div class="section-title" style="margin-top:0;">Live Payout · ${count} participant${count !== 1 ? 's' : ''} · $${p.total} pot</div>
      <div class="payout-preview">
        <div class="payout-row" style="margin-bottom:8px;">
          <span class="payout-place">🥇 1st Place</span>
          <div style="text-align:right;"><span class="payout-amount">$${p.first}</span><div style="font-size:11px;color:var(--text3);">${p.firstPct}% of remaining pot</div></div>
        </div>
        <div class="payout-row" style="margin-bottom:8px;">
          <span class="payout-place">🥈 2nd Place</span>
          <div style="text-align:right;"><span class="payout-amount">$${p.second}</span><div style="font-size:11px;color:var(--text3);">${p.secondPct}% of remaining pot</div></div>
        </div>
        <div class="payout-row">
          <span class="payout-place">🥉 3rd Place</span>
          <div style="text-align:right;"><span class="payout-amount">$${p.third}</span><div style="font-size:11px;color:var(--text3);">Wager returned (breaks even)</div></div>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);">💡 Amounts update automatically as more participants join</div>
      </div>
    </div>

    <div class="section-title">Participants (${count})</div>
    <div class="participants-list">
      ${(c.participants || []).map(pt => `
        <div class="participant-item">
          <div class="participant-avatar">
            ${pt.photo ? `<img src="${pt.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">` : escHtml((pt.name||'?')[0].toUpperCase())}
          </div>
          <span class="participant-name">${escHtml(pt.name || pt.email)}</span>
          <span class="participant-role">${pt.role === 'admin' ? '👑 Admin' : 'Participant'}</span>
        </div>`).join('')}
    </div>

    ${isAdmin ? `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border);">
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px;">
        ⚠️ Deleting this challenge will permanently remove it and all activity logs associated with it.
      </div>
      <button class="btn-danger" id="deleteChallengeBtn">🗑 Delete Challenge</button>
    </div>` : ''}`;

  detailModal.classList.add('active');

  // Attach delete handler after rendering
  if (isAdmin) {
    document.getElementById('deleteChallengeBtn')?.addEventListener('click', () => deleteChallenge(id, c.name));
  }
}

window.copyCode = function(code) {
  navigator.clipboard.writeText(code).then(() => alert(`Invite code "${code}" copied!`));
};

// ============================================================
//  DELETE CHALLENGE
// ============================================================
async function deleteChallenge(challengeId, challengeName) {
  const confirmed = confirm(
    `Are you sure you want to delete "${challengeName}"?\n\nThis will permanently delete the challenge and cannot be undone.`
  );
  if (!confirmed) return;

  const btn = document.getElementById('deleteChallengeBtn');
  if (btn) { btn.textContent = 'Deleting...'; btn.disabled = true; }

  try {
    // Step 1: Delete activity logs
    console.log('Step 1: Deleting activity logs for', challengeId);
    const logsSnap = await getDocs(
      query(collection(db, 'activityLogs'), where('challengeId', '==', challengeId))
    );
    console.log('Found', logsSnap.docs.length, 'activity logs to delete');
    for (const d of logsSnap.docs) {
      console.log('Deleting log:', d.id, 'userId:', d.data().userId);
      await deleteDoc(doc(db, 'activityLogs', d.id));
      console.log('Log deleted:', d.id);
    }

    // Step 2: Delete baselines
    console.log('Step 2: Deleting baselines');
    const basesSnap = await getDocs(collection(db, 'challenges', challengeId, 'baselines'));
    console.log('Found', basesSnap.docs.length, 'baselines to delete');
    for (const d of basesSnap.docs) {
      console.log('Deleting baseline:', d.id);
      await deleteDoc(doc(db, 'challenges', challengeId, 'baselines', d.id));
      console.log('Baseline deleted:', d.id);
    }

    // Step 3: Delete the challenge itself
    console.log('Step 3: Deleting challenge doc', challengeId);
    await deleteDoc(doc(db, 'challenges', challengeId));
    console.log('Challenge deleted successfully');

    // Close modal and refresh
    detailModal.classList.remove('active');
    await loadMyChallenges();
    await loadDashboard();

  } catch (err) {
    console.error('Delete error at step:', err.message, err);
    alert(`Failed to delete: ${err.message}`);
    if (btn) { btn.textContent = '🗑 Delete Challenge'; btn.disabled = false; }
  }
}

// ============================================================
//  JOIN CHALLENGE
// ============================================================
document.getElementById('joinChallengeBtn').addEventListener('click', async () => {
  const code  = document.getElementById('inviteCodeInput').value.trim().toUpperCase();
  const msgEl = document.getElementById('joinMessage');
  if (!code || code.length !== 6) {
    msgEl.className = 'join-message error';
    msgEl.textContent = '⚠️ Please enter a valid 6-character invite code.'; return;
  }
  msgEl.className = 'join-message';
  msgEl.textContent = 'Looking up challenge...';
  try {
    const snap = await getDocs(query(collection(db, 'challenges'), where('inviteCode', '==', code)));
    if (snap.empty) {
      msgEl.className = 'join-message error';
      msgEl.textContent = '❌ No challenge found with that code.'; return;
    }
    const docSnap   = snap.docs[0];
    const challenge = docSnap.data();
    if ((challenge.participants || []).some(p => p.uid === currentUser.uid)) {
      msgEl.className = 'join-message error';
      msgEl.textContent = '✅ You\'re already in this challenge!'; return;
    }
    await updateDoc(doc(db, 'challenges', docSnap.id), {
      participants: arrayUnion({
        uid: currentUser.uid, name: currentUser.displayName || currentUser.email,
        email: currentUser.email, photo: currentUser.photoURL || '',
        role: 'participant', joinedAt: new Date().toISOString()
      })
    });
    msgEl.className = 'join-message success';
    msgEl.textContent = `🎉 You've joined "${challenge.name}"!`;
    document.getElementById('inviteCodeInput').value = '';
    await loadMyChallenges();
    await loadDashboard();
  } catch (err) {
    console.error(err);
    msgEl.className = 'join-message error';
    msgEl.textContent = '❌ Something went wrong. Please try again.';
  }
});

// ============================================================
//  LOG PAGE — STATE
// ============================================================
let logState = {
  challenge:   null,
  baseline:    null,
  entries:     {},
  workoutType: null,
  activeDate:  null,
};

// ============================================================
//  LOG PAGE — REFRESH
// ============================================================
async function refreshLogPage() {
  if (!currentUser) return;
  const select = document.getElementById('logChallengeSelect');
  const prev   = select.value;
  select.innerHTML = '<option value="">— Choose a challenge to log for —</option>';
  try {
    const allSnap = await getDocs(collection(db, 'challenges'));
    const now = new Date();
    allSnap.forEach(d => {
      const data = d.data();
      const isMember = (data.participants || []).some(p => p.uid === currentUser.uid);
      if (isMember && new Date(data.endDate) >= now) {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = data.name;
        select.appendChild(opt);
      }
    });
    if (prev && [...select.options].some(o => o.value === prev)) {
      select.value = prev;
      await onChallengeSelected(prev);
    }
  } catch (err) { console.error(err); }
}

document.getElementById('logChallengeSelect').addEventListener('change', async (e) => {
  await onChallengeSelected(e.target.value);
});

async function onChallengeSelected(challengeId) {
  const container = document.getElementById('logFormContainer');
  if (!challengeId) { container.style.display = 'none'; return; }

  container.style.display = 'block';
  logState.challenge = null;
  logState.baseline  = null;
  logState.entries   = {};

  const snap = await getDoc(doc(db, 'challenges', challengeId));
  if (!snap.exists()) return;
  logState.challenge = { id: snap.id, ...snap.data() };

  if (logState.challenge.mode === 'dynamic') {
    const bSnap = await getDoc(doc(db, 'challenges', challengeId, 'baselines', currentUser.uid));
    logState.baseline = bSnap.exists() ? bSnap.data() : null;
  }

  const eSnap = await getDocs(
    query(collection(db, 'activityLogs'),
      where('challengeId', '==', challengeId),
      where('userId', '==', currentUser.uid))
  );
  eSnap.forEach(d => { logState.entries[d.data().date] = { id: d.id, ...d.data() }; });

  const c = logState.challenge;
  const metrics = c.metrics || ['workout','steps'];
  const baselinePrompt  = document.getElementById('baselinePrompt');
  const calendarContainer = document.getElementById('calendarContainer');

  if (c.mode === 'dynamic' && !logState.baseline) {
    baselinePrompt.style.display  = 'block';
    calendarContainer.style.display = 'none';
    renderBaselineFields(metrics);
  } else {
    baselinePrompt.style.display  = 'none';
    calendarContainer.style.display = 'block';
    renderCalendar();
  }
}

// ============================================================
//  CALENDAR RENDERER
// ============================================================
function renderCalendar() {
  const c = logState.challenge;
  if (!c) return;

  const calEl   = document.getElementById('activityCalendar');
  const metrics = c.metrics || ['workout','steps'];
  const start   = new Date(c.startDate + 'T00:00:00');
  const end     = new Date(c.endDate   + 'T00:00:00');
  const today   = new Date(); today.setHours(0,0,0,0);

  // Group days by month
  const months = {};
  const cur = new Date(start);
  while (cur <= end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
    if (!months[key]) months[key] = { year: cur.getFullYear(), month: cur.getMonth(), days: [] };
    months[key].days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  // Legend
  const legendHtml = `
    <div class="cal-legend">
      ${metrics.map(m => `<div class="cal-legend-item"><span>${METRIC_DEFS[m].icon}</span><span>${METRIC_DEFS[m].label}</span></div>`).join('')}
      <div class="cal-legend-item" style="margin-left:auto;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--text3);opacity:0.4;"></span><span>Not logged</span></div>
      <div class="cal-legend-item"><span style="color:var(--accent);font-weight:700;">⭐</span><span>Points earned</span></div>
    </div>`;

  // Render each month block
  const monthsHtml = Object.values(months).map(({ year, month, days }) => {
    const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      .map(d => `<div class="cal-day-header">${d}</div>`).join('');

    // Padding cells before first day
    const firstDow = days[0].getDay();
    const pads = Array(firstDow).fill('<div class="cal-day empty-cell"></div>').join('');

    const dayCells = days.map(day => {
      const dateStr   = toDateStr(day);
      const entry     = logState.entries[dateStr];
      const isToday   = day.getTime() === today.getTime();
      const isFuture  = day > today;
      const inRange   = day >= start && day <= end;

      let cls = 'cal-day';
      if (isToday)  cls += ' today';
      if (isFuture) cls += ' future';
      if (!inRange) cls += ' outside-range';

      let innerHtml = `<div class="cal-day-num">${day.getDate()}</div>`;

      if (entry) {
        // Build emoji indicators for each logged metric
        const emojis = metrics.map(m => {
          if (m === 'workout') return entry.workout?.done === 'yes' ? '💪' : '';
          if (m === 'steps')   return (entry.steps || 0) > 0 ? '👟' : '';
          if (m === 'sleep')   return (entry.sleep || 0) > 0 ? '😴' : '';
          if (m === 'water')   return (entry.water || 0) > 0 ? '💧' : '';
          if (m === 'macros')  return (entry.macros?.calories || 0) > 0 ? '🥗' : '';
          return '';
        }).filter(Boolean).join('');

        innerHtml += `<div class="cal-day-emojis">${emojis}</div>`;
        if (entry.points > 0) {
          innerHtml += `<div class="cal-day-points">+${entry.points}pts</div>`;
        }
      } else if (!isFuture && inRange) {
        innerHtml += `<div class="cal-day-dot"></div>`;
      }

      return `<div class="${cls}" data-date="${dateStr}">${innerHtml}</div>`;
    }).join('');

    return `
      <div class="cal-month-block">
        <div class="cal-month-title">${monthName}</div>
        <div class="cal-grid">
          ${dayHeaders}
          ${pads}
          ${dayCells}
        </div>
      </div>`;
  }).join('');

  calEl.innerHTML = legendHtml + monthsHtml;

  // Attach click handlers to calendar days
  calEl.querySelectorAll('.cal-day:not(.future):not(.outside-range):not(.empty-cell)').forEach(cell => {
    cell.addEventListener('click', () => openLogModal(cell.dataset.date));
  });
}

// ============================================================
//  LOG MODAL — OPEN / CLOSE
// ============================================================
const logModal = document.getElementById('logEntryModal');
document.getElementById('closeLogModal').addEventListener('click', closeLogModal);
logModal.addEventListener('click', (e) => { if (e.target === logModal) closeLogModal(); });

function openLogModal(dateStr) {
  const c       = logState.challenge;
  if (!c) return;
  const metrics  = c.metrics || ['workout','steps'];
  const existing = logState.entries[dateStr] || null;
  logState.activeDate  = dateStr;
  logState.workoutType = existing?.workout?.type || null;

  // Set modal title and date
  const d = new Date(dateStr + 'T00:00:00');
  document.getElementById('logModalTitle').textContent = existing ? '✏️ Edit Entry' : '➕ Log Activity';
  document.getElementById('logModalDate').textContent  = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });

  // Existing entry note
  document.getElementById('existingEntryNote').textContent = existing ? '⚠️ Saving will replace your existing entry for this date' : '';

  // Render metric sections inside modal
  const sectionsEl = document.getElementById('metricSections');
  sectionsEl.innerHTML = metrics.map(m => renderMetricSection(m, c, dateStr, existing)).join('');
  document.getElementById('pointsPreview').style.display = 'none';

  if (existing) populateExistingEntry(existing, metrics);

  attachLogListeners(metrics, c, dateStr);
  updatePointsPreview(metrics, c, dateStr);

  logModal.classList.add('active');
}

function closeLogModal() {
  logModal.classList.remove('active');
  logState.activeDate  = null;
  logState.workoutType = null;
}

// ============================================================
//  BASELINE FIELDS
// ============================================================
function renderBaselineFields(metrics) {
  const fields = document.getElementById('baselineFields');
  const defs   = {
    workout: { label: 'Average workout days per week last month', sub: 'Enter a number from 1–5', min: 1, max: 5, step: 1, placeholder: 'e.g. 3', unit: 'days/week' },
    steps:   { label: 'Average daily step count last month', sub: 'We\'ll add 1,000 as your starting goal', min: 500, max: 20000, step: 100, placeholder: 'e.g. 6000', unit: 'steps/day' },
    sleep:   { label: 'Average hours of sleep per night last month', sub: 'Min goal: 5h · Max goal: 8h', min: 1, max: 12, step: 0.5, placeholder: 'e.g. 6', unit: 'hours/night' },
    water:   { label: 'Average cups of water per day last month', sub: 'Min goal: 8 cups · Max goal: 15 cups', min: 1, max: 20, step: 1, placeholder: 'e.g. 6', unit: 'cups/day' },
  };

  fields.innerHTML = metrics
    .filter(m => m !== 'macros' && defs[m])
    .map(m => {
      const d = defs[m];
      return `
        <div class="baseline-row">
          <span class="baseline-row-icon">${METRIC_DEFS[m].icon}</span>
          <div style="flex:1;">
            <div class="baseline-row-label">${d.label}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px;">${d.sub}</div>
          </div>
          <input type="number" class="input baseline-row-input" id="baseline_${m}"
            min="${d.min}" max="${d.max}" step="${d.step}" placeholder="${d.placeholder}"/>
          <span style="font-size:12px;color:var(--text3);white-space:nowrap;">${d.unit}</span>
        </div>`;
    }).join('');
}

document.getElementById('saveBaselineBtn').addEventListener('click', async () => {
  const c       = logState.challenge;
  const metrics = c.metrics || ['workout','steps'];
  const baseline = {};

  for (const m of metrics.filter(x => x !== 'macros')) {
    const val = parseFloat(document.getElementById(`baseline_${m}`)?.value);
    if (isNaN(val) || val <= 0) {
      alert(`Please enter a valid value for ${METRIC_DEFS[m].label}`); return;
    }
    baseline[m] = val;
  }

  // Calculate initial weekly goals from baseline
  baseline.goals = computeInitialGoals(baseline, metrics);

  try {
    await setDoc(doc(db, 'challenges', c.id, 'baselines', currentUser.uid), {
      ...baseline, userId: currentUser.uid, createdAt: serverTimestamp()
    });
    logState.baseline = baseline;
    document.getElementById('baselinePrompt').style.display   = 'none';
    document.getElementById('calendarContainer').style.display = 'block';
    renderCalendar();
  } catch (err) {
    console.error(err); alert('Failed to save baseline. Please try again.');
  }
});

function computeInitialGoals(baseline, metrics) {
  const goals = {};
  if (metrics.includes('workout') && baseline.workout) {
    goals.workout = Math.min(5, Math.max(2, Math.round(baseline.workout) + 1));
  }
  if (metrics.includes('steps') && baseline.steps) {
    goals.steps = Math.min(10000, Math.max(5000, Math.round(baseline.steps / 1000) * 1000 + 1000));
  }
  if (metrics.includes('sleep') && baseline.sleep) {
    goals.sleep = Math.min(8, Math.max(5, Math.floor(baseline.sleep) + 1));
  }
  if (metrics.includes('water') && baseline.water) {
    goals.water = Math.min(15, Math.max(8, Math.round(baseline.water) + 1));
  }
  return goals;
}

// ============================================================
//  RENDER METRIC SECTION
// ============================================================
function renderMetricSection(metric, challenge, dateStr, existing) {
  const def  = METRIC_DEFS[metric];
  const goal = getGoalForMetric(metric, challenge, dateStr);
  const goalText = goal ? `Goal: ${formatGoal(metric, goal)}` : '';

  let body = '';

  if (metric === 'workout') {
    body = `
      <div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px;font-weight:600;">Workout Type</div>
        <div class="workout-type-selector">
          <button type="button" class="workout-type-btn" data-type="strength">💪 Strength</button>
          <button type="button" class="workout-type-btn" data-type="running">🏃 Running Sport</button>
          <button type="button" class="workout-type-btn" data-type="nonrunning">🏊 Non-Running Sport</button>
        </div>
      </div>
      <div class="log-input-row">
        <label>Did you complete a workout today?</label>
        <select id="log_workout_done" class="input" style="max-width:140px;">
          <option value="">Select</option>
          <option value="yes">✅ Yes</option>
          <option value="no">❌ No</option>
        </select>
      </div>`;
  } else if (metric === 'steps') {
    body = `
      <div class="log-input-row">
        <label>Step count today</label>
        <input type="number" id="log_steps" class="input" placeholder="e.g. 8500" min="0" max="100000"/>
        <span class="log-input-unit">steps</span>
      </div>`;
  } else if (metric === 'sleep') {
    body = `
      <div class="log-input-row">
        <label>Hours of sleep last night</label>
        <input type="number" id="log_sleep" class="input" placeholder="e.g. 7" min="0" max="24" step="0.5"/>
        <span class="log-input-unit">hours</span>
      </div>`;
  } else if (metric === 'water') {
    body = `
      <div class="log-input-row">
        <label>Cups of water today</label>
        <input type="number" id="log_water" class="input" placeholder="e.g. 10" min="0" max="50"/>
        <span class="log-input-unit">cups</span>
      </div>`;
  } else if (metric === 'macros') {
    body = `
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px;">Tracking only — no points awarded for macros</div>
      <div class="macro-grid">
        <div class="macro-field">
          <label>Calories</label>
          <input type="number" id="log_calories" class="input" placeholder="e.g. 2000" min="0"/>
        </div>
        <div class="macro-field">
          <label>Protein (g)</label>
          <input type="number" id="log_protein" class="input" placeholder="e.g. 150" min="0"/>
        </div>
        <div class="macro-field">
          <label>Carbs (g)</label>
          <input type="number" id="log_carbs" class="input" placeholder="e.g. 200" min="0"/>
        </div>
        <div class="macro-field">
          <label>Fat (g)</label>
          <input type="number" id="log_fat" class="input" placeholder="e.g. 70" min="0"/>
        </div>
      </div>`;
  }

  return `
    <div class="metric-section" id="section_${metric}">
      <div class="metric-section-header">
        <span class="metric-section-icon">${def.icon}</span>
        <span class="metric-section-title">${def.label}</span>
        ${goalText ? `<span class="metric-section-goal">${goalText}</span>` : ''}
      </div>
      <div class="metric-section-body">${body}</div>
    </div>`;
}

function formatGoal(metric, goal) {
  if (metric === 'workout') return `${goal} workouts/week`;
  if (metric === 'steps')   return `${goal.toLocaleString()} steps`;
  if (metric === 'sleep')   return `${goal} hours`;
  if (metric === 'water')   return `${goal} cups`;
  return '';
}

function getGoalForMetric(metric, challenge, dateStr) {
  if (metric === 'macros') return null;
  if (challenge.mode === 'classic') {
    const defaults = { workout: 5, steps: 8000, sleep: 8, water: 10 };
    return defaults[metric] || null;
  }
  // Dynamic — read from baseline goals (week-adjusted in future phase)
  return logState.baseline?.goals?.[metric] || null;
}

// ============================================================
//  POPULATE EXISTING ENTRY
// ============================================================
function populateExistingEntry(entry, metrics) {
  if (metrics.includes('workout')) {
    if (entry.workout?.done) document.getElementById('log_workout_done').value = entry.workout.done;
    if (entry.workout?.type) {
      logState.workoutType = entry.workout.type;
      document.querySelectorAll('.workout-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === entry.workout.type);
      });
    }
  }
  if (metrics.includes('steps')  && entry.steps  != null) document.getElementById('log_steps').value  = entry.steps;
  if (metrics.includes('sleep')  && entry.sleep  != null) document.getElementById('log_sleep').value  = entry.sleep;
  if (metrics.includes('water')  && entry.water  != null) document.getElementById('log_water').value  = entry.water;
  if (metrics.includes('macros')) {
    if (entry.macros?.calories != null) document.getElementById('log_calories').value = entry.macros.calories;
    if (entry.macros?.protein  != null) document.getElementById('log_protein').value  = entry.macros.protein;
    if (entry.macros?.carbs    != null) document.getElementById('log_carbs').value    = entry.macros.carbs;
    if (entry.macros?.fat      != null) document.getElementById('log_fat').value      = entry.macros.fat;
  }
}

// ============================================================
//  ATTACH LOG LISTENERS
// ============================================================
function attachLogListeners(metrics, challenge, dateStr) {
  // Workout type buttons
  document.querySelectorAll('.workout-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.workout-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      logState.workoutType = btn.dataset.type;
      updatePointsPreview(metrics, challenge, dateStr);
    });
  });

  // Input changes
  const inputIds = ['log_workout_done','log_steps','log_sleep','log_water','log_calories','log_protein','log_carbs','log_fat'];
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('change', () => updatePointsPreview(metrics, challenge, dateStr));
    el?.addEventListener('input',  () => updatePointsPreview(metrics, challenge, dateStr));
  });

  // Clear button
  document.getElementById('clearLogBtn').onclick = () => {
    inputIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.querySelectorAll('.workout-type-btn').forEach(b => b.classList.remove('active'));
    logState.workoutType = null;
    updatePointsPreview(metrics, challenge, dateStr);
  };

  // Submit button
  document.getElementById('submitLogBtn').onclick = () => submitLog(metrics, challenge, dateStr);
}

// ============================================================
//  POINT CALCULATION ENGINE
// ============================================================
function calcPointsForEntry(metrics, challenge, dateStr) {
  const c       = challenge;
  const mode    = c.mode;
  const results = {};
  let total     = 0;

  for (const metric of metrics) {
    if (metric === 'macros') { results.macros = { pts: 0, note: 'Tracking only' }; continue; }

    const goal = getGoalForMetric(metric, c, dateStr);

    if (metric === 'workout') {
      const done = document.getElementById('log_workout_done')?.value === 'yes';
      if (!done) { results.workout = { pts: 0, note: 'No workout logged' }; continue; }

      let pts;
      if (mode === 'classic') {
        pts = c.classicPoints?.workout ?? 2;
      } else {
        // Dynamic: pts = 10 / weekly goal
        const weeklyGoal = goal || 3;
        pts = Math.round((10 / weeklyGoal) * 100) / 100;
      }
      results.workout = { pts, note: `Workout completed (${logState.workoutType || 'type not set'})` };
      total += pts;

    } else if (metric === 'steps') {
      const steps = parseInt(document.getElementById('log_steps')?.value) || 0;
      if (!steps) { results.steps = { pts: 0, note: 'No steps entered' }; continue; }

      // If running sport done today, multiply step goal by 1.5
      const isRunning  = logState.workoutType === 'running';
      const effectiveGoal = isRunning ? Math.round(goal * 1.5) : goal;
      const hit = steps >= (effectiveGoal || 8000);

      let pts = 0;
      if (hit) {
        pts = mode === 'classic' ? (c.classicPoints?.steps ?? 1.5) : 1.5;
      }
      results.steps = {
        pts,
        note: hit
          ? `${steps.toLocaleString()} steps ✅ (goal: ${(effectiveGoal||8000).toLocaleString()}${isRunning ? ' — running sport modifier' : ''})`
          : `${steps.toLocaleString()} steps ❌ (goal: ${(effectiveGoal||8000).toLocaleString()})`
      };
      total += pts;

    } else if (metric === 'sleep') {
      const hours = parseFloat(document.getElementById('log_sleep')?.value) || 0;
      if (!hours) { results.sleep = { pts: 0, note: 'No sleep logged' }; continue; }
      const hit = hours >= (goal || 8);
      let pts = 0;
      if (hit) {
        pts = mode === 'classic' ? (c.classicPoints?.sleep ?? 1) : 1;
      }
      results.sleep = { pts, note: hit ? `${hours}h ✅ (goal: ${goal || 8}h)` : `${hours}h ❌ (goal: ${goal || 8}h)` };
      total += pts;

    } else if (metric === 'water') {
      const cups = parseInt(document.getElementById('log_water')?.value) || 0;
      if (!cups) { results.water = { pts: 0, note: 'No water logged' }; continue; }
      const hit = cups >= (goal || 10);
      let pts = 0;
      if (hit) {
        pts = mode === 'classic' ? (c.classicPoints?.water ?? 1) : 1;
      }
      results.water = { pts, note: hit ? `${cups} cups ✅ (goal: ${goal || 10})` : `${cups} cups ❌ (goal: ${goal || 10})` };
      total += pts;
    }
  }

  return { results, total: Math.round(total * 100) / 100 };
}

function updatePointsPreview(metrics, challenge, dateStr) {
  const { results, total } = calcPointsForEntry(metrics, challenge, dateStr);
  const previewEl = document.getElementById('pointsPreview');
  const breakdownEl = document.getElementById('pointsBreakdown');
  const totalEl = document.getElementById('pointsTotal');

  const hasAnyInput = metrics.some(m => {
    if (m === 'workout') return document.getElementById('log_workout_done')?.value;
    if (m === 'steps')   return document.getElementById('log_steps')?.value;
    if (m === 'sleep')   return document.getElementById('log_sleep')?.value;
    if (m === 'water')   return document.getElementById('log_water')?.value;
    return false;
  });

  if (!hasAnyInput) { previewEl.style.display = 'none'; return; }
  previewEl.style.display = 'block';

  breakdownEl.innerHTML = Object.entries(results).map(([m, r]) => `
    <div class="points-row">
      <span class="points-row-label">${METRIC_DEFS[m]?.icon} ${METRIC_DEFS[m]?.label} — ${r.note}</span>
      <span class="points-row-value">${r.pts > 0 ? '+' + r.pts : '—'}</span>
    </div>`).join('');

  totalEl.innerHTML = `<span>Total Points</span><span>+${total} pts</span>`;
}

// ============================================================
//  SUBMIT LOG ENTRY
// ============================================================
async function submitLog(metrics, challenge, dateStr) {
  if (!currentUser || !challenge) return;

  const { results, total } = calcPointsForEntry(metrics, challenge, dateStr);
  const submitBtn = document.getElementById('submitLogBtn');
  submitBtn.textContent = 'Saving...';
  submitBtn.disabled = true;

  try {
    const entryData = {
      challengeId: challenge.id,
      userId:      currentUser.uid,
      userName:    currentUser.displayName || currentUser.email,
      date:        dateStr,
      points:      total,
      updatedAt:   serverTimestamp(),
    };

    // Add each metric's raw data
    if (metrics.includes('workout')) {
      entryData.workout = {
        done: document.getElementById('log_workout_done')?.value || 'no',
        type: logState.workoutType || null,
      };
    }
    if (metrics.includes('steps'))  entryData.steps  = parseInt(document.getElementById('log_steps')?.value)  || 0;
    if (metrics.includes('sleep'))  entryData.sleep  = parseFloat(document.getElementById('log_sleep')?.value) || 0;
    if (metrics.includes('water'))  entryData.water  = parseInt(document.getElementById('log_water')?.value)  || 0;
    if (metrics.includes('macros')) {
      entryData.macros = {
        calories: parseInt(document.getElementById('log_calories')?.value) || 0,
        protein:  parseInt(document.getElementById('log_protein')?.value)  || 0,
        carbs:    parseInt(document.getElementById('log_carbs')?.value)    || 0,
        fat:      parseInt(document.getElementById('log_fat')?.value)      || 0,
      };
    }

    // Upsert: use a deterministic doc ID so re-saving replaces the entry
    const docId = `${challenge.id}_${currentUser.uid}_${dateStr}`;
    await setDoc(doc(db, 'activityLogs', docId), entryData);

    // Update local cache
    logState.entries[dateStr] = { id: docId, ...entryData };

    // Close modal and refresh calendar
    closeLogModal();
    renderCalendar();

  } catch (err) {
    console.error(err);
    alert('Failed to save entry. Please try again.');
  } finally {
    submitBtn.textContent = 'Save Entry ⚡';
    submitBtn.disabled = false;
  }
}

// ============================================================
//  UTILITIES
// ============================================================
function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}
