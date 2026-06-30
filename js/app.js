const App = {
  intervals: []
};

function addInterval(fn, ms) {
  const id = setInterval(fn, ms);
  App.intervals.push(id);
  return id;
}

function clearAllIntervals() {
  App.intervals.forEach(clearInterval);
  App.intervals = [];
}



const DAILY_GOAL = 75;
const WEEKLY_GOAL = 600;

let practice =
JSON.parse(localStorage.getItem("practice")) || {

    todayMinutes: 0,
    weekMinutes: 0,

    lastDay: "",
    weekNumber: 0
};
/* ================= STATE ================= */
let repertoire = JSON.parse(localStorage.getItem("cg_rep")) || [];
let aiReports = JSON.parse(localStorage.getItem("aiReports")) || [];
let blocks = JSON.parse(localStorage.getItem("cg_blocks")) || [
{name:"Warm-up",duration:5},
{name:"Technique",duration:10}
];
let lastTickTime = Date.now();
let lastPracticeTick = Date.now();
let sessionAccruedMinutes = 0;
let lastSessionTick = null;
let disciplineChart;
let structureChart;
let improveChart;
let archive = JSON.parse(localStorage.getItem("cg_archive")) || [];
let current=0;
let timeLeft=0;
let blockStartTime = 0;
let currentBlockDuration = 0;
let playing=false;
let interval=null;
let sessionStart=0;
let sessionTotalSeconds = 0;
let xp = Number(localStorage.getItem("xp")) || 0;
let level = Number(localStorage.getItem("level")) || 1;



let streak = Number(localStorage.getItem("streak")) || 0;
let lastSessionDay = localStorage.getItem("lastSessionDay") || null;

let daily = {
  minutes: 0,
  bars: 0,
  focusSessions: 0,
  penalty: false
};

let weekStats = {
  totalBarsPlanned: 0,
  totalBarsDone: 0
};

/* ================= DOM ================= */
const blocksDiv=document.getElementById("blocks");
const timerEl=document.getElementById("timer");
const bar=document.getElementById("bar");
const task=document.getElementById("task");
const globalTime=document.getElementById("globalTime");
const remain=document.getElementById("remain");
const plansList=document.getElementById("plansList");
const sessionBar=document.getElementById("sessionBar");
/* ================= RENDER ================= */
function updateProgressBars(){
  const todayBar = document.getElementById("todayBar");
  const weekBar = document.getElementById("weekBar");
  const todayText = document.getElementById("todayText");
  const weekText = document.getElementById("weekText");

  const todayPercent = Math.min(100, (practice.todayMinutes / DAILY_GOAL) * 100);
  const weekPercent = Math.min(100, (practice.weekMinutes / WEEKLY_GOAL) * 100);

  todayBar.style.width = todayPercent + "%";
  weekBar.style.width = weekPercent + "%";

  todayText.textContent = `${Math.floor(practice.todayMinutes)} / ${DAILY_GOAL} min`;
  weekText.textContent = `${Math.floor(practice.weekMinutes)} / ${WEEKLY_GOAL} min`;
}
function render(){
blocksDiv.innerHTML="";

blocks.forEach((b,i)=>{
blocksDiv.innerHTML+=`
<div class="block">
<input value="${b.name}" onchange="blocks[${i}].name=this.value;persist()">
<input type="number" value="${b.duration}" onchange="blocks[${i}].duration=+this.value;persist()">
<button onclick="removeBlock(${i})">x</button>
</div>`;
});

persist();
}

function addXP(amount) {
  xp = Number(xp) + Number(amount);

  localStorage.setItem("xp", xp);

  syncStats(); // <- KLUCZ
}
function updateLevel(){
  level = Math.floor(xp / 300) + 1;
  return level;
}

function syncStats(){
  updateLevel();

  const xpEl = document.getElementById("xp");
  const levelEl = document.getElementById("level");
  const streakEl = document.getElementById("streak");

  if(xpEl) xpEl.textContent = xp;
  if(levelEl) levelEl.textContent = level;
  if(streakEl) streakEl.textContent = streak;

  localStorage.setItem("xp", xp);
  localStorage.setItem("level", level);
  localStorage.setItem("streak", streak);
}
let disciplineHistory = JSON.parse(localStorage.getItem("disciplineHistory")) || [];

function disciplineEngine(data){

  let score = 100;

  if(data.noPlan) score -= 30;
  if(!data.hasPlan) score -= 20;
  if(!data.followedPlan) score -= 15;
  if(data.skipped) score -= 15;
  if(data.cutSession) score -= 10;
  if(data.randomPractice) score -= 25;
  if(data.manyMistakes) score -= 15;

  if(data.improvedHard) score += 15;
  if(data.hardControl) score += 10;
  if(data.fullSession) score += 10;

  return Math.max(0, Math.min(100, score));
}
function submitDiscipline(){

  let data = {
    hasPlan: document.getElementById("d_hasPlan").checked,
    followedPlan: document.getElementById("d_followedPlan").checked,
    fullSession: document.getElementById("d_fullSession").checked,
    skipped: document.getElementById("d_skipped").checked,
    cutSession: document.getElementById("d_cut").checked,
    randomPractice: document.getElementById("d_random").checked,
    improvedHard: document.getElementById("d_improved").checked,
    hardControl: document.getElementById("d_control").checked,
    manyMistakes: document.getElementById("d_mistakes").checked
  };

  let score = disciplineEngine(data);

  // 📊 zapis danych
  let history = JSON.parse(localStorage.getItem("disciplineHistory")) || [];

  history.push({
    date: new Date().toISOString(),
    score
  });

  localStorage.setItem("disciplineHistory", JSON.stringify(history));
  localStorage.setItem("lastDisciplineSession", JSON.stringify(data));

  // 📊 update charts
  renderCharts();

  // 🧠 zamiast scoreFeedback → coach report
  showCoachReport(score, data);
}
function showCoachReport(score, data){

  document.getElementById("coachReport").innerHTML =
    `
      <h2>🧠 Coach Report</h2>
      <div style="font-size:28px;">Score: ${score}</div>
      <pre style="white-space:pre-wrap;">
${interpretScore(score)}
      </pre>

      <button onclick="document.getElementById('disciplineModal').style.display='none'">
        Continue
      </button>
    `;
}
function getDisciplineChartData(){

  return {
    labels: disciplineHistory.map(x => x.date.slice(0,10)),
    values: disciplineHistory.map(x => x.score)
  };
}

function getDisciplineData(){
  return disciplineHistory.map(x => ({
    day: x.date.slice(0,10),
    score: x.score
  }));
}

function renderCharts(){

  let data = disciplineHistory || [];
  if(!data.length) return;

  const raw = data.map(x => x.score);

  const smooth = (arr) => {
    const out = [];
    for(let i=0;i<arr.length;i++){
      const slice = arr.slice(Math.max(0,i-2), i+1);
      out.push(slice.reduce((a,b)=>a+b,0)/slice.length);
    }
    return out;
  };

  const scores = smooth(raw);
  const labels = scores.map((_, i) => i + 1);

  if(disciplineChart) disciplineChart.destroy();

  disciplineChart = new Chart(document.getElementById("disciplineCanvas"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Discipline trend",
        data: scores,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { min: 0, max: 100 }
      }
    }
  });
}




function generateTomorrowCoach(){

  let history = JSON.parse(localStorage.getItem("disciplineHistory")) || [];
  let lastSession = JSON.parse(localStorage.getItem("lastDisciplineSession")) || null;

  if(!history.length){
    return "Brak danych — zrób kilka sesji, żeby coach mógł analizować wzorce.";
  }

  let avg = history.reduce((a,b)=>a+b.score,0)/history.length;

  let msg = "🧠 AUTO COACH — ANALIZA SŁABOŚCI\n\n";

  // 🔥 ANALIZA OSTATNIEJ SESJI (NAJWAŻNIEJSZE)
  if(lastSession){

    msg += "📍 OSTATNIA SESJA:\n";

    if(lastSession.skipped) msg += "❌ POMIJANIE MATERIAŁU → problem z konsekwencją\n";
    if(lastSession.cutSession) msg += "✂️ SKRACANIE SESJI → brak wytrzymałości / motywacji\n";
    if(lastSession.randomPractice) msg += "🎲 CHAOS PRACTICE → brak struktury\n";
    if(!lastSession.followedPlan) msg += "📉 BRAK TRZYMANIA PLANU → słaba dyscyplina wykonawcza\n";
    if(!lastSession.hasPlan) msg += "🧭 BRAK PLANU → problem strategiczny\n";
    if(lastSession.manyMistakes) msg += "⚠ DUŻO BŁĘDÓW → za trudny materiał lub brak kontroli\n";

    if(lastSession.improvedHard) msg += "🔥 DOBRZE: poprawa trudnych fragmentów\n";
    if(lastSession.hardControl) msg += "🎯 DOBRZE: kontrola trudnych fragmentów\n";
    if(lastSession.fullSession) msg += "💪 DOBRZE: pełna sesja wykonana\n";

    msg += "\n";
  }

  // 📊 GLOBALNA DIAGNOZA
  msg += "📊 TREND SYSTEMU:\n";

  if(avg < 50){
    msg += "❌ DOMINUJE CHAOS → brak struktury treningu\n";
  } else if(avg < 75){
    msg += "⚠ ŚREDNIA STABILNOŚĆ → potrzebujesz więcej rutyny\n";
  } else {
    msg += "🔥 DOBRA DYSCYPLINA → możesz zwiększać trudność\n";
  }

  // 🧠 NAJWIĘKSZA SŁABOŚĆ (AUTO DETEKTOR)
  let weaknesses = [];

  if(history.filter(h => h.score < 60).length > history.length/2){
    weaknesses.push("NIEREGULARNA DYSCYPLINA");
  }

  msg += "\n🧠 GŁÓWNA OBSZAR DO POPRAWY:\n";

  if(weaknesses.length){
    weaknesses.forEach(w => msg += "👉 " + w + "\n");
  } else {
    msg += "👉 Brak krytycznych słabości — utrzymuj system\n";
  }

  // 📌 PLAN NA JUTRO
  msg += "\n📌 PLAN NA JUTRO:\n";

  if(avg < 60){
    msg += "- tylko struktura (zero chaos practice)\n";
    msg += "- 1–2 bloki max\n";
    msg += "- pełne trzymanie planu\n";
  } else {
    msg += "- 1 trudny fragment\n";
    msg += "- 1 repertuar\n";
    msg += "- 1 blok techniczny\n";
  }

  return msg;
}
function runCoach(){
  document.getElementById("coachText").innerText = generateTomorrowCoach();
}



function interpretScore(score){

  let msg = "";

  if(score >= 85){
    msg += "🔥 ELITE SESSION\n";
    msg += "Twoja struktura jest bardzo mocna. Możesz zwiększać trudność.\n";
  }
  else if(score >= 70){
    msg += "✅ DOBRA SESJA\n";
    msg += "Stabilna dyscyplina. Kontynuuj obecny system.\n";
  }
  else if(score >= 50){
    msg += "⚠ ŚREDNIA SESJA\n";
    msg += "Masz chaos w strukturze. Skup się na planie i konsekwencji.\n";
  }
  else{
    msg += "❌ SŁABA SESJA\n";
    msg += "Brak struktury. Jutro: tylko plan + kontrola, zero chaosu.\n";
  }

  return msg;
}
/* ================= BLOCKS ================= */
function addBlock(){
blocks.push({name:"New",duration:5});
render();
}

function removeBlock(i){
blocks.splice(i,1);
render();
}

function addRandom3(){
let bank=["Arpeggio","Scale","Barre","Slurs","Rhythm","Vibrato",
"Galechromatyczne ćwiczenia w pozycjach", "Arpeggia Giulianiego – wzory od 1 do 17",
 "Arpeggia Giulianiego – wzory od 25 do 35", "Arpeggia Giulianiego – wzory od 81 do 100", 
 "Gamy diatoniczne Segovii (dwuoktawowe)", "Gamy diatoniczne Segovii (trzyoktawowe)", "Ćwiczenia chromatyczne na jednej strunie", "Ćwiczenia na ligatury wznoszące", "Ćwiczenia na ligatury opadające", "Pajączek (ćwiczenia rozciągające)", "Ćwiczenia na artykulację staccato i legato", "Arpeggia trójpalcowe i czteropalcowe (p-i-m-a)", "Ćwiczenia na przesuwanie ręki po gryfie (Shifts)", "Ćwiczenia na technikę barré (docisk i akordy)", "Wzorce arpeggiów z powtarzanym palcem", "Gamy w interwałach – tercje", "Gamy w interwałach – seksty", "Arpeggia triolowe", "Ćwiczenia na niezależność palców lewej ręki", "Ćwiczenia na krzyżowanie strun (String skipping)", "Trening swobodnego i opartego uderzenia (Free and Rest stroke)", "Wprowadzenie do tremolo (p-a-m-i)", "Rozgrzewka na pustych strunach", "Ćwiczenia na dynamikę (p, mf, f, crescendo)", "Ćwiczenia na kontrolę barwy dźwięku (tasto / ponticello)", "Rozciąganie palców w wysokich pozycjach", "Podstawy techniki rasgueado", "Ćwiczenia typu burst (szybkie serie czteronutowe)",
 "Ćwiczenia na synchronizację obu rąk", "Studia progresywne Carcassiego (wybrane etui)","Oktawy", "Chromatyka 1-2-3-4", "Pająk (Spider Exercise)", "Skale durowe w jednej pozycji", "Skale molowe naturalne", "Skale z metronomem", "Arpeggia Giulianiego (120 Right Hand Studies)", "Arpeggia p-i-m-a", "Arpeggia z akcentami", "Legato (hammer-on i pull-off)", "Ćwiczenia barré", "Zmiany pozycji lewej ręki", "Niezależność palców lewej ręki", "Ćwiczenia prawej ręki i-m", "Ćwiczenia prawej ręki m-a", "Naprzemienne palcowanie i-m", "Tremolo p-a-m-i", "Rasgueado podstawowe", "Apoyando (rest stroke)", "Tirando (free stroke)", "Ćwiczenia na dynamikę", "Ćwiczenia na vibrato", "Ćwiczenia na flażolety", "Etiuda Carcassiego Op. 60 nr 7", "Etiuda Carcassiego Op. 60 nr 19", "Etiuda Sora Op. 35 nr 22", "Etiuda Sora Op. 60 nr 3", "Etiuda Giulianiego Op. 48 nr 5", "Estudios Sencillos nr 1 Brouwera", "Etiuda Villa-Lobosa nr 1"];
for(let i=0;i<3;i++){
blocks.push({
name:bank[Math.floor(Math.random()*bank.length)],
duration:5
});
}
render();
}

/* ================= TIMER ================= */
function startSession(){
  lastPracticeTick = Date.now();
  sessionStart = Date.now();
  current = 0;

  sessionTotalSeconds = blocks.reduce((sum,b)=>sum + b.duration * 60, 0);

  loadBlock();
}

function loadBlock(){
  if(current >= blocks.length){
    finish();
    return;
  }

  currentBlockDuration = blocks[current].duration * 60;
  blockStartTime = Date.now();

  timeLeft = currentBlockDuration;

  task.textContent = blocks[current].name;

  update();
}

function toggleTimer(){

  if(!sessionStart){
    startSession();
    lastPracticeTick = Date.now(); // 🔥 FIX
  }

  if(playing){
    playing = false;
    clearInterval(interval);
    return;
  }

  playing = true;

  lastPracticeTick = Date.now(); // 🔥 FIX: reset przy każdym starcie

  clearInterval(interval);
  interval = setInterval(tick, 250);
}
function tick(){
  const now = Date.now();
if (playing) {
  updatePracticeFromSession();
}

  const elapsed = Math.floor((now - blockStartTime) / 1000);
  timeLeft = Math.max(0, currentBlockDuration - elapsed);

  update();

  if(timeLeft <= 0){
  beep();

  if(blocks[current]){
    addXP(blocks[current].duration * 2);
  }

  current++;
  loadBlock();
  updatePracticeFromSession();
  localStorage.setItem("practice", JSON.stringify(practice));
updateProgressBars();
}
}
/* ================= UPDATE ================= */
function update(){

if(!blocks[current]) return;

task.textContent = playing 
  ? blocks[current].name 
  : "PAUSED";

let m = String(Math.floor(timeLeft/60)).padStart(2,"0");
let s = String(timeLeft%60).padStart(2,"0");
timerEl.textContent = `${m}:${s}`;

// === BLOCK PROGRESS (opcjonalny jeśli nadal chcesz) ===
let total = blocks[current].duration * 60;
let elapsed = total - timeLeft;



// === SESSION PROGRESS ===
let sessionTotal = blocks.reduce((sum,b)=>sum + b.duration * 60, 0);

let done = 0;

// poprzednie bloki
for(let i=0;i<current;i++){
  done += blocks[i].duration * 60;
}

// aktualny blok
done += elapsed;

// TO BYŁO BRAKUJĄCE
bar.style.width = (done / sessionTotal * 100) + "%";

updateRemain();
updateGlobal();
}

/* ================= GLOBAL TIMER ================= */
function updateGlobal(){

if(!sessionStart) return;

let elapsed = (Date.now() - sessionStart) / 1000;
let remaining = Math.max(0, sessionTotalSeconds - elapsed);

let m = String(Math.floor(remaining/60)).padStart(2,"0");
let s = String(Math.floor(remaining%60)).padStart(2,"0");

globalTime.textContent = `${m}:${s}`;
}
/* ================= REMAIN ================= */
function updateRemain(){
let sum=0;
for(let i=current;i<blocks.length;i++){
sum+=blocks[i].duration;
}
remain.textContent=sum;
}
function repFeedback(msg, type="info"){

  const box = document.getElementById("repFeedback");

  if(!box) return;

  let color = "#f5f5f7";

  if(type === "good") color = "#3b82f6";
  if(type === "bad") color = "#ff6b6b";
  if(type === "warn") color = "#fbbf24";

  box.innerHTML = `<div style="color:${color}">${msg}</div>`;
}

function addSong(){

let title = document.getElementById("songTitle").value;
let author = document.getElementById("songAuthor").value;
let bars = +document.getElementById("songBars").value;

if(!title || !bars) return;

repertoire.push({
  title,
  author,
  totalBars: bars,
  doneBars: 0,
  createdAt: Date.now(),
  lastUpdate: Date.now()
});

saveRep();
renderRep();
}

function getBars(){
  let val = +prompt("Ile taktów?");
  return val > 0 ? val : 0;
}
function getDaysLeft(createdAt){
  const now = Date.now();
  const diff = (7 * 24 * 60 * 60 * 1000) - (now - createdAt);
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}
function saveRep(){
localStorage.setItem("cg_rep", JSON.stringify(repertoire));
}
function getDailyTarget(r){
  let daysLeft = Math.max(1, getDaysLeft(r.createdAt));
  return Math.ceil((r.totalBars - r.doneBars) / daysLeft);
}
function renderRep(){
  const wrap = document.getElementById("repList");
  if(!wrap) return;
  wrap.innerHTML = "";

  repertoire.forEach((r,i)=>{

    let percent = r.totalBars
      ? Math.min(100, (r.doneBars / r.totalBars) * 100)
      : 0;

    // 🔥 TU LICZYSZ NORMALNIE W JS (NIE W HTML)
    let daysLeft = getDaysLeft(r.createdAt);
    let dailyTarget = getDailyTarget(r);

    wrap.innerHTML += `
      <div class="rep-item">

        <div class="rep-title">🎸 ${r.title}</div>
        <div style="color:#aaa;font-size:12px">${r.author}</div>

        <!-- 🔥 TU WSTAWIASZ DO HTML -->
        <div style="font-size:11px;color:#aaa;margin-top:4px">
          ⏳ ${daysLeft} dni left • 🎯 ${dailyTarget} taktów/dzień
        </div>

        <div style="margin-top:6px">
          ${r.doneBars} / ${r.totalBars} taktów
        </div>

        <div class="rep-bar">
          <div class="rep-fill" style="width:${percent}%"></div>
        </div>

        <input id="bars-${i}" type="number" placeholder="dodaj takty">

        <div style="margin-top:8px;display:flex;gap:6px;">
          <button onclick="addBars(${i})">+ takty</button>
          <button onclick="addFromSession(${i})">🎸 sesja</button>
        </div>

      </div>
    `;
  });

  
}

function addBars(i){

  let input = document.getElementById("bars-" + i);
  let amount = +input.value;

  if(!amount){
    repFeedback("⚠ wpisz ilość taktów", "warn");
    return;
  }

  repertoire[i].doneBars += amount;

  if(repertoire[i].doneBars > repertoire[i].totalBars){
    repertoire[i].doneBars = repertoire[i].totalBars;
  }

  addXP(amount * 5);   // 🔥 FIX

  saveRep();
  renderRep();
}
function addFromSession(i){

  let input = document.getElementById("bars-" + i);
  let amount = +input.value;

  if(!amount){
    repFeedback("⚠ wpisz ilość taktów", "warn");
    return;
  }

  repertoire[i].doneBars += amount;

  addXP(amount * 7);   // 🔥 FIX

  saveRep();
  renderRep();
}
function evaluateDay(){

  let okMinutes = daily.minutes >= 45;
  let okBars = daily.bars >= 8;
  let okFocus = daily.focusSessions >= 1;

  if(okMinutes && okBars && okFocus){
    daily.penalty = false;
  } else {
    daily.penalty = true;
  }

  applyPenalty();
}
function applyPenalty(){

  if(daily.penalty){
    xp = Math.floor(xp * 0.7); // -30%
    document.getElementById("xp").textContent = xp;
  }
}

function updateWeekStats(){

  weekStats.totalBarsPlanned = 120;

  let percent = Math.min(
    100,
    (weekStats.totalBarsDone / weekStats.totalBarsPlanned) * 100
  );

  return percent;
}
function startFocusSession(){
  daily.focusSessions += 1;
}


function cleanRepertoire(){

  const now = Date.now();

  repertoire = repertoire.filter(r => {

    let age = now - r.createdAt;

    let completed = r.doneBars >= r.totalBars;

    // 🔥 1. EARLY COMPLETION = usuń od razu
    if(completed){
      archive.push({
        title: r.title,
        bars: r.doneBars,
        date: r.createdAt,
        reason: "completed"
      });
      return false;
    }

    // 🔥 2. 7 DAY EXPIRY
    if(age > 7 * 24 * 60 * 60 * 1000){
      archive.push({
        title: r.title,
        bars: r.doneBars,
        date: r.createdAt,
        reason: "expired"
      });
      return false;
    }

    return true;
  });

  localStorage.setItem("cg_archive", JSON.stringify(archive));
  saveRep();
  renderRep();
}

function resetDaily(){

  evaluateDay();

  daily = {
    minutes: 0,
    bars: 0,
    focusSessions: 0,
    penalty: false
  };
}

function generateAIReport(){

  let text = "";

  // XP / LEVEL
  if(xp < 100){
    text += "⚠ Jesteś na początku progresu. Potrzebujesz regularności.\n\n";
  } else {
    text += "🔥 Masz już bazę XP — teraz liczy się konsekwencja.\n\n";
  }

  // STREAK
  if(streak === 0){
    text += "❌ Brak streaka — ryzyko utraty progresu.\n\n";
  } else {
    text += `🔥 Streak: ${streak} dni — utrzymuj codzienność!\n\n`;
  }

  // DAILY RULES
  if(daily.minutes < 45){
    text += "⏳ Niedobór: mniej niż 45 min treningu dziennie.\n";
    text += "👉 Jeśli tego nie poprawisz: brak progresu tygodniowego.\n\n";
  }

  if(daily.bars < 8){
    text += "🎸 Niedobór: za mało taktów repertuaru.\n";
    text += "👉 Ryzyko: brak mastery w 7 dni.\n\n";
  }

  if(daily.focusSessions < 1){
    text += "🧠 Brak focus session — uczenie się jest mniej efektywne.\n\n";
  }

  // REPETITION WARNING
  if(repertoire.length === 0){
    text += "⚠ Brak repertuaru — brak realnego progresu muzycznego.\n";
  }

  return text;
}
function showAIBanner(){
  syncStats();
  document.getElementById("aiBanner").style.display = "flex";
  document.getElementById("aiText").innerText = generateAIReport();
}

function closeAIBanner(){
  document.getElementById("aiBanner").style.display = "none";
}
/* ================= AUDIO ================= */
function beep(){
const ctx=new (window.AudioContext||window.webkitAudioContext)();
const o=ctx.createOscillator();
const g=ctx.createGain();

o.connect(g);g.connect(ctx.destination);
o.frequency.value=900;

o.start();
g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.2);
o.stop(ctx.currentTime+0.2);
}

/* ================= SAVE ================= */
function persist(){
localStorage.setItem("cg_blocks",JSON.stringify(blocks));
refreshPlans();
}

function savePlan(){
let name=document.getElementById("planName").value;
if(!name)return;

localStorage.setItem("plan_"+name,JSON.stringify(blocks));
refreshPlans();
}

function refreshPlans(){
plansList.innerHTML="";

Object.keys(localStorage)
.filter(k=>k.startsWith("plan_"))
.forEach(k=>{
let opt=document.createElement("option");
opt.value=k;
opt.textContent=k.replace("plan_","");
plansList.appendChild(opt);
});
}

function loadSelectedPlan(){
let key=plansList.value;
if(!key)return;

let data=localStorage.getItem(key);
if(data){
blocks=JSON.parse(data);
render();
}
}

/* ================= CONTROLS ================= */
function nextBlock(){
beep();
current++;
loadBlock();
}

function finish(){
clearInterval(interval);
playing=false;
beep();
lastPracticeTick = null;
let today = new Date().toDateString();

if(lastSessionDay !== today){
  streak += 1;
  lastSessionDay = today;
}

document.getElementById("streak").textContent = streak;

localStorage.setItem("streak", streak);
localStorage.setItem("lastSessionDay", lastSessionDay);
document.getElementById("endBanner").style.display="flex";

document.getElementById("disciplineModal").style.display = "flex";
}
function closeEndBanner(){
document.getElementById("endBanner").style.display="none";
current=0;
timeLeft=0;
sessionStart=0;
}

function toggleFullscreen(){
if(!document.fullscreenElement){
document.documentElement.requestFullscreen();
}else{
document.exitFullscreen();
}
}
function checkPracticeReset(){

    const today = new Date().toDateString();
    const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

    if(practice.lastDay !== today){
        practice.todayMinutes = 0;
        practice.lastDay = today;
    }

    if(practice.weekNumber !== week){
        practice.weekMinutes = 0;
        practice.weekNumber = week;
    }

    localStorage.setItem("practice", JSON.stringify(practice));
}

function updatePractice(minutes){

    const today = new Date().toDateString();
    const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

    if(practice.lastDay !== today){
        practice.todayMinutes = 0;
        practice.lastDay = today;
    }

    if(practice.weekNumber !== week){
        practice.weekMinutes = 0;
        practice.weekNumber = week;
    }

    practice.todayMinutes += minutes;
    practice.weekMinutes += minutes;

    localStorage.setItem("practice", JSON.stringify(practice));

    updateProgressBars(); // 🔥 DODAJ TO
}
function updatePracticeFromSession(){

  if(!sessionStart || !playing) return;

  const now = Date.now();

  checkPracticeReset();

  if(!lastPracticeTick){
    lastPracticeTick = now;
    return;
  }

  const deltaMinutes = (now - lastPracticeTick) / 60000;
  lastPracticeTick = now;

  practice.todayMinutes += deltaMinutes;
  practice.weekMinutes += deltaMinutes;

  localStorage.setItem("practice", JSON.stringify(practice));
  updateProgressBars();
}
function gameLoopCheck(){

  let now = new Date().toDateString();
  let last = localStorage.getItem("lastCheckDay");

  // tylko raz dziennie
  if(last === now) return;

  evaluateDay();

  if(daily.penalty){
    console.log("❌ DAY FAILED");
  } else {
    console.log("✅ DAY COMPLETED");
  }

  resetDaily();

  localStorage.setItem("lastCheckDay", now);
}
/* ================= INIT ================= */
function init(){
lastPracticeTick = Date.now();
sessionStart = 0;
playing = false;
  render();
  refreshPlans();
  renderRep();
  syncStats();
  renderCharts();
  cleanRepertoire();
  checkPracticeReset();
  updateProgressBars();

  if(!localStorage.getItem("aiSeen")){
    showAIBanner();
    localStorage.setItem("aiSeen", "1");
  }

  setInterval(cleanRepertoire, 60 * 60 * 1000);
  setInterval(gameLoopCheck, 10000);

  addInterval(() => {
    if(sessionStart) updateGlobal();
  }, 1000);
}

init();
