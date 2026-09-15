import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app=initializeApp(firebaseConfig),db=getFirestore(app),scoresRef=collection(db,'scores');
const ADMIN_PASSWORD='4550',NORMAL_TIME=300,TEST_TIME=30;
const LETTERS=['a','b','c','d','e','f','g','h'];
const ANGLES=[30,45,60,120,135,150];
let player={studentNo:'',name:''},state=null,timerId=null,locked=false,submitting=false,wrongUnlockTimerId=null;
const $=id=>document.getElementById(id),show=id=>{document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active')};
const shuffle=a=>[...a].sort(()=>Math.random()-.5),pick=a=>a[Math.floor(Math.random()*a.length)];
const ALT={2:4,3:5,4:2,5:3};
const corresponding=p=>p+4;
const wedge=p=>p<4?p:p-4;
const isAcutePos=p=>{const w=wedge(p);return w===1||w===3};

function geometryForTheta(theta){
  const alpha=theta<=90?theta:180-theta;
  const gap=100,centerX=300,rad=alpha*Math.PI/180;
  const shift=gap/Math.tan(rad);
  const top={x:centerX+shift/2,y:105};
  const bottom={x:centerX-shift/2,y:205};
  const dx=top.x-bottom.x,dy=top.y-bottom.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,ext=115;
  return{theta,alpha,top,bottom,transversal:{x1:bottom.x-ux*ext,y1:bottom.y-uy*ext,x2:top.x+ux*ext,y2:top.y+uy*ext}};
}
const WEDGE_RANGES=alpha=>[[-180,-alpha],[-alpha,0],[0,180-alpha],[180-alpha,180]];
function arcPath(cx,cy,w,r,alpha){
  const [a1,a2]=WEDGE_RANGES(alpha)[w],rad=d=>d*Math.PI/180;
  const x1=cx+r*Math.cos(rad(a1)),y1=cy+r*Math.sin(rad(a1)),x2=cx+r*Math.cos(rad(a2)),y2=cy+r*Math.sin(rad(a2));
  return`M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function labelPoint(cx,cy,w,r,alpha){
  const [a1,a2]=WEDGE_RANGES(alpha)[w],a=((a1+a2)/2)*Math.PI/180;
  return[cx+r*Math.cos(a),cy+r*Math.sin(a)];
}
function baseSvg(g,items,guide=false){
  const fmt=n=>Number(n).toFixed(2);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="평행선과 횡단선으로 이루어진 각도 그림">`;
  s+=`<line x1="35" y1="105" x2="565" y2="105" stroke="#111" stroke-width="5" stroke-linecap="round"/>`;
  s+=`<line x1="35" y1="205" x2="565" y2="205" stroke="#111" stroke-width="5" stroke-linecap="round"/>`;
  s+=`<line x1="${fmt(g.transversal.x1)}" y1="${fmt(g.transversal.y1)}" x2="${fmt(g.transversal.x2)}" y2="${fmt(g.transversal.y2)}" stroke="#111" stroke-width="5" stroke-linecap="round"/>`;
  if(guide){
    s+=`<line x1="35" y1="80" x2="565" y2="80" stroke="#999" stroke-width="1.5" stroke-dasharray="5 5"/>`;
    s+=`<line x1="35" y1="230" x2="565" y2="230" stroke="#999" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  }
  items.forEach(it=>{
    s+=`<path d="${arcPath(it.point.x,it.point.y,it.w,30,g.alpha)}" stroke="#777" stroke-width="2" fill="none"/>`;
    const z=labelPoint(it.point.x,it.point.y,it.w,58,g.alpha);
    s+=`<text x="${fmt(z[0])}" y="${fmt(z[1])}" font-family="system-ui,sans-serif" font-size="21" font-weight="700" fill="#111" text-anchor="middle" dominant-baseline="middle">${it.text}</text>`;
  });
  return s+'</svg>';
}
function diagram(m){
  const g=geometryForTheta(60),items=[];
  for(let i=0;i<4;i++)items.push({point:g.top,w:i,text:m[i]});
  for(let i=0;i<4;i++)items.push({point:g.bottom,w:i,text:m[i+4]});
  return baseSvg(g,items);
}
function sizeDiagram(q){
  const g=geometryForTheta(q.theta);
  return baseSvg(g,[{point:q.targetPoint,w:q.targetPos,text:'a'},{point:q.givenPoint,w:q.givenPos,text:q.givenValue+'°'}],true);
}
function labels(){const x=shuffle(LETTERS),m={};x.forEach((v,i)=>m[i]=v);return m}

// 각 위치의 실제 각 크기(예각/둔각)를 반환한다.
function actualAngle(pos,theta){return isAcutePos(pos)?theta:180-theta}

// 크기 문제의 관계를 '생성 전에' 먼저 결정한다.
// corresponding: 동위각 -> 같은 크기
// alternate: 엇각 -> 같은 크기
// linear: 같은 교점에서 이웃한 각 -> 합이 180도
function makeSizeQuestion(){
  const theta=pick(ANGLES);
  const target=pick([...Array(8).keys()]);
  const relation=pick(['corresponding','alternate','linear']);
  let given;

  if(relation==='corresponding'){
    given=corresponding(target);
  }else if(relation==='alternate'){
    // 엇각은 두 교점 사이의 내부각만 사용한다.
    if(target===2)given=5;
    else if(target===3)given=4;
    else if(target===4)given=3;
    else if(target===5)given=2;
    else return makeSizeQuestion();
  }else{
    // 같은 교점에서 바로 옆 각. 어떤 위치든 정확히 하나의 이웃각을 선택한다.
    given=pick([(target+1)%4,(target+3)%4]);
    if(target>=4)given+=4;
  }

  const g=geometryForTheta(theta);
  const targetPoint=target<4?g.top:g.bottom;
  const givenPoint=given<4?g.top:g.bottom;
  const givenValue=actualAngle(given,theta);
  const answer=actualAngle(target,theta);

  // 생성 검증: 그림에 표시되는 주어진 숫자와 실제 given 위치의 각이 반드시 일치하고,
  // 관계식으로 target의 답이 하나로 결정되는지 확인한다.
  const valid=relation==='linear'
    ? givenValue+answer===180
    : givenValue===answer;
  if(!valid)return makeSizeQuestion();

  return{type:3,text:'각 a의 크기는?',answer:String(answer),theta,targetPoint,givenPoint,targetPos:wedge(target),givenPos:wedge(given),givenValue,relation};
}
function relationType(){
  // 크기 문제 80%. 크기 문제 안에서는 동위각/엇각/이웃한 각을 균형 있게 출제한다.
  return Math.random()<0.80?3:pick([1,2]);
}
function newQuestion(){
  const type=relationType();
  if(type===1){
    const m=labels(),p=+Object.keys(m).find(k=>m[k]==='a');
    return{type,m,answer:m[corresponding(p)],text:'각 a의 동위각은?'};
  }
  if(type===2){
    const m=labels(),p=pick([2,3,4,5]),a=+Object.keys(m).find(k=>m[k]==='a');
    [m[p],m[a]]=[m[a],m[p]];
    return{type,m,answer:m[ALT[p]],text:'각 a의 엇각은?'};
  }
  return makeSizeQuestion();
}
function render(){
  if(!state)return;
  const q=state.q=newQuestion();
  $('questionNo').textContent=state.index+1;
  $('questionType').textContent=q.type===1?'동위각':q.type===2?'엇각':'평행선에서 각의 크기';
  $('questionText').textContent=q.text;
  $('diagram').innerHTML=q.type<3?diagram(q.m):sizeDiagram(q);
  $('answerInput').value='';
  $('answerInput').disabled=locked;
  if(!locked)$('answerInput').focus();
}
function start(test=false){
  if(!test){player.studentNo=$('studentNo').value.trim();player.name=$('studentName').value.trim();if(!player.studentNo||!player.name){$('homeMessage').textContent='학생 번호와 이름을 입력하세요.';return}}
  clearInterval(timerId);if(wrongUnlockTimerId)clearTimeout(wrongUnlockTimerId);state={score:0,correct:0,wrong:0,index:0,test,finished:false};locked=false;submitting=false;show('game');$('score').textContent='0';$('feedback').textContent='';let t=test?TEST_TIME:NORMAL_TIME;$('timer').textContent=t;render();timerId=setInterval(()=>{if(!state)return;t--;$('timer').textContent=t;if(t<=0)end()},1000)
}
function submit(e){
  e.preventDefault();if(!state||state.finished||locked||submitting)return;submitting=true;
  const s=state,q=s.q,answer=$('answerInput').value.trim().toLowerCase(),ok=answer===String(q.answer).toLowerCase();
  if(ok){s.score++;s.correct++;s.index++;$('score').textContent=s.score;$('feedback').textContent='정답! +1점';submitting=false;render();return}
  s.score-=2;s.wrong++;$('score').textContent=s.score;$('feedback').textContent='오답! -2점 · 3초 동안 입력할 수 없습니다.';locked=true;$('answerInput').disabled=true;
  wrongUnlockTimerId=setTimeout(()=>{if(state!==s||s.finished)return;locked=false;submitting=false;s.index++;render()},3000)
}
async function saveScore(x){await addDoc(scoresRef,{studentNo:player.studentNo,name:player.name,score:x.score,correct:x.correct,wrong:x.wrong,mode:'normal',createdAt:Date.now()})}
function escapeHtml(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
async function loadRanking(){try{const q=query(scoresRef,orderBy('score','desc'),limit(5)),snap=await getDocs(q),rows=[];snap.forEach(d=>rows.push(d.data()));$('rankingList').innerHTML=rows.length?rows.map((r,i)=>`<li><span>${i+1}위</span><b>${escapeHtml(r.name??'')}</b><strong>${Number(r.score??0)}점</strong></li>`).join(''):'<li class="empty">아직 기록이 없습니다.</li>';$('rankingStatus').textContent=`최고 점수 TOP ${rows.length}`}catch(e){console.error(e)}}
async function end(){if(!state||state.finished)return;clearInterval(timerId);timerId=null;if(wrongUnlockTimerId)clearTimeout(wrongUnlockTimerId);const x=state;x.finished=true;state=null;locked=false;submitting=false;$('finalScore').textContent=x.score;$('correctCount').textContent=x.correct;$('wrongCount').textContent=x.wrong;if(x.test)$('saveStatus').textContent='테스트 모드: 랭킹에는 저장하지 않습니다.';else try{await saveScore(x);$('saveStatus').textContent='게임 기록이 저장되었습니다.';await loadRanking()}catch(e){console.error(e);$('saveStatus').textContent='기록 저장에 실패했습니다.'}show('result')}
$('startBtn').onclick=()=>start(false);$('testBtn').onclick=()=>start(true);$('answerForm').onsubmit=submit;$('homeBtn').onclick=()=>{show('home');loadRanking()};$('adminBtn').onclick=()=>show('adminLogin');$('adminLoginBtn').onclick=()=>{if($('adminPassword').value===ADMIN_PASSWORD){$('adminPassword').value='';$('adminLoginMessage').textContent='';show('admin')}else $('adminLoginMessage').textContent='비밀번호가 올바르지 않습니다.'};document.querySelectorAll('.backHome').forEach(b=>b.onclick=()=>show('home'));loadRanking();