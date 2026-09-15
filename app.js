import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const scoresRef = collection(db, 'scores');

const ADMIN_PASSWORD = ['4', '5', '5', '0'].join('');
const NORMAL_TIME = 300;
const TEST_TIME = 30;
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ANGLES = [30, 45, 60, 120, 135, 150];

let player = { studentNo: '', name: '' };
let state = null;
let timerId = null;
let locked = false;

const $ = id => document.getElementById(id);

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function shuffle(a) {
  return [...a].sort(() => Math.random() - 0.5);
}

function pick(a) {
  return a[Math.floor(Math.random() * a.length)];
}

// 각 교점 주변의 실제 각 영역: 0 왼쪽 위, 1 오른쪽 위, 2 오른쪽 아래, 3 왼쪽 아래
const offsets = [
  [-30, -18],
  [28, -12],
  [28, 25],
  [-30, 27]
];

function correspondingPosition(p) {
  return p + 4;
}

function alternatePosition(p) {
  const map = { 2: 7, 3: 6, 6: 3, 7: 2 };
  return map[p] ?? ((p + 4) % 8);
}

function labels() {
  const x = shuffle(LETTERS);
  const m = {};
  x.forEach((v, i) => { m[i] = v; });
  return m;
}

function diagram(m) {
  let s = `<svg viewBox="0 0 600 300" role="img" aria-label="두 직선과 횡단선으로 이루어진 각의 그림">
    <style>
      .g{stroke:#111827;stroke-width:4;fill:none;stroke-linecap:round}
      .t{font:700 22px system-ui,sans-serif;fill:#111827}
      .dot{fill:#111827}
    </style>
    <path class="g" d="M45 105H555M45 205H555M85 270L515 40"/>
    <circle class="dot" cx="207" cy="105" r="4"/>
    <circle class="dot" cx="393" cy="205" r="4"/>`;

  for (let i = 0; i < 4; i++) {
    s += `<text class="t" x="${207 + offsets[i][0]}" y="${105 + offsets[i][1]}">${m[i]}</text>`;
  }
  for (let i = 0; i < 4; i++) {
    s += `<text class="t" x="${393 + offsets[i][0]}" y="${205 + offsets[i][1]}">${m[i + 4]}</text>`;
  }

  return s + '</svg>';
}

function sizeDiagram(q) {
  return `<svg viewBox="0 0 600 300" role="img" aria-label="평행선과 횡단선의 각 크기 문제 그림">
    <style>
      .g{stroke:#111827;stroke-width:4;fill:none;stroke-linecap:round}
      .t{font:700 21px system-ui,sans-serif;fill:#111827}
      .d{stroke:#6b7280;stroke-width:1.5;stroke-dasharray:5 5}
      .dot{fill:#111827}
    </style>
    <path class="g" d="M45 105H555M45 205H555M85 270L515 40"/>
    <path class="d" d="M45 80H555M45 230H555"/>
    <circle class="dot" cx="207" cy="105" r="4"/>
    <circle class="dot" cx="393" cy="205" r="4"/>
    <text class="t" x="${207 + q.ao[0]}" y="${105 + q.ao[1]}">a</text>
    <text class="t" x="${393 + q.go[0]}" y="${205 + q.go[1]}">${q.value}°</text>
  </svg>`;
}

function newQuestion() {
  const type = 1 + Math.floor(Math.random() * 4);

  if (type < 3) {
    const m = labels();
    const p = Number(Object.keys(m).find(k => m[k] === 'a'));
    const answer = m[type === 1 ? correspondingPosition(p) : alternatePosition(p)];
    return {
      type,
      m,
      answer,
      text: type === 1 ? '각 a의 동위각은?' : '각 a의 엇각은?'
    };
  }

  let target;
  let given;

  if (type === 3) {
    target = Math.floor(Math.random() * 8);
    given = target + 4;
  } else {
    target = pick([2, 3, 4, 5]);
    given = alternatePosition(target);
  }

  const value = pick(ANGLES);
  const targetOffsets = target < 4 ? offsets[target] : offsets[target - 4];
  const givenOffsets = given < 4 ? offsets[given] : offsets[given - 4];

  return {
    type,
    answer: String(value),
    text: '각 a의 크기는?',
    ao: targetOffsets,
    go: givenOffsets,
    value
  };
}

function render() {
  const q = state.q = newQuestion();
  $('questionNo').textContent = state.index + 1;
  $('questionType').textContent = q.type === 1
    ? '동위각'
    : q.type === 2
      ? '엇각'
      : '평행선에서 각의 크기';
  $('questionText').textContent = q.text;
  $('diagram').innerHTML = q.type < 3 ? diagram(q.m) : sizeDiagram(q);
  $('answerInput').value = '';
  $('answerInput').disabled = locked;
  if (!locked) $('answerInput').focus();
}

function start(test = false) {
  if (!test) {
    player.studentNo = $('studentNo').value.trim();
    player.name = $('studentName').value.trim();
    if (!player.studentNo || !player.name) {
      $('homeMessage').textContent = '학생 번호와 이름을 입력하세요.';
      return;
    }
  }

  state = { score: 0, correct: 0, wrong: 0, index: 0, test };
  locked = false;
  show('game');
  $('score').textContent = '0';
  $('feedback').textContent = '';

  let t = test ? TEST_TIME : NORMAL_TIME;
  $('timer').textContent = t;
  render();

  clearInterval(timerId);
  timerId = setInterval(() => {
    t--;
    $('timer').textContent = t;
    if (t <= 0) end();
  }, 1000);
}

function submit(e) {
  e.preventDefault();
  if (!state || locked) return;

  const answer = $('answerInput').value.trim().toLowerCase();
  const correctAnswer = state.q.answer.toLowerCase();
  const ok = answer === correctAnswer;

  if (ok) {
    state.score++;
    state.correct++;
    $('score').textContent = state.score;
    $('feedback').textContent = '정답! +1점';
    state.index++;
    render();
  } else {
    state.score -= 2;
    state.wrong++;
    $('score').textContent = state.score;
    locked = true;
    $('answerInput').disabled = true;
    $('feedback').textContent = '오답! -2점 · 3초 동안 입력할 수 없습니다.';

    setTimeout(() => {
      if (state) {
        locked = false;
        state.index++;
        render();
      }
    }, 3000);
  }
}

async function saveScore(x) {
  await addDoc(scoresRef, {
    studentNo: player.studentNo,
    name: player.name,
    score: x.score,
    correct: x.correct,
    wrong: x.wrong,
    mode: 'normal',
    createdAt: Date.now()
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadRanking() {
  $('rankingStatus').textContent = '기록을 불러오는 중…';

  try {
    const q = query(scoresRef, orderBy('score', 'desc'), limit(5));
    const snapshot = await getDocs(q);
    const rows = [];

    snapshot.forEach(docSnap => rows.push(docSnap.data()));

    $('rankingList').innerHTML = rows.length
      ? rows.map((r, i) => `<li><span>${i + 1}위</span><b>${escapeHtml(r.name ?? '')}</b><strong>${Number(r.score ?? 0)}점</strong></li>`).join('')
      : '<li class="empty">아직 기록이 없습니다.</li>';

    $('rankingStatus').textContent = `최고 점수 TOP ${rows.length}`;
  } catch (error) {
    console.error(error);
    $('rankingStatus').textContent = '랭킹을 불러오지 못했습니다.';
    $('rankingList').innerHTML = '<li class="empty">Firestore 보안 규칙을 확인하세요.</li>';
  }
}

async function end() {
  if (!state) return;

  clearInterval(timerId);
  const x = state;
  state = null;
  locked = false;

  $('finalScore').textContent = x.score;
  $('correctCount').textContent = x.correct;
  $('wrongCount').textContent = x.wrong;

  if (x.test) {
    $('saveStatus').textContent = '테스트 모드: 랭킹에는 저장하지 않습니다.';
  } else {
    $('saveStatus').textContent = '게임 기록을 저장하는 중…';
    try {
      await saveScore(x);
      $('saveStatus').textContent = '게임 기록이 저장되었습니다.';
      await loadRanking();
    } catch (error) {
      console.error(error);
      $('saveStatus').textContent = '기록 저장에 실패했습니다. Firestore 보안 규칙을 확인하세요.';
    }
  }

  show('result');
}

$('startBtn').onclick = () => start(false);
$('testBtn').onclick = () => start(true);
$('answerForm').onsubmit = submit;
$('homeBtn').onclick = () => {
  show('home');
  loadRanking();
};
$('adminBtn').onclick = () => show('adminLogin');
$('adminLoginBtn').onclick = () => {
  if ($('adminPassword').value === ADMIN_PASSWORD) {
    $('adminPassword').value = '';
    $('adminLoginMessage').textContent = '';
    show('admin');
  } else {
    $('adminLoginMessage').textContent = '비밀번호가 올바르지 않습니다.';
  }
};
document.querySelectorAll('.backHome').forEach(b => b.onclick = () => show('home'));

loadRanking();
