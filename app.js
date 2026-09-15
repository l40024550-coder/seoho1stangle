import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app=initializeApp(firebaseConfig),db=getFirestore(app),scoresRef=collection(db,'scores');
const ADMIN_PASSWORD='4550',NORMAL_TIME=300,TEST_TIME=30,LETTERS=['a','b','c','d','e','f','g','h'],ANGLES=[30,45,60,120,135,150];
let player={studentNo:'',name:''},state=null,timerId=null,locked=false,submitting=false,wrongUnlockTimerId=null;
const $=id=>document.getElementById(id),show=id=>{document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active')};
const shuffle=a=>[...a].sort(()=>Math.random()-.5),pick=a=>a[Math.floor(Math.random()*a.length)];
const ALT={2:4,3:5,4:2,5:3};
const corresponding=p=>p+4;
const wedge=p=>p<4?p:p-4;

// 새 SVG 구조: 세 직선을 각각 독립된 <line> 요소로 생성한다.
// 위 평행선, 아래 평행선, 횡단선을 절대로 하나의 path로 합치지 않는다.
function geometryForTheta(theta){
  const gap=100,centerX=300,rad=theta*Math.PI/180;
  const shift=gap/Math.tan(rad);
  const top={x:centerX+shift/2,y:105};
  const bottom={x:centerX-shift/2,y:205};
  const dx=top.x-bottom.x,dy=top.y-bottom.y;
  const len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
  const ext=115;
  return{
    theta,
    top,
    bottom,
    transversal:{
      x1:bottom.x-ux*ext,
      y1:bottom.y-uy*ext,
      x2:top.x+ux*ext,
      y2:top.y+uy*ext
    }
  };
}
const WEDGE_RANGES=theta=>[[-180,-theta],[-theta,0],[0,180-theta],[180-theta,180]];
function arcPath(cx,cy,w,r,theta){
  const [a1,a2]=WEDGE_RANGES(theta)[w],rad=d=>d*Math.PI/180;
  const x1=cx+r*Math.cos(rad(a1)),y1=cy+r*Math.sin(rad(a1)),x2=cx+r*Math.cos(rad(a2)),y2=cy+r*Math.sin(rad(a2));
  return`M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function labelPoint(cx,cy,w,r,theta){
  const [a1,a2]=WEDGE_RANGES(theta)[w],a=((a1+a2)/2)*Math.PI/180;
  return[cx+r*Math.cos(a),cy+r*Math.sin(a)];
}
function baseSvg(g,items,guide=false){
  const fmt=n=>Number(n).toFixed(2);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="평행선과 횡단선으로 이루어진 각도 그림">`;
  s+=`<style>
    .parallel{stroke:#111;stroke-width:5;fill:none;stroke-linecap:round}
    .transversal{stroke:#111;stroke-width:5;fill:none;stroke-linecap:round}
    .arc{stroke:#777;stroke-width:2;fill:none}
    .label{font:700 21px system-ui,sans-serif;fill:#111;text-anchor:middle;dominant-baseline:middle}
    .guide{stroke:#999;stroke-width:1.5;stroke-dasharray:5 5;fill:none}
  </style>`;

  // 반드시 서로 다른 SVG line 3개.
  s+=`<line class="parallel" x1="35" y1="105" x2="565" y2="105"/>`;
  s+=`<line class="parallel" x1="35" y1="205" x2="565" y2="205"/>`;
  s+=`<line class="transversal" x1="${fmt(g.transversal.x1)}" y1="${fmt(g.transversal.y1)}" x2="${fmt(g.transversal.x2)}" y2="${fmt(g.transversal.y2)}"/>`;

  if(guide){
    s+=`<line class="guide" x1="35" y1="80" x2="565" y2="80"/>`;
    s+=`<line class="guide" x1="35" y1="230" x2="565" y2="230"/>`;
  }

  items.forEach(it=>{
    s+=`<path class="arc" d="${arcPath(it.point.x,it.point.y,it.w,30,g.theta)}"/>`;
    const z=labelPoint(it.point.x,it.point.y,it.w,58,g.theta);
    s+=`<text class="label" x="${fmt(z[0])}" y="${fmt(z[1])}">${it.text}</text>`;
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
  return baseSvg(g,[{point:q.targetPoint,w:q.targetPos,text:'a'},{point:q.givenPoint,w:q.givenPos,text:q.value+'°'}],true);
}
function labels(){const x=shuffle(LETTERS),m={};x.forEach((v,i)=>m[i]=v);return m}

function newQuestion(){
  const type=1+Math.floor(Math.random()*4);
  if(type===1){
    const m=labels(),p=+Object.keys(m).find(k=>m[k]==='a');
    return{type,m,answer:m[corresponding(p)],text:'각 a의 동위각은?'};
  }
  if(type===2){
    const m=labels(),p=pick([2,3,4,5]),a=+Object.keys(m).find(k=>m[k]==='a');
    [m[p],m[a]]=[m[a],m[p]];
    return{type,m,answer:m[ALT[p]],text:'각 a의 엇각은?'};
  }
  let target,given;
  if(type===3){target=Math.floor(Math.random()*8);given=corresponding(target)}else{target=pick([2,3,4,5]);given=ALT[target]}
  const value=pick(ANGLES),givenPos=wedge(given),valueAcute=value<90,givenAcute=(givenPos===1||givenPos===3);
  const theta=givenAcute===valueAcute?value:180-value;
  const g=geometryForTheta(theta),targetPoint=target<4?g.top:g.bottom,givenPoint=given<4?g.top:g.bottom;
  return{type,answer:String(value),text:'각 a의 크기는?',targetPoint,givenPoint,targetPos:wedge(target),givenPos,value,angle:value,theta};
}
function render(){if(!state)return;const q=state.q=newQuestion();$('questionNo').textContent=state.index+1;$('questionType').textContent=q.type===1?'동위각':q.type===2?'엇각':'평행선에서 각의 크기';$('questionText').textContent=q.text;$('diagram').innerHTML=q.type<3?diagram(q.m):sizeDiagram(q);$('answerInput').value='';$('answerInput').disabled=locked;if(!locked)$('answerInput').focus()}
function start(test=false){
  if(!test){player.studentNo=$('studentNo').value.trim();player.name=$('studentName').value.trim();if(!player.studentNo||!player.name){$('homeMessage').textContent='학생 번호와 이름을 입력하세요.';return}}
  clearInterval(timerId);if(wrongUnlockTimerId)clearTimeout(wrongUnlockTimerId);state={score:0,correct:0,wrong:0,index:0,test,finished:false};locked=false;submitting=false;show('game');$('score').textContent='0';$('feedback').textContent='';let t=test?TEST_TIME:NORMAL_TIME;$('timer').textContent=t;render();timerId=setInterval(()=>{if(!state)return;t--;$('timer').textContent=t;if(t<=0)end()},1000)
}
function submit(e){
  e.preventDefault();if(!state||state.finished||locked||submitting)return;submitting=true;const s=state,q=s.q,answer=$('answerInput').value.trim().toLowerCase(),ok=answer===String(q.answer).toLowerCase();
  if(ok){s.score++;s.correct++;s.index++;$('score').textContent=s.score;$('feedback').textContent='정답! +1점';submitting=false;render();return}
  s.score-=2;s.wrong++;$('score').textContent=s.score;$('feedback').textContent='오답! -2점 · 3초 동안 입력할 수 없습니다.';locked=true;$('answerInput').disabled=true;wrongUnlockTimerId=setTimeout(()=>{if(state!==s||s.finished)return;locked=false;submitting=false;s.index++;render()},3000)
}
async function saveScore(x){await addDoc(scoresRef,{studentNo:player.studentNo,name:player.name,score:x.score,correct:x.correct,wrong:x.wrong,mode:'normal',createdAt:Date.now()})}
function escapeHtml(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
async function loadRanking(){try{const q=query(scoresRef,orderBy('score','desc'),limit(5)),snap=await getDocs(q),rows=[];snap.forEach(d=>rows.push(d.data()));$('rankingList').innerHTML=rows.length?rows.map((r,i)=>`<li><span>${i+1}위</span><b>${escapeHtml(r.name??'')}</b><strong>${Number(r.score??0)}점</strong></li>`).join(''):'<li class="empty">아직 기록이 없습니다.</li>';$('rankingStatus').textContent=`최고 점수 TOP ${rows.length}`}catch(e){console.error(e)}}
async function end(){if(!state||state.finished)return;clearInterval(timerId);timerId=null;if(wrongUnlockTimerId)clearTimeout(wrongUnlockTimerId);const x=state;x.finished=true;state=null;locked=false;submitting=false;$('finalScore').textContent=x.score;$('correctCount').textContent=x.correct;$('wrongCount').textContent=x.wrong;if(x.test)$('saveStatus').textContent='테스트 모드: 랭킹에는 저장하지 않습니다.';else try{await saveScore(x);$('saveStatus').textContent='게임 기록이 저장되었습니다.';await loadRanking()}catch(e){console.error(e);$('saveStatus').textContent='기록 저장에 실패했습니다.'}show('result')}
$('startBtn').onclick=()=>start(false);$('testBtn').onclick=()=>start(true);$('answerForm').onsubmit=submit;$('homeBtn').onclick=()=>{show('home');loadRanking()};$('adminBtn').onclick=()=>show('adminLogin');$('adminLoginBtn').onclick=()=>{if($('adminPassword').value===ADMIN_PASSWORD){$('adminPassword').value='';$('adminLoginMessage').textContent='';show('admin')}else $('adminLoginMessage').textContent='비밀번호가 올바르지 않습니다.'};document.querySelectorAll('.backHome').forEach(b=>b.onclick=()=>show('home'));loadRanking();