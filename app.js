// ============================================================
//  FITWAGER — Health Challenge App
//  Phase 1: Login + Challenge Creation
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  arrayUnion,
  query,
  where,
  serverTimestamp
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
//  THEME TOGGLE
// ============================================================
const themeToggle = document.getElementById('themeToggle');
const themeIcon   = themeToggle.querySelector('.theme-icon');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('fw-theme', theme);
}

// Load saved theme
const savedTheme = localStorage.getItem('fw-theme') || 'dark';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// ============================================================
//  SCREEN HELPERS
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');
  const link = document.querySelector(`.nav-link[data-page="${name}"]`);
  if (link) link.classList.add('active');
}
window.showPage = showPage;

// ============================================================
//  AUTH
// ============================================================
let currentUser = null;

document.getElementById('googleSignInBtn').addEventListener('click', async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error('Sign in error:', err);
    alert('Sign in failed. Please try again.');
  }
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await signOut(auth);
});

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
//  NAV LINKS
// ============================================================
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showPage(link.dataset.page);
  });
});

// ============================================================
//  TABS
// ============================================================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// ============================================================
//  PAYOUT CALCULATOR
//  Rules:
//   - 3rd place always gets their wager back (fixed)
//   - Remaining pot = total - wager
//   - 1st and 2nd split the remaining by admin-set percentage
//   - Payouts update live as participants join
// ============================================================

// Default 1st/2nd split: 65% / 35% of remaining pot
let firstSplitPct = 65;

function calcPayout(wager, participants, firstPct = firstSplitPct) {
  const secondPct  = 100 - firstPct;
  const total      = Math.round(wager * participants * 100) / 100;
  const third      = wager; // always breaks even
  const remaining  = Math.round((total - third) * 100) / 100;
  const first      = Math.round(remaining * (firstPct / 100) * 100) / 100;
  const second     = Math.round((remaining - first) * 100) / 100;
  return { total, remaining, first, second, third, firstPct, secondPct };
}

function updatePayoutPreview() {
  const wager   = parseFloat(document.getElementById('challengeWager').value) || 0;
  const preview = document.getElementById('payoutPreview');

  if (!wager || wager <= 0) {
    preview.innerHTML = '<span style="color:var(--text3)">Enter wager amount to see payout breakdown</span>';
    return;
  }

  // Show live preview for a range of participant counts
  const counts  = [2, 3, 4, 5, 6];
  const current = firstSplitPct;
  const second  = 100 - current;

  // Build rows for each participant count
  const rows = counts.map(n => {
    const p = calcPayout(wager, n, current);
    return `
      <tr style="border-bottom:1px solid var(--border);">
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
        <span style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.06em;">
          1st / 2nd Split of Remaining Pot
        </span>
        <button type="button" id="resetSplitBtn"
          style="font-size:11px;color:var(--accent2);background:none;border:none;cursor:pointer;padding:0;">
          Reset to 65/35
        </button>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:13px;color:var(--text2);">🥇 1st</span>
        <input type="range" id="splitSlider" min="50" max="90" step="5"
          value="${current}"
          style="flex:1;accent-color:var(--accent);cursor:pointer;"/>
        <span style="font-size:13px;color:var(--text2);">🥈 2nd</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;">
        <span style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--accent);">${current}%</span>
        <span style="font-size:11px;color:var(--text3);align-self:center;">of remaining after 3rd</span>
        <span style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--accent2);">${second}%</span>
      </div>
    </div>

    <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">
      🥉 3rd place always gets <strong style="color:var(--text);">$${wager}</strong> back (their wager) · Payouts update live as people join
    </div>

    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid var(--border);">
            <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Participants</th>
            <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Pot</th>
            <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">🥇 1st</th>
            <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">🥈 2nd</th>
            <th style="padding:6px 8px;text-align:left;font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">🥉 3rd</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  // Slider interaction — update split % live
  document.getElementById('splitSlider')?.addEventListener('input', (e) => {
    firstSplitPct = parseInt(e.target.value);
    updatePayoutPreview();
  });

  // Reset split button
  document.getElementById('resetSplitBtn')?.addEventListener('click', () => {
    firstSplitPct = 65;
    updatePayoutPreview();
  });
}

document.getElementById('challengeWager').addEventListener('input', updatePayoutPreview);

// ============================================================
//  MODE SELECTOR
// ============================================================
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    document.getElementById('challengeMode').value = card.dataset.mode;
  });
});

// ============================================================
//  CREATE CHALLENGE MODAL
// ============================================================
const createModal = document.getElementById('createChallengeModal');

document.getElementById('openCreateChallenge').addEventListener('click', () => {
  createModal.classList.add('active');
  // Set default dates to current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  document.getElementById('challengeStart').value = firstDay;
  document.getElementById('challengeEnd').value   = lastDay;
});

function closeCreateModal() {
  createModal.classList.remove('active');
  document.getElementById('createChallengeForm').reset();
  document.getElementById('payoutPreview').innerHTML = '<span style="color:var(--text3)">Enter wager amount to see payout breakdown</span>';
  firstSplitPct = 65;
  // Reset mode selector
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  document.querySelector('.mode-card[data-mode="dynamic"]').classList.add('active');
  document.getElementById('challengeMode').value = 'dynamic';
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
//  CREATE CHALLENGE — FIRESTORE
// ============================================================
document.getElementById('createChallengeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const name      = document.getElementById('challengeName').value.trim();
  const startDate = document.getElementById('challengeStart').value;
  const endDate   = document.getElementById('challengeEnd').value;
  const wager     = parseFloat(document.getElementById('challengeWager').value);
  const mode      = document.getElementById('challengeMode').value;

  if (!name || !startDate || !endDate || !wager) {
    alert('Please fill in all fields.');
    return;
  }
  if (new Date(startDate) >= new Date(endDate)) {
    alert('End date must be after start date.');
    return;
  }

  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.textContent = 'Creating...';
  submitBtn.disabled = true;

  try {
    const inviteCode = generateCode();

    // Save payout structure as percentages so it scales with any participant count
    const challengeData = {
      name,
      startDate,
      endDate,
      wager,
      mode,
      inviteCode,
      payout: { firstSplitPct: firstSplitPct },
      adminId:   currentUser.uid,
      adminName: currentUser.displayName || currentUser.email,
      participants: [{
        uid:    currentUser.uid,
        name:   currentUser.displayName || currentUser.email,
        email:  currentUser.email,
        photo:  currentUser.photoURL || '',
        role:   'admin',
        joinedAt: new Date().toISOString()
      }],
      createdAt: serverTimestamp(),
      status: 'active'
    };

    const docRef = await addDoc(collection(db, 'challenges'), challengeData);
    console.log('Challenge created:', docRef.id);

    closeCreateModal();
    await loadMyChallenges();
    await loadDashboard();
    showPage('challenges');
    showChallengeDetail(docRef.id, {...challengeData, id: docRef.id});

  } catch (err) {
    console.error('Error creating challenge:', err);
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
    // Get challenges where user is admin
    const adminQ = query(collection(db, 'challenges'), where('adminId', '==', currentUser.uid));
    const adminSnap = await getDocs(adminQ);

    let challenges = [];
    adminSnap.forEach(d => challenges.push({id: d.id, ...d.data()}));

    // Also get challenges where user is a participant (but not admin)
    const allSnap = await getDocs(collection(db, 'challenges'));
    allSnap.forEach(d => {
      const data = d.data();
      if (data.adminId !== currentUser.uid) {
        const isParticipant = (data.participants || []).some(p => p.uid === currentUser.uid);
        if (isParticipant) challenges.push({id: d.id, ...data});
      }
    });

    if (challenges.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span>💪</span>
          <p>No challenges yet. Create your first one!</p>
        </div>`;
      return;
    }

    listEl.innerHTML = challenges.map(c => renderChallengeCard(c)).join('');

    // Attach click handlers
    listEl.querySelectorAll('.challenge-card').forEach(card => {
      card.addEventListener('click', async () => {
        const cid = card.dataset.id;
        const challenge = challenges.find(c => c.id === cid);
        if (challenge) showChallengeDetail(cid, challenge);
      });
    });

  } catch (err) {
    console.error('Error loading challenges:', err);
    listEl.innerHTML = '<div class="empty-state"><span>⚠️</span><p>Failed to load challenges.</p></div>';
  }
}

function renderChallengeCard(c) {
  const isAdmin   = c.adminId === currentUser?.uid;
  const count     = (c.participants || []).length;
  const daysLeft  = Math.max(0, Math.ceil((new Date(c.endDate) - new Date()) / 86400000));
  const modeLabel = c.mode === 'dynamic' ? '⚡ Dynamic' : '📋 Classic';

  return `
    <div class="challenge-card" data-id="${c.id}">
      <div class="challenge-card-name">${escHtml(c.name)}</div>
      <div class="challenge-card-meta">
        <span class="badge badge-accent">${modeLabel}</span>
        ${isAdmin ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-purple">Participant</span>'}
        <span class="badge badge-warn">${daysLeft > 0 ? daysLeft + ' days left' : 'Ended'}</span>
      </div>
      <div style="font-size:13px;color:var(--text2);">
        ${formatDate(c.startDate)} → ${formatDate(c.endDate)}
      </div>
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
    // Collect all challenges this user is part of
    const allSnap = await getDocs(collection(db, 'challenges'));
    let active = 0, totalPoints = 0, bestRank = '—', minDays = Infinity;
    const now = new Date();

    allSnap.forEach(d => {
      const data = d.data();
      const isParticipant = (data.participants || []).some(p => p.uid === currentUser.uid);
      if (!isParticipant) return;

      const end = new Date(data.endDate);
      if (end >= now && data.status === 'active') {
        active++;
        const days = Math.ceil((end - now) / 86400000);
        if (days < minDays) minDays = days;
      }
    });

    document.getElementById('statActiveChallenges').textContent = active;
    document.getElementById('statTotalPoints').textContent = totalPoints || '0';
    document.getElementById('statCurrentRank').textContent = bestRank;
    document.getElementById('statDaysLeft').textContent = minDays === Infinity ? '—' : minDays;

    // Active challenges summary
    const listEl = document.getElementById('activeChallengesList');
    const activeChallenges = [];
    allSnap.forEach(d => {
      const data = d.data();
      const isParticipant = (data.participants || []).some(p => p.uid === currentUser.uid);
      if (isParticipant && new Date(data.endDate) >= now) {
        activeChallenges.push({id: d.id, ...data});
      }
    });

    if (activeChallenges.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span>🏁</span>
          <p>No active challenges yet.<br/>Create one or join via invite!</p>
          <button class="btn-primary" onclick="showPage('challenges')">Browse Challenges</button>
        </div>`;
    } else {
      listEl.innerHTML = activeChallenges.map(c => renderChallengeCard(c)).join('');
      listEl.querySelectorAll('.challenge-card').forEach(card => {
        card.addEventListener('click', async () => {
          const cid = card.dataset.id;
          const challenge = activeChallenges.find(c => c.id === cid);
          if (challenge) showChallengeDetail(cid, challenge);
        });
      });
    }

  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// ============================================================
//  CHALLENGE DETAIL MODAL
// ============================================================
const detailModal = document.getElementById('challengeDetailModal');

document.getElementById('closeDetailModal').addEventListener('click', () => {
  detailModal.classList.remove('active');
});
detailModal.addEventListener('click', (e) => {
  if (e.target === detailModal) detailModal.classList.remove('active');
});

function showChallengeDetail(id, c) {
  const isAdmin     = c.adminId === currentUser?.uid;
  const count       = (c.participants || []).length;
  const splitPct    = c.payout?.firstSplitPct ?? 65;
  const p           = calcPayout(c.wager, count, splitPct);
  const daysLeft    = Math.max(0, Math.ceil((new Date(c.endDate) - new Date()) / 86400000));

  document.getElementById('detailChallengeName').textContent = c.name;

  document.getElementById('challengeDetailBody').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <label>Point System</label>
        <span>${c.mode === 'dynamic' ? '⚡ Dynamic' : '📋 Classic'}</span>
      </div>
      <div class="detail-item">
        <label>Wager</label>
        <span>$${c.wager} per person</span>
      </div>
      <div class="detail-item">
        <label>Start Date</label>
        <span>${formatDate(c.startDate)}</span>
      </div>
      <div class="detail-item">
        <label>End Date</label>
        <span>${formatDate(c.endDate)}</span>
      </div>
      <div class="detail-item">
        <label>Days Remaining</label>
        <span>${daysLeft > 0 ? daysLeft + ' days' : 'Ended'}</span>
      </div>
      <div class="detail-item">
        <label>Total Pot</label>
        <span>$${p.total}</span>
      </div>
    </div>

    ${isAdmin ? `
    <div class="invite-box">
      <h4>🔗 Invite Code — Share with participants</h4>
      <div class="invite-code-display">
        <span class="invite-code">${c.inviteCode}</span>
        <button class="btn-copy" onclick="copyCode('${c.inviteCode}')">Copy</button>
      </div>
      <p style="font-size:12px;color:var(--text3);margin-top:8px;">
        Participants go to Challenges → Join via Code and enter this code
      </p>
    </div>` : ''}

    <div style="margin-bottom:12px;">
      <div class="section-title" style="margin-top:0;">Live Payout Breakdown · ${count} participant${count !== 1 ? 's' : ''} · $${p.total} pot</div>
      <div class="payout-preview">
        <div class="payout-row" style="margin-bottom:8px;">
          <span class="payout-place">🥇 1st Place</span>
          <div style="text-align:right;">
            <span class="payout-amount">$${p.first}</span>
            <div style="font-size:11px;color:var(--text3);">${p.firstPct}% of remaining pot</div>
          </div>
        </div>
        <div class="payout-row" style="margin-bottom:8px;">
          <span class="payout-place">🥈 2nd Place</span>
          <div style="text-align:right;">
            <span class="payout-amount">$${p.second}</span>
            <div style="font-size:11px;color:var(--text3);">${p.secondPct}% of remaining pot</div>
          </div>
        </div>
        <div class="payout-row">
          <span class="payout-place">🥉 3rd Place</span>
          <div style="text-align:right;">
            <span class="payout-amount">$${p.third}</span>
            <div style="font-size:11px;color:var(--text3);">Wager returned (breaks even)</div>
          </div>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);">
          💡 Payout amounts update automatically as more participants join
        </div>
      </div>
    </div>

    <div class="section-title">Participants (${count})</div>
    <div class="participants-list">
      ${(c.participants || []).map(p => `
        <div class="participant-item">
          <div class="participant-avatar">
            ${p.photo
              ? `<img src="${p.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">`
              : escHtml((p.name || '?')[0].toUpperCase())}
          </div>
          <span class="participant-name">${escHtml(p.name || p.email)}</span>
          <span class="participant-role">${p.role === 'admin' ? '👑 Admin' : 'Participant'}</span>
        </div>`).join('')}
    </div>
  `;

  detailModal.classList.add('active');
}

window.copyCode = function(code) {
  navigator.clipboard.writeText(code).then(() => {
    alert(`Invite code "${code}" copied to clipboard!`);
  });
};

// ============================================================
//  JOIN CHALLENGE
// ============================================================
document.getElementById('joinChallengeBtn').addEventListener('click', async () => {
  const code = document.getElementById('inviteCodeInput').value.trim().toUpperCase();
  const msgEl = document.getElementById('joinMessage');

  if (!code || code.length !== 6) {
    msgEl.className = 'join-message error';
    msgEl.textContent = '⚠️ Please enter a valid 6-character invite code.';
    return;
  }

  msgEl.className = 'join-message';
  msgEl.textContent = 'Looking up challenge...';

  try {
    const q = query(collection(db, 'challenges'), where('inviteCode', '==', code));
    const snap = await getDocs(q);

    if (snap.empty) {
      msgEl.className = 'join-message error';
      msgEl.textContent = '❌ No challenge found with that code. Double-check and try again.';
      return;
    }

    const docSnap = snap.docs[0];
    const challenge = docSnap.data();

    // Check if already a participant
    const already = (challenge.participants || []).some(p => p.uid === currentUser.uid);
    if (already) {
      msgEl.className = 'join-message error';
      msgEl.textContent = '✅ You\'re already in this challenge!';
      return;
    }

    // Add user to participants
    await updateDoc(doc(db, 'challenges', docSnap.id), {
      participants: arrayUnion({
        uid:      currentUser.uid,
        name:     currentUser.displayName || currentUser.email,
        email:    currentUser.email,
        photo:    currentUser.photoURL || '',
        role:     'participant',
        joinedAt: new Date().toISOString()
      })
    });

    msgEl.className = 'join-message success';
    msgEl.textContent = `🎉 You've joined "${challenge.name}"!`;
    document.getElementById('inviteCodeInput').value = '';

    await loadMyChallenges();
    await loadDashboard();

  } catch (err) {
    console.error('Join error:', err);
    msgEl.className = 'join-message error';
    msgEl.textContent = '❌ Something went wrong. Please try again.';
  }
});

// ============================================================
//  UTILITIES
// ============================================================
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
