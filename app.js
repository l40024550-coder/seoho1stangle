import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const scoresRef = collection(db, 'scores');
const ADMIN_PASSWORD = ['4','5','5','0'].join('');
const NORMAL_TIME = 300;
const TEST_TIME = 30;
const LETTERS = ['a','b','c','d','e','f','g','h'];
const ANGLES = [30,45,60,120,135,150];
let player = {studentNo:'',name:''};
let state = null;
let timerId = null;
let locked = false;
let submitting = false;
let wrongUnlockTimerId = null;
const $ = id => document.getElementById(id);
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');}
function shuffle(a){return [...a].sort(()=>Math.random()-0.5);}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
const TOP={x:393,y:105};
const BOTTOM={x:207,y:205};
const offsets=[[-27,-30],[32,-12],[27,30],[-32,12]];
function correspondingPosition(p){return p+4;}
const ALTERNATE_INTERIOR_MAP={2:4,3:5,4:2,5:3};
function alternateInteriorPosition(p){return ALTERNATE_INTERIOR_MAP[p];}
function labels(){const x=shuffle(LETTERS),m={};x.forEach((v,i)=>m[i]=v);return m;}
function arcPath(cx,cy,index,r=28){const angles=[[-180,-28],[-28,0],[0,152],[152,180]];const [a1,a2]=angles[index];const rad=d=>d*Math.PI/180;const x1=cx+r*Math.cos(rad(a1)),y1=cy+r*Math.sin(rad(a1));const x2=cx+r*Math.cos(rad(a2)),y2=cy+r*Math.sin(rad(a2));const large=Math.abs(a2-a1)>180?1:0;return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;}
function diagram(m){let s=`<svg viewBox="0 0 600 300"><style>.g{stroke:#111827;stroke-width:4;fill:none;stroke-linecap:round}.arc{stroke:#6b7280;stroke-width:2;fill:none}.t{font:700 22px system-ui,sans-serif;fill:#111827;text-anchor:middle;dominant-baseline:middle}</style><path class="g" d="M45 105H555M45 205H555M85 270L515 40"/>`;for(let i=0;i<4;i++)s+=`<path class="arc" d="${arcPath(TOP.x,TOP.y,i)}"/>`;for(let i=0;i<4;i++)s+=`<path class="arc" d="${arcPath(BOTTOM.x,BOTTOM.y,i)}"/>`;for(let i=0;i<4;i++)s+=`<text class="t" x="${TOP.x+offsets[i][0]}" y="${TOP.y+offsets[i][1]}">${m[i]}</text>`;for(let i=0;i<4;i++)s+=`<text class="t" x="${BOTTOM.x+offsets[i][0]}" y="${BOTTOM.y+offsets[i][1]}">${m[i+4]}</text>`;return s+'</svg>';}
function pointForPosition(p){return p<4?TOP:BOTTOM;}
function offsetForPosition(p){return offsets[p<4?p:p-4];}
function sizeDiagram(q){return `<svg viewBox="0 0 600 300"><style>.g{stroke:#111827;stroke-width:4;fill:none;stroke-linecap:round}.d{stroke:#6b7280;stroke-width:1.5;stroke-dasharray:5 5}.arc{stroke:#6b7280;stroke-width:2;fill:none}.t{font:700 21px system-ui,sans-serif;fill:#111827;text-anchor:middle;dominant-baseline:middle}</style><path class="g" d="M45 105H555M45 205H555M85 270L515 40"/><path class="d" d="M45 80H555M45 230H555"/><path class="arc" d="${arcPath(q.targetPoint.x,q.targetPoint.y,q.targetPos)}"/><path class="arc" d="${arcPath(q.givenPoint.x,q.givenPoint.y,q.givenPos)}"/><text class="t" x="${q.targetPoint.x+q.ao[0]}" y="${q.targetPoint.y+q.ao[1]}">a</text><text class="t" x="${q.givenPoint.x+q.go[0]}" y="${q.givenPoint.y+q.go[1]}">${q.value}°</text></svg>`;}
function newQuestion(){const type=1+Math.floor(Math.random()*4);if(type===1){const m=labels(),p=Number(Object.keys(m).find(k=>m[k]==='a'));return{type,m,answer:m[correspondingPosition(p)],text:'각 a의 동위각은?'};}if(type===2){const m=labels(),p=pick([2,3,4,5]),a=Number(Object.keys(m).find(k=>m[k]==='a'));[m[p],m[a]]=[m[a],m[p]];return{type,m,answer:m[alternateInteriorPosition(p)],text:'각 a의 엇각은?'};}let target,given;if(type===3){target=Math.floor(Math.random()*8);given=correspondingPosition(target);}else{target=pick([2,3,4,5]);given=alternateInteriorPosition(target);}const value=pick(ANGLES),targetPoint=pointForPosition(target),givenPoint=pointForPosition(given),ao=offsetForPosition(target),go=offsetForPosition(given);return{type,answer:String(value),text:'각 a의 크기는?',targetPoint,givenPoint,ao,go,value,targetPos:target<4?target:target-4,givenPos:given<4?given:given-4};}
function render(){const q=state.q=newQuestion();$('questionNo').textContent=state.index+1;$('questionType').textContent=q.type===1?'동위각':q.type===2?'엇각':'평행선에서 각의 크기';$('questionText').textContent=q.text;$('diagram').innerHTML=q.type<3?diagram(q.m):sizeDiagram(q);$('answerInput').value='';$('answerInput').disabled=locked;if(!locked)$('answerInput').focus();}
function start(test=false){if(!test){player.studentNo=$('studentNo').value.trim();player.name=$('studentName').value.trim();if(!player.studentNo||!player.name){$('homeMessage').textContent='학생 번호와 이름을 입력하세요.';return;}}if(wrongUnlockTimerId)clearTimeout(wrongUnlockTimerId);state={score:0,correct:0,wrong:0,index:0,test};locked=false;submitting=false;show('game');$('score').textContent='0';$('feedback').textContent='';let t=test?TEST_TIME:NORMAL_TIME;$('timer').textContent=t;render();clearInterval(timerId);timerId=setInterval(()=>{t--;$('timer').textContent=t;if(t<=0)end();},1000);}
function submit(e){e.preventDefault();if(!state||locked||submitting)return;submitting=true;const s=state,q=s.q;if(!q){submitting=false;return;}const answer=$('answerInput').value.trim().toLowerCase(),ok=answer===String(q.answer).trim().toLowerCase();if(ok){s.score++;s.correct++;s.index++;$('score').textContent=s.score;$('feedback').textContent='정답! +1점';submitting=false;render();return;}s.score-=2;s.wrong++;$('score').textContent=s.score;$('feedback').textContent='오답! -2점 · 3초 동안 입력할 수 없습니다.';locked=true;$('answerInput').disabled=true;if(wrongUnlockTimerId)clearTimeout(wrongUnlockTimerId);wrongUnlockTimerId=setTimeout(()=>{wrongUnlockTimerId=null;if(state!==s)return;locked=false;s.index++;submitting=false;render();},3000);}
async function saveScore(x){await addDoc(scoresRef,{studentNo:player.studentNo,name:player.name,score:x.score,correct:x.correct,wrong:x.wrong,mode:'normal',createdAt:Date.now()});}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
async function loadRanking(){$('rankingStatus').textContent='기록을 불러오는 중…';try{const q=query(scoresRef,orderBy('score','desc'),limit(5)),snapshot=await getDocs(q),rows=[];snapshot.forEach(d=>rows.push(d.data()));$('rankingList').innerHTML=rows.length?rows.map((r,i)=>`<li><span>${i+1}위</span><b>${escapeHtml(r.name??'')}</b><strong>${Number(r.score??0)}점</strong></li>`).join(''):'<li class="empty">아직 기록이 없습니다.</li>';$('rankingStatus').textContent=`최고 점수 TOP ${rows.length}`;}catch(error){console.error(error);$('rankingStatus').textContent='랭킹을 불러오지 못했습니다.';$('rankingList').innerHTML='<li class="empty">Firestore 보안 규칙을 확인하세요.</li>';}}
async function end(){if(!state)return;clearInterval(timerId);if(wrongUnlockTimerId)clearTimeout(wrongUnlockTimerId);const x=state;x.finished=true;state=null;locked=false;submitting=false;$('finalScore').textContent=x.score;$('correctCount').textContent=x.correct;$('wrongCount').textContent=x.wrong;if(x.test){$('saveStatus').textContent='테스트 모드: 랭킹에는 저장하지 않습니다.';}else{$('saveStatus').textContent='게임 기록을 저장하는 중…';try{await saveScore(x);$('saveStatus').textContent='게임 기록이 저장되었습니다.';await loadRanking();}catch(error){console.error(error);$('saveStatus').textContent='기록 저장에 실패했습니다. Firestore 보안 규칙을 확인하세요.';}}show('result');}
$('startBtn').onclick=()=>start(false);$('testBtn').onclick=()=>start(true);$('answerForm').onsubmit=submit;$('homeBtn').onclick=()=>{show('home');loadRanking();};$('adminBtn').onclick=()=>show('adminLogin');$('adminLoginBtn').onclick=()=>{if($('adminPassword').value===ADMIN_PASSWORD){$('adminPassword').value='';$('adminLoginMessage').textContent='';show('admin');}else{$('adminLoginMessage').textContent='비밀번호가 올바르지 않습니다.';}};document.querySelectorAll('.backHome').forEach(b=>b.onclick=()=>show('home'));loadRanking();