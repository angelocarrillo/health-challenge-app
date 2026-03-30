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
  const icon = theme === 'dark' ? '☀️' : '🌙';
  themeIcon.textContent = icon;
  const navIcon = document.querySelector('.theme-icon-nav');
  if (navIcon) navIcon.textContent = icon;
  localStorage.setItem('fw-theme', theme);
}
setTheme(localStorage.getItem('fw-theme') || 'dark');
themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});
document.getElementById('themeToggleNav')?.addEventListener('click', () => {
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
  document.querySelectorAll('.mobile-nav-item').forEach(l => l.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.querySelector(`.nav-link[data-page="${name}"]`)?.classList.add('active');
  document.querySelector(`.mobile-nav-item[data-page="${name}"]`)?.classList.add('active');
  if (name === 'log')       refreshLogPage();
  if (name === 'analytics') populateAnalyticsSelector();
}

// Wire up mobile nav buttons
document.querySelectorAll('.mobile-nav-item').forEach(btn => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});
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
    const active = [], ended = [];
    allSnap.forEach(d => {
      const data = d.data();
      const isMember = (data.participants || []).some(p => p.uid === currentUser.uid);
      if (!isMember) return;
      if (new Date(data.endDate) < new Date()) ended.push({id: d.id, ...data});
      else active.push({id: d.id, ...data});
    });
    const challenges = [...active, ...ended];
    if (challenges.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><span>💪</span><p>No challenges yet. Create your first one!</p></div>';
      return;
    }
    // Section headers if there are both active and ended
    let html = '';
    if (active.length > 0 && ended.length > 0) {
      html += `<div class="section-title" style="margin-top:0;">Active</div>`;
      html += active.map(c => renderChallengeCard(c)).join('');
      html += `<div class="section-title">Past Challenges</div>`;
      html += ended.map(c => renderChallengeCard(c)).join('');
    } else {
      html = challenges.map(c => renderChallengeCard(c)).join('');
    }
    listEl.innerHTML = html;
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
  const now       = new Date();
  const ended     = new Date(c.endDate) < now;
  const daysLeft  = Math.max(0, Math.ceil((new Date(c.endDate) - now) / 86400000));
  const modeLabel = c.mode === 'dynamic' ? '⚡ Dynamic' : '📋 Classic';
  const metricIcons = (c.metrics || ['workout','steps']).map(m => METRIC_DEFS[m]?.icon || '').join(' ');
  return `
    <div class="challenge-card ${ended ? 'challenge-card-ended' : ''}" data-id="${c.id}">
      <div class="challenge-card-name">${escHtml(c.name)}</div>
      <div class="challenge-card-meta">
        <span class="badge badge-accent">${modeLabel}</span>
        ${isAdmin ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-purple">Participant</span>'}
        ${ended
          ? '<span class="badge badge-ended">✅ Ended</span>'
          : `<span class="badge badge-warn">${daysLeft} days left</span>`}
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

    // Tally total points across all active challenges
    let totalPts = 0;
    let bestRank = Infinity;
    for (const c of activeChallenges) {
      const logsSnap = await getDocs(query(collection(db, 'activityLogs'), where('challengeId', '==', c.id)));
      const allLogs = [];
      logsSnap.forEach(d => allLogs.push(d.data()));
      const myPts = allLogs.filter(l => l.userId === currentUser.uid).reduce((s,l) => s+(l.points||0), 0);
      totalPts += myPts;
      // Compute rank in this challenge
      const userTotals = {};
      allLogs.forEach(l => { userTotals[l.userId] = (userTotals[l.userId]||0) + (l.points||0); });
      const sorted = Object.values(userTotals).sort((a,b) => b-a);
      const rank   = sorted.indexOf(myPts) + 1 || (c.participants||[]).length;
      if (rank < bestRank) bestRank = rank;
    }
    document.getElementById('statActiveChallenges').textContent = active;
    document.getElementById('statTotalPoints').textContent = Math.round(totalPts * 10) / 10;
    document.getElementById('statCurrentRank').textContent = bestRank === Infinity ? '—' : `#${bestRank}`;
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
// Pending join state (waiting for nickname)
let pendingJoin = { challengeId: null, challengeName: null };

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
    // Store pending join and open nickname modal
    pendingJoin = { challengeId: docSnap.id, challengeName: challenge.name };
    msgEl.className = 'join-message';
    msgEl.textContent = '';
    // Pre-fill nickname with first name
    document.getElementById('nicknameInput').value = (currentUser.displayName || '').split(' ')[0];
    document.getElementById('nicknameModal').classList.add('active');
  } catch (err) {
    console.error(err);
    msgEl.className = 'join-message error';
    msgEl.textContent = '❌ Something went wrong. Please try again.';
  }
});

// ============================================================
//  NICKNAME MODAL
// ============================================================
const nicknameModal = document.getElementById('nicknameModal');

document.getElementById('saveNicknameBtn').addEventListener('click', async () => {
  const nickname = document.getElementById('nicknameInput').value.trim();
  if (!nickname) { alert('Please enter a nickname.'); return; }
  if (!pendingJoin.challengeId) return;

  const btn = document.getElementById('saveNicknameBtn');
  btn.textContent = 'Joining...'; btn.disabled = true;

  try {
    await updateDoc(doc(db, 'challenges', pendingJoin.challengeId), {
      participants: arrayUnion({
        uid:      currentUser.uid,
        name:     currentUser.displayName || currentUser.email,
        nickname: nickname,
        email:    currentUser.email,
        photo:    currentUser.photoURL || '',
        role:     'participant',
        joinedAt: new Date().toISOString()
      })
    });
    nicknameModal.classList.remove('active');
    const msgEl = document.getElementById('joinMessage');
    msgEl.className = 'join-message success';
    msgEl.textContent = `🎉 You've joined "${pendingJoin.challengeName}" as "${nickname}"!`;
    document.getElementById('inviteCodeInput').value = '';
    pendingJoin = { challengeId: null, challengeName: null };
    await loadMyChallenges();
    await loadDashboard();
  } catch (err) {
    console.error(err);
    alert('Failed to join. Please try again.');
  } finally {
    btn.textContent = 'Join Challenge ⚡'; btn.disabled = false;
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
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          // Mobile: green dot + points only — no emojis to avoid layout warping
          innerHtml += `<div class="cal-logged-dot"></div>`;
          if (entry.points > 0) {
            innerHtml += `<div class="cal-day-points">${entry.points}pts</div>`;
          }
        } else {
          // Desktop: full emojis per metric + points
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
            innerHtml += `<div class="cal-day-points">${entry.points}pts</div>`;
          }
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

  let goalText = goal ? `Goal: ${formatGoal(metric, goal)}` : '';

  // For workouts, also show how many have been logged this week vs cap
  if (metric === 'workout' && goal) {
    const weeklyGoal   = goal;
    const alreadyDone  = getWorkoutsThisWeek(dateStr, challenge, dateStr);
    const ptsPerWkt    = challenge.mode === 'dynamic'
      ? Math.round((10 / weeklyGoal) * 100) / 100
      : (challenge.classicPoints?.workout ?? 2);
    goalText = `Goal: ${weeklyGoal}/week · ${ptsPerWkt} pts each · ${alreadyDone}/${weeklyGoal} done this week`;
  }

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

// ============================================================
//  WEEK UTILITIES
// ============================================================

// Returns the challenge week number (0-indexed) for a given date
function getWeekIndex(dateStr, challengeStartDate) {
  const start = new Date(challengeStartDate + 'T00:00:00');
  const date  = new Date(dateStr + 'T00:00:00');
  return Math.floor((date - start) / (7 * 24 * 60 * 60 * 1000));
}

// Returns all dates in the same challenge week as dateStr
function getWeekDates(dateStr, challengeStartDate) {
  const weekIdx = getWeekIndex(dateStr, challengeStartDate);
  const start   = new Date(challengeStartDate + 'T00:00:00');
  const weekStart = new Date(start.getTime() + weekIdx * 7 * 24 * 60 * 60 * 1000);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(toDateStr(d));
  }
  return dates;
}

// Returns all dates in the PREVIOUS challenge week
function getPrevWeekDates(dateStr, challengeStartDate) {
  const weekIdx = getWeekIndex(dateStr, challengeStartDate);
  if (weekIdx === 0) return [];
  return getWeekDates(
    toDateStr(new Date(new Date(challengeStartDate + 'T00:00:00').getTime() + (weekIdx - 1) * 7 * 24 * 60 * 60 * 1000)),
    challengeStartDate
  );
}

// Count how many days in a set of dates the user hit a metric goal
function countHitDays(dates, metric, goalValue, allEntries, challengeStartDate) {
  return dates.filter(d => {
    const entry = allEntries[d];
    if (!entry) return false;
    if (metric === 'workout') return entry.workout?.done === 'yes';
    if (metric === 'steps') {
      const isRunning     = entry.workout?.type === 'running';
      const effectiveGoal = isRunning ? Math.round(goalValue * 1.5) : goalValue;
      return (entry.steps || 0) >= effectiveGoal;
    }
    if (metric === 'sleep') return (entry.sleep || 0) >= goalValue;
    if (metric === 'water') return (entry.water || 0) >= goalValue;
    return false;
  }).length;
}

// ============================================================
//  DYNAMIC GOAL PROGRESSION ENGINE
//  Returns the correct goal for a given metric on a given date,
//  accounting for week-over-week progression based on 5/7 rule.
// ============================================================
function getDynamicGoal(metric, dateStr, challenge) {
  const baseline = logState.baseline;
  if (!baseline) return null;

  const initialGoal = baseline.goals?.[metric];
  if (!initialGoal) return null;

  const weekIdx = getWeekIndex(dateStr, challenge.startDate);
  if (weekIdx === 0) return initialGoal; // Week 1 always uses initial goal

  // Walk through each previous week and apply progression
  let currentGoal = initialGoal;
  for (let w = 0; w < weekIdx; w++) {
    const weekStart = toDateStr(new Date(new Date(challenge.startDate + 'T00:00:00').getTime() + w * 7 * 24 * 60 * 60 * 1000));
    const weekDates = getWeekDates(weekStart, challenge.startDate);

    if (metric === 'workout') {
      // Workout progression: if user hit their weekly workout goal (or more), increase next week's goal
      const workoutsDone = countHitDays(weekDates, 'workout', currentGoal, logState.entries, challenge.startDate);
      if (workoutsDone >= currentGoal) {
        currentGoal = Math.min(5, currentGoal + 1);
      }
      // Otherwise stays the same
    } else {
      // Steps/sleep/water: use 5/7 days rule
      const hitDays = countHitDays(weekDates, metric, currentGoal, logState.entries, challenge.startDate);
      if (hitDays >= 5) {
        if (metric === 'steps') currentGoal = Math.min(10000, currentGoal + 1000);
        if (metric === 'sleep') currentGoal = Math.min(8, currentGoal + 1);
        if (metric === 'water') currentGoal = Math.min(15, currentGoal + 1);
      }
    }
    // Goal never decreases
  }

  return currentGoal;
}

// ============================================================
//  COUNT WORKOUTS ALREADY LOGGED THIS WEEK
//  Used to enforce the weekly workout cap
// ============================================================
function getWorkoutsThisWeek(dateStr, challenge, excludeDate = null) {
  const weekDates = getWeekDates(dateStr, challenge.startDate);
  return weekDates.filter(d => {
    if (d === excludeDate) return false; // exclude today (we're recalculating it)
    const entry = logState.entries[d];
    return entry?.workout?.done === 'yes';
  }).length;
}

// ============================================================
//  GET GOAL FOR METRIC (public interface used by render + calc)
// ============================================================
function getGoalForMetric(metric, challenge, dateStr) {
  if (metric === 'macros') return null;
  if (challenge.mode === 'classic') {
    const defaults = { workout: 5, steps: 8000, sleep: 8, water: 10 };
    return defaults[metric] || null;
  }
  // Dynamic mode — use progression engine
  return getDynamicGoal(metric, dateStr, challenge);
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

      const weeklyGoal = goal || 3;

      // Count workouts already logged this week (excluding today so editing works)
      const workoutsAlreadyThisWeek = getWorkoutsThisWeek(dateStr, c, dateStr);
      const weeklyPtsAlreadyEarned  = workoutsAlreadyThisWeek * Math.round((10 / weeklyGoal) * 100) / 100;
      const weeklyPtsCap            = 10;

      let pts;
      if (mode === 'classic') {
        // Classic: fixed points per workout, capped at weeklyGoal workouts
        const alreadyDoneThisWeek = workoutsAlreadyThisWeek;
        if (alreadyDoneThisWeek >= weeklyGoal) {
          results.workout = { pts: 0, note: `Weekly cap reached (${weeklyGoal} workouts) — no more points this week` };
          continue;
        }
        pts = c.classicPoints?.workout ?? 2;
      } else {
        // Dynamic: pts = 10 / weeklyGoal, capped so total never exceeds 10 pts/week
        const ptsPerWorkout = Math.round((10 / weeklyGoal) * 100) / 100;
        const remainingPts  = Math.max(0, Math.round((weeklyPtsCap - weeklyPtsAlreadyEarned) * 100) / 100);

        if (remainingPts <= 0) {
          results.workout = { pts: 0, note: `Weekly points cap reached (${weeklyPtsCap} pts) — no more workout points this week` };
          continue;
        }
        // Award full points or remaining — whichever is less
        pts = Math.min(ptsPerWorkout, remainingPts);
        pts = Math.round(pts * 100) / 100;
      }

      const typeLabel = logState.workoutType
        ? { strength: 'Strength', running: 'Running Sport', nonrunning: 'Non-Running Sport' }[logState.workoutType] || logState.workoutType
        : 'type not set';
      results.workout = { pts, note: `${typeLabel} — ${workoutsAlreadyThisWeek + 1}/${weeklyGoal} workouts this week` };
      total += pts;

    } else if (metric === 'steps') {
      const steps = parseInt(document.getElementById('log_steps')?.value) || 0;
      if (!steps) { results.steps = { pts: 0, note: 'No steps entered' }; continue; }

      // Running sport modifier: step goal × 1.5
      const isRunning     = logState.workoutType === 'running';
      const effectiveGoal = isRunning ? Math.round((goal || 8000) * 1.5) : (goal || 8000);
      const hit           = steps >= effectiveGoal;

      let pts = 0;
      if (hit) pts = mode === 'classic' ? (c.classicPoints?.steps ?? 1.5) : 1.5;

      results.steps = {
        pts,
        note: hit
          ? `${steps.toLocaleString()} steps ✅ (goal: ${effectiveGoal.toLocaleString()}${isRunning ? ' · running ×1.5' : ''})`
          : `${steps.toLocaleString()} steps ❌ (goal: ${effectiveGoal.toLocaleString()}${isRunning ? ' · running ×1.5' : ''})`
      };
      total += pts;

    } else if (metric === 'sleep') {
      const hours = parseFloat(document.getElementById('log_sleep')?.value) || 0;
      if (!hours) { results.sleep = { pts: 0, note: 'No sleep logged' }; continue; }
      const sleepGoal = goal || 8;
      const hit = hours >= sleepGoal;
      let pts = 0;
      if (hit) pts = mode === 'classic' ? (c.classicPoints?.sleep ?? 1) : 1;
      results.sleep = { pts, note: hit ? `${hours}h ✅ (goal: ${sleepGoal}h)` : `${hours}h ❌ (goal: ${sleepGoal}h)` };
      total += pts;

    } else if (metric === 'water') {
      const cups = parseInt(document.getElementById('log_water')?.value) || 0;
      if (!cups) { results.water = { pts: 0, note: 'No water logged' }; continue; }
      const waterGoal = goal || 10;
      const hit = cups >= waterGoal;
      let pts = 0;
      if (hit) pts = mode === 'classic' ? (c.classicPoints?.water ?? 1) : 1;
      results.water = { pts, note: hit ? `${cups} cups ✅ (goal: ${waterGoal})` : `${cups} cups ❌ (goal: ${waterGoal})` };
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

// ============================================================
//  ANALYTICS — Phase 3
// ============================================================

// Chart instances (tracked so we can destroy before re-render)
const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

// Analytics tab switching — shared function used by both tab buttons and dropdown
function switchAnalyticsTab(tabName) {
  document.querySelectorAll('[data-atab]').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.atab-content').forEach(c => c.classList.remove('active'));
  const tabBtn = document.querySelector(`[data-atab="${tabName}"]`);
  if (tabBtn) tabBtn.classList.add('active');
  document.getElementById(`atab-${tabName}`)?.classList.add('active');
  // Keep dropdown in sync
  const sel = document.getElementById('analyticsTabSelect');
  if (sel) sel.value = tabName;
  const cid = document.getElementById('analyticsChallengeSelect').value;
  if (cid) renderAnalyticsTab(tabName, cid);
}

// Desktop tab buttons
document.querySelectorAll('[data-atab]').forEach(tab => {
  tab.addEventListener('click', () => switchAnalyticsTab(tab.dataset.atab));
});

// Mobile dropdown
document.getElementById('analyticsTabSelect')?.addEventListener('change', (e) => {
  switchAnalyticsTab(e.target.value);
});

// Progress toggle (me vs all)
document.querySelectorAll('#progressToggle .atoggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#progressToggle .atoggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cid = document.getElementById('analyticsChallengeSelect').value;
    if (cid) renderProgressCharts(cid, btn.dataset.view);
  });
});

// Breakdown toggle
document.querySelectorAll('#breakdownToggle .atoggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#breakdownToggle .atoggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cid = document.getElementById('analyticsChallengeSelect').value;
    if (cid) renderBreakdown(cid, btn.dataset.view);
  });
});

// Challenge selector
document.getElementById('analyticsChallengeSelect').addEventListener('change', async (e) => {
  const cid = e.target.value;
  const container = document.getElementById('analyticsContainer');
  if (!cid) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const activeTab = document.querySelector('[data-atab].active')?.dataset.atab || 'leaderboard';
  await renderAnalyticsTab(activeTab, cid);
});

async function populateAnalyticsSelector() {
  const select = document.getElementById('analyticsChallengeSelect');
  const prev   = select.value;
  select.innerHTML = '<option value="">— Choose a challenge —</option>';
  const allSnap = await getDocs(collection(db, 'challenges'));
  const now = new Date();
  const activeOpts = [], endedOpts = [];
  allSnap.forEach(d => {
    const data = d.data();
    const isMember = (data.participants || []).some(p => p.uid === currentUser.uid);
    if (!isMember) return;
    const opt = document.createElement('option');
    opt.value = d.id;
    if (new Date(data.endDate) < now) {
      opt.textContent = `${data.name} (Ended)`;
      endedOpts.push(opt);
    } else {
      opt.textContent = data.name;
      activeOpts.push(opt);
    }
  });
  // Active first, then ended
  if (activeOpts.length > 0) {
    const grp = document.createElement('optgroup');
    grp.label = 'Active';
    activeOpts.forEach(o => grp.appendChild(o));
    select.appendChild(grp);
  }
  if (endedOpts.length > 0) {
    const grp = document.createElement('optgroup');
    grp.label = 'Past Challenges';
    endedOpts.forEach(o => grp.appendChild(o));
    select.appendChild(grp);
  }
  if (prev && [...select.options].some(o => o.value === prev)) {
    select.value = prev;
    document.getElementById('analyticsContainer').style.display = 'block';
    const activeTab = document.querySelector('[data-atab].active')?.dataset.atab || 'leaderboard';
    await renderAnalyticsTab(activeTab, prev);
  }
}

async function renderAnalyticsTab(tab, challengeId) {
  if (tab === 'leaderboard') await renderLeaderboard(challengeId);
  if (tab === 'progress')    await renderProgressCharts(challengeId, document.querySelector('#progressToggle .atoggle-btn.active')?.dataset.view || 'me');
  if (tab === 'group')       await renderGroupCharts(challengeId);
  if (tab === 'breakdown')   await renderBreakdown(challengeId, document.querySelector('#breakdownToggle .atoggle-btn.active')?.dataset.view || 'me');
  if (tab === 'history')     await renderHistory();
}

// ---- DATA FETCHER ----
async function fetchChallengeData(challengeId) {
  const cSnap = await getDoc(doc(db, 'challenges', challengeId));
  if (!cSnap.exists()) return null;
  const challenge = { id: cSnap.id, ...cSnap.data() };

  const logsSnap = await getDocs(
    query(collection(db, 'activityLogs'), where('challengeId', '==', challengeId))
  );
  const logs = [];
  logsSnap.forEach(d => logs.push({ id: d.id, ...d.data() }));
  return { challenge, logs };
}

// ---- HELPERS ----
function getWeekLabel(dateStr, startDate) {
  const start = new Date(startDate + 'T00:00:00');
  const date  = new Date(dateStr  + 'T00:00:00');
  const diff  = Math.floor((date - start) / (7 * 86400000));
  return `Week ${diff + 1}`;
}

function getDisplayName(participant) {
  return participant.nickname || participant.name?.split(' ')[0] || 'Unknown';
}

function calcStreak(logs, userId) {
  const userLogs = logs.filter(l => l.userId === userId);
  const dates = [...new Set(userLogs.map(l => l.date))].sort().reverse();
  if (dates.length === 0) return 0;
  let streak = 0;
  const today = toDateStr(new Date());
  let check   = today;
  for (const d of dates) {
    if (d === check) { streak++; const dt = new Date(check + 'T00:00:00'); dt.setDate(dt.getDate()-1); check = toDateStr(dt); }
    else break;
  }
  return streak;
}

// Color palette for charts
const CHART_COLORS = ['#00e5a0','#7c6dfa','#ffb347','#ff4d6d','#38bdf8','#a78bfa','#34d399','#f472b6'];

// ---- LEADERBOARD ----
async function renderLeaderboard(challengeId) {
  const data = await fetchChallengeData(challengeId);
  if (!data) return;
  const { challenge, logs } = data;
  const el = document.getElementById('leaderboardContent');

  // Aggregate points per user
  const userPoints = {};
  const userDays   = {};
  logs.forEach(l => {
    if (!userPoints[l.userId]) { userPoints[l.userId] = 0; userDays[l.userId] = new Set(); }
    userPoints[l.userId] += l.points || 0;
    userDays[l.userId].add(l.date);
  });

  // Build ranked list from participants
  const ranked = (challenge.participants || []).map(p => ({
    ...p,
    points: Math.round((userPoints[p.uid] || 0) * 100) / 100,
    days:   (userDays[p.uid] || new Set()).size,
    streak: calcStreak(logs, p.uid),
  })).sort((a, b) => b.points - a.points || b.days - a.days);

  const rankEmoji = ['🥇','🥈','🥉'];
  const p = calcPayout(challenge.wager, ranked.length, challenge.payout?.firstSplitPct ?? 65);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;">${challenge.name}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px;">${ranked.length} participants · $${p.total} pot</div>
      </div>
      <div style="display:flex;gap:12px;">
        <div style="text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 18px;">
          <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#FFD700;">$${p.first}</div>
          <div style="font-size:11px;color:var(--text3);">🥇 1st Place</div>
        </div>
        <div style="text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 18px;">
          <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#C0C0C0;">$${p.second}</div>
          <div style="font-size:11px;color:var(--text3);">🥈 2nd Place</div>
        </div>
        <div style="text-align:center;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 18px;">
          <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#CD7F32;">$${p.third}</div>
          <div style="font-size:11px;color:var(--text3);">🥉 3rd Place</div>
        </div>
      </div>
    </div>

    <div class="leaderboard-header">
      <div>Rank</div><div>Participant</div><div style="text-align:right;">Streak</div>
      <div style="text-align:right;">Days</div><div style="text-align:right;">Points</div>
    </div>

    ${ranked.map((p, i) => {
      const isMe = p.uid === currentUser.uid;
      const rankCls = i < 3 ? `rank-${i+1}` : '';
      const avatarHtml = p.photo
        ? `<img src="${p.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">`
        : `<div class="lb-avatar">${(getDisplayName(p))[0].toUpperCase()}</div>`;
      return `
        <div class="leaderboard-row ${rankCls} ${isMe ? 'is-me' : ''}">
          <div class="lb-rank">${rankEmoji[i] || i+1}</div>
          <div class="lb-user">
            ${avatarHtml}
            <div>
              <div class="lb-name">${escHtml(getDisplayName(p))}${isMe ? '<span class="lb-you">YOU</span>' : ''}</div>
            </div>
          </div>
          <div class="lb-streak" style="text-align:right;">${p.streak > 0 ? `<span class="streak-badge">🔥 ${p.streak}</span>` : '—'}</div>
          <div class="lb-days" style="text-align:right;">${p.days} days</div>
          <div class="lb-pts">${p.points}</div>
        </div>`;
    }).join('')}`;
}

// ---- PROGRESS CHARTS ----
async function renderProgressCharts(challengeId, view) {
  const data = await fetchChallengeData(challengeId);
  if (!data) return;
  const { challenge, logs } = data;

  const start    = challenge.startDate;
  const allDates = [...new Set(logs.map(l => l.date))].sort();
  const weeks    = [...new Set(allDates.map(d => getWeekLabel(d, start)))];

  destroyChart('weeklyBar');
  destroyChart('cumulativeLine');

  const ctxBar  = document.getElementById('weeklyBarChart').getContext('2d');
  const ctxLine = document.getElementById('cumulativeLineChart').getContext('2d');
  const isDark  = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#8b90a8' : '#5a6070';

  const chartDefaults = {
    responsive: true,
    plugins: { legend: { labels: { color: textColor, font: { family: 'DM Sans' } } } },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: textColor } },
      y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
    }
  };

  if (view === 'me') {
    const myLogs = logs.filter(l => l.userId === currentUser.uid);
    const weeklyPts = weeks.map(w => myLogs.filter(l => getWeekLabel(l.date, start) === w).reduce((s, l) => s + (l.points||0), 0));
    const cumulative = weeklyPts.reduce((acc, v, i) => { acc.push((acc[i-1] || 0) + v); return acc; }, []);

    chartInstances.weeklyBar = new Chart(ctxBar, {
      type: 'bar',
      data: { labels: weeks, datasets: [{ label: 'My Points', data: weeklyPts, backgroundColor: '#00e5a0', borderRadius: 6 }] },
      options: chartDefaults
    });
    chartInstances.cumulativeLine = new Chart(ctxLine, {
      type: 'line',
      data: { labels: weeks, datasets: [{ label: 'My Cumulative Points', data: cumulative, borderColor: '#00e5a0', backgroundColor: 'rgba(0,229,160,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#00e5a0' }] },
      options: chartDefaults
    });
  } else {
    // All participants
    const participants = challenge.participants || [];
    const barDatasets = participants.map((p, i) => ({
      label: getDisplayName(p),
      data: weeks.map(w => logs.filter(l => l.userId === p.uid && getWeekLabel(l.date, start) === w).reduce((s, l) => s + (l.points||0), 0)),
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
      borderRadius: 4,
    }));
    const lineDatasets = participants.map((p, i) => {
      const weeklyP = weeks.map(w => logs.filter(l => l.userId === p.uid && getWeekLabel(l.date, start) === w).reduce((s, l) => s + (l.points||0), 0));
      const cum = weeklyP.reduce((acc, v, j) => { acc.push((acc[j-1] || 0) + v); return acc; }, []);
      return { label: getDisplayName(p), data: cum, borderColor: CHART_COLORS[i % CHART_COLORS.length], backgroundColor: 'transparent', tension: 0.4, pointBackgroundColor: CHART_COLORS[i % CHART_COLORS.length] };
    });
    chartInstances.weeklyBar = new Chart(ctxBar, {
      type: 'bar',
      data: { labels: weeks, datasets: barDatasets },
      options: { ...chartDefaults, plugins: { ...chartDefaults.plugins } }
    });
    chartInstances.cumulativeLine = new Chart(ctxLine, {
      type: 'line',
      data: { labels: weeks, datasets: lineDatasets },
      options: chartDefaults
    });
  }
}

// ---- GROUP CHARTS ----
async function renderGroupCharts(challengeId) {
  const data = await fetchChallengeData(challengeId);
  if (!data) return;
  const { challenge, logs } = data;
  const start = challenge.startDate;
  const weeks = [...new Set(logs.map(l => getWeekLabel(l.date, start)))].sort((a,b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));

  destroyChart('groupBar');
  destroyChart('groupLine');

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#8b90a8' : '#5a6070';
  const chartDefaults = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { color: gridColor }, ticks: { color: textColor } }, y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true } }
  };

  const groupWeekly = weeks.map(w => logs.filter(l => getWeekLabel(l.date, start) === w).reduce((s, l) => s + (l.points||0), 0));
  const groupCum    = groupWeekly.reduce((acc, v, i) => { acc.push((acc[i-1] || 0) + v); return acc; }, []);

  chartInstances.groupBar = new Chart(document.getElementById('groupBarChart').getContext('2d'), {
    type: 'bar',
    data: { labels: weeks, datasets: [{ label: 'Group Points', data: groupWeekly, backgroundColor: '#7c6dfa', borderRadius: 6 }] },
    options: chartDefaults
  });
  chartInstances.groupLine = new Chart(document.getElementById('groupLineChart').getContext('2d'), {
    type: 'line',
    data: { labels: weeks, datasets: [{ label: 'Group Cumulative', data: groupCum, borderColor: '#7c6dfa', backgroundColor: 'rgba(124,109,250,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#7c6dfa' }] },
    options: chartDefaults
  });
}

// ---- BREAKDOWN ----
async function renderBreakdown(challengeId, view) {
  const data = await fetchChallengeData(challengeId);
  if (!data) return;
  const { challenge, logs } = data;
  const metrics = challenge.metrics || ['workout','steps'];
  const el = document.getElementById('breakdownContent');

  // Destroy old breakdown charts
  Object.keys(chartInstances).filter(k => k.startsWith('donut_')).forEach(k => destroyChart(k));

  const participants = view === 'me'
    ? (challenge.participants || []).filter(p => p.uid === currentUser.uid)
    : (challenge.participants || []);

  el.innerHTML = `<div class="breakdown-grid" id="breakdownGrid"></div>`;
  const grid = document.getElementById('breakdownGrid');

  participants.forEach((p, idx) => {
    const userLogs = logs.filter(l => l.userId === p.uid);
    const metricCounts = {};
    const metricPoints = {};

    metrics.forEach(m => { metricCounts[m] = 0; metricPoints[m] = 0; });
    userLogs.forEach(l => {
      if (metrics.includes('workout') && l.workout?.done === 'yes') metricCounts.workout++;
      if (metrics.includes('steps')   && (l.steps || 0) > 0)       metricCounts.steps++;
      if (metrics.includes('sleep')   && (l.sleep || 0) > 0)       metricCounts.sleep++;
      if (metrics.includes('water')   && (l.water || 0) > 0)       metricCounts.water++;
      if (metrics.includes('macros')  && (l.macros?.calories || 0) > 0) metricCounts.macros++;
    });

    const canvasId = `donut_${p.uid.slice(0,8)}`;
    const card = document.createElement('div');
    card.className = 'breakdown-card';
    const avatarHtml = p.photo
      ? `<img src="${p.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#000;">${getDisplayName(p)[0].toUpperCase()}</div>`;
    card.innerHTML = `
      <div class="breakdown-card-name">${avatarHtml}${escHtml(getDisplayName(p))}${p.uid === currentUser.uid ? ' <span style="font-size:10px;color:var(--accent);">YOU</span>' : ''}</div>
      <div class="breakdown-chart-wrap"><canvas id="${canvasId}"></canvas></div>
      <div class="breakdown-metric-list">
        ${metrics.map(m => `
          <div class="breakdown-metric-row">
            <span>${METRIC_DEFS[m].icon} ${METRIC_DEFS[m].label}</span>
            <span class="breakdown-metric-val">${metricCounts[m]} days</span>
          </div>`).join('')}
      </div>`;
    grid.appendChild(card);

    // Render donut chart
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#8b90a8' : '#5a6070';
    const chartData = metrics.map(m => metricCounts[m]);
    const hasData   = chartData.some(v => v > 0);

    chartInstances[canvasId] = new Chart(document.getElementById(canvasId).getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: metrics.map(m => METRIC_DEFS[m].label),
        datasets: [{
          data: hasData ? chartData : metrics.map(() => 1),
          backgroundColor: hasData ? metrics.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) : ['rgba(255,255,255,0.05)'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { position: 'right', labels: { color: textColor, font: { family: 'DM Sans', size: 11 }, boxWidth: 12, padding: 8 } },
          tooltip: { enabled: hasData }
        },
        cutout: '65%'
      }
    });
  });
}

// ============================================================
//  HISTORY — Past Challenge Stats
// ============================================================
async function renderHistory() {
  const el  = document.getElementById('historyContent');
  el.innerHTML = '<div style="color:var(--text2);padding:20px;">Loading history...</div>';

  try {
    const allSnap = await getDocs(collection(db, 'challenges'));
    const now     = new Date();
    const past    = [];

    allSnap.forEach(d => {
      const data = d.data();
      const isMember = (data.participants || []).some(p => p.uid === currentUser.uid);
      if (isMember && new Date(data.endDate) < now) past.push({ id: d.id, ...data });
    });

    if (past.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span>🕘</span>
          <p>No past challenges yet.<br/>Completed challenges will appear here.</p>
        </div>`;
      return;
    }

    // Sort by most recently ended first
    past.sort((a, b) => new Date(b.endDate) - new Date(a.endDate));

    // Fetch logs for all past challenges at once
    const html = await Promise.all(past.map(async (c) => {
      const logsSnap = await getDocs(
        query(collection(db, 'activityLogs'), where('challengeId', '==', c.id))
      );
      const logs = [];
      logsSnap.forEach(d => logs.push(d.data()));

      // Aggregate per user
      const userPoints = {};
      const userDays   = {};
      logs.forEach(l => {
        userPoints[l.userId] = (userPoints[l.userId] || 0) + (l.points || 0);
        if (!userDays[l.userId]) userDays[l.userId] = new Set();
        userDays[l.userId].add(l.date);
      });

      // Rank participants
      const ranked = (c.participants || [])
        .map(p => ({
          ...p,
          points: Math.round((userPoints[p.uid] || 0) * 100) / 100,
          days:   (userDays[p.uid] || new Set()).size,
        }))
        .sort((a, b) => b.points - a.points || b.days - a.days);

      const me     = ranked.find(p => p.uid === currentUser.uid);
      const myRank = ranked.indexOf(me) + 1;
      const splitPct = c.payout?.firstSplitPct ?? 65;
      const payout   = calcPayout(c.wager, ranked.length, splitPct);
      const rankEmoji = ['🥇','🥈','🥉'];
      const totalDays = Math.ceil((new Date(c.endDate) - new Date(c.startDate)) / 86400000);
      const myPct     = totalDays > 0 ? Math.round((me?.days || 0) / totalDays * 100) : 0;

      return `
        <div class="history-card">
          <div class="history-card-header">
            <div>
              <div class="history-card-title">${escHtml(c.name)}</div>
              <div class="history-card-dates">${formatDate(c.startDate)} → ${formatDate(c.endDate)}</div>
            </div>
            <span class="badge badge-ended">✅ Ended</span>
          </div>

          <!-- My result summary -->
          <div class="history-my-result">
            <div class="history-result-item">
              <div class="history-result-value">${rankEmoji[myRank-1] || '#' + myRank}</div>
              <div class="history-result-label">Final Rank</div>
            </div>
            <div class="history-result-item">
              <div class="history-result-value" style="color:var(--accent);">${me?.points || 0}</div>
              <div class="history-result-label">Points</div>
            </div>
            <div class="history-result-item">
              <div class="history-result-value">${me?.days || 0}</div>
              <div class="history-result-label">Days Logged</div>
            </div>
            <div class="history-result-item">
              <div class="history-result-value">${myPct}%</div>
              <div class="history-result-label">Consistency</div>
            </div>
          </div>

          <!-- Final leaderboard -->
          <div style="margin-top:16px;">
            <div style="font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">Final Standings</div>
            ${ranked.map((p, i) => {
              const isMe = p.uid === currentUser.uid;
              const payoutAmt = i === 0 ? payout.first : i === 1 ? payout.second : i === 2 ? payout.third : null;
              return `
                <div class="history-lb-row ${isMe ? 'history-lb-me' : ''}">
                  <span class="history-lb-rank">${rankEmoji[i] || i+1}</span>
                  <span class="history-lb-name">${escHtml(getDisplayName(p))}${isMe ? ' <span style="font-size:10px;color:var(--accent);font-weight:700;">YOU</span>' : ''}</span>
                  <span class="history-lb-pts">${p.points} pts</span>
                  ${payoutAmt != null ? `<span class="history-lb-payout">$${payoutAmt}</span>` : '<span></span>'}
                </div>`;
            }).join('')}
          </div>

        </div>`;
    }));

    el.innerHTML = html.join('');

  } catch (err) {
    console.error(err);
    el.innerHTML = '<div class="empty-state"><span>⚠️</span><p>Failed to load history.</p></div>';
  }
}
