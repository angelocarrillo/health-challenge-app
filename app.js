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
// ============================================================

// 3rd place always = wager (breaks even)
// Remaining pot after 3rd = distributed between 1st and 2nd (~62.5% / 37.5%)
function calcPayout(wager, participants) {
  const total  = Math.round(wager * participants * 100) / 100;
  const third  = wager; // always breaks even
  const remaining = Math.round((total - third) * 100) / 100;
  const first  = Math.round(remaining * 0.625 * 100) / 100;
  const second = Math.round((remaining - first) * 100) / 100;
  return { total, first, second, third };
}

// Track whether user has manually overridden payouts
let payoutOverride = { first: null, second: null, third: null };

function updatePayoutPreview() {
  const wager = parseFloat(document.getElementById('challengeWager').value) || 0;
  const preview = document.getElementById('payoutPreview');

  if (!wager || wager <= 0) {
    preview.innerHTML = '<span style="color:var(--text3)">Enter wager amount to see payout breakdown</span>';
    payoutOverride = { first: null, second: null, third: null };
    return;
  }

  const assumed = 4;
  const p = calcPayout(wager, assumed);

  // Use override values if set, otherwise use calculated defaults
  const firstVal  = payoutOverride.first  ?? p.first;
  const secondVal = payoutOverride.second ?? p.second;
  const thirdVal  = payoutOverride.third  ?? p.third;
  const potVal    = Math.round((firstVal + secondVal + thirdVal) * 100) / 100;
  const warning   = potVal !== p.total
    ? `<div style="color:var(--warn);font-size:11px;margin-top:8px;">
        ⚠️ Custom total $${potVal} differs from pot of $${p.total}
       </div>`
    : '';

  preview.innerHTML = `
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px;">
      Preview based on ${assumed} participants · Total pot:
      <strong style="color:var(--text)">$${p.total}</strong>
    </div>

    <div class="payout-row" style="margin-bottom:10px;align-items:center;">
      <span class="payout-place">🥇 1st Place</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="number" class="input payout-input" id="payoutFirst"
          value="${firstVal}" min="0" step="0.01"
          style="width:90px;padding:6px 10px;text-align:right;"
          placeholder="${p.first}"/>
        <span style="color:var(--text3);font-size:12px;">$</span>
      </div>
    </div>

    <div class="payout-row" style="margin-bottom:10px;align-items:center;">
      <span class="payout-place">🥈 2nd Place</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="number" class="input payout-input" id="payoutSecond"
          value="${secondVal}" min="0" step="0.01"
          style="width:90px;padding:6px 10px;text-align:right;"
          placeholder="${p.second}"/>
        <span style="color:var(--text3);font-size:12px;">$</span>
      </div>
    </div>

    <div class="payout-row" style="align-items:center;">
      <span class="payout-place">🥉 3rd Place</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="number" class="input payout-input" id="payoutThird"
          value="${thirdVal}" min="0" step="0.01"
          style="width:90px;padding:6px 10px;text-align:right;"
          placeholder="${p.third}"/>
        <span style="color:var(--text3);font-size:12px;">$</span>
      </div>
    </div>

    <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:var(--text3);">3rd place defaults to wager amount (breaks even)</span>
      <button type="button" id="resetPayoutBtn"
        style="font-size:11px;color:var(--accent2);background:none;border:none;cursor:pointer;padding:0;">
        Reset to defaults
      </button>
    </div>
    ${warning}
  `;

  // Listen for manual changes to payout inputs
  ['payoutFirst','payoutSecond','payoutThird'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        payoutOverride.first  = parseFloat(document.getElementById('payoutFirst')?.value)  || 0;
        payoutOverride.second = parseFloat(document.getElementById('payoutSecond')?.value) || 0;
        payoutOverride.third  = parseFloat(document.getElementById('payoutThird')?.value)  || 0;
        // Re-render warning only
        const newPot = Math.round((payoutOverride.first + payoutOverride.second + payoutOverride.third) * 100) / 100;
        const warnEl = preview.querySelector('#payoutWarning');
        const warningHtml = newPot !== p.total
          ? `<div id="payoutWarning" style="color:var(--warn);font-size:11px;margin-top:8px;">
              ⚠️ Custom total $${newPot} differs from pot of $${p.total}
             </div>`
          : '';
        // Remove old warning and append new
        const existing = preview.querySelector('#payoutWarning');
        if (existing) existing.remove();
        if (warningHtml) preview.insertAdjacentHTML('beforeend', warningHtml);
      });
    }
  });

  // Reset button
  document.getElementById('resetPayoutBtn')?.addEventListener('click', () => {
    payoutOverride = { first: null, second: null, third: null };
    updatePayoutPreview();
  });
}

document.getElementById('challengeWager').addEventListener('input', () => {
  // Reset overrides when wager changes so defaults recalculate
  payoutOverride = { first: null, second: null, third: null };
  updatePayoutPreview();
});

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
  payoutOverride = { first: null, second: null, third: null };
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

    // Read payout values — custom or calculated defaults
    const defaultP     = calcPayout(wager, 4);
    const payoutFirst  = parseFloat(document.getElementById('payoutFirst')?.value)  || defaultP.first;
    const payoutSecond = parseFloat(document.getElementById('payoutSecond')?.value) || defaultP.second;
    const payoutThird  = parseFloat(document.getElementById('payoutThird')?.value)  || wager;

    const challengeData = {
      name,
      startDate,
      endDate,
      wager,
      mode,
      inviteCode,
      payout: { first: payoutFirst, second: payoutSecond, third: payoutThird },
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
  const isAdmin  = c.adminId === currentUser?.uid;
  const count    = (c.participants || []).length;
  // Use saved custom payout if available, otherwise calculate defaults
  const defaultP = calcPayout(c.wager, count);
  const p = {
    total:  Math.round(c.wager * count * 100) / 100,
    first:  c.payout?.first  ?? defaultP.first,
    second: c.payout?.second ?? defaultP.second,
    third:  c.payout?.third  ?? c.wager,
  };
  const daysLeft = Math.max(0, Math.ceil((new Date(c.endDate) - new Date()) / 86400000));

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
      <div class="section-title" style="margin-top:0;">Payout Breakdown (${count} participants)</div>
      <div class="payout-preview">
        <div class="payout-row"><span class="payout-place">🥇 1st Place</span><span class="payout-amount">$${p.first}</span></div>
        <div class="payout-row"><span class="payout-place">🥈 2nd Place</span><span class="payout-amount">$${p.second}</span></div>
        <div class="payout-row"><span class="payout-place">🥉 3rd Place</span><span class="payout-amount">$${p.third}</span></div>
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
