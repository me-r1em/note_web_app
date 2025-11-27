document.addEventListener('DOMContentLoaded', () => {
  // ---------- POMODORO TIMER ----------
  const timerDisplay = document.getElementById('timer');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const modeBtns = document.querySelectorAll('.mode_btn');
  const settingsBtn = document.getElementById('settingsBtn');
  const modal = document.getElementById('settingsModal');
  const closeModal = document.querySelector('.close');
  const saveSettings = document.getElementById('saveSettings');

  const STORAGE_KEY = 'pomoState';
  const SETTINGS_KEY = 'pomoSettings';

  // default times in seconds
  let focusTime = 25*60, shortBreak = 5*60, longBreak = 15*60;
  let currentMode = 'focus';
  let remaining = focusTime;
  let timer = null;
  let endTime = null;

  function formatTime(s){
    const m = Math.floor(s/60);
    const sec = s%60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }

  function updateDisplay(){ timerDisplay.textContent = formatTime(Math.max(0, remaining)); }

  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify({currentMode, endTime})); }
  function loadState(){ 
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    if(s.currentMode) currentMode=s.currentMode;
    if(s.endTime) endTime=s.endTime;
  }

  function startTimer(){
    if(timer) return;
    if(!endTime) endTime = Date.now()/1000 + remaining;
    timer = setInterval(()=>{
      remaining = Math.round(endTime - Date.now()/1000);
      if(remaining <= 0){
        clearInterval(timer);
        timer=null;
        remaining=0;
        endTime=null;
        localStorage.removeItem(STORAGE_KEY);
        showNotification(`Time’s up for ${currentMode}! 🌸`);
      }
      updateDisplay();
      saveState();
    },1000);
  }

  function pauseTimer(){
    clearInterval(timer);
    timer=null;
    if(endTime){
      remaining = Math.round(endTime - Date.now()/1000);
      endTime=null;
      saveState();
    }
  }

  function resetTimer(){
    pauseTimer();
    if(currentMode==='focus') remaining=focusTime;
    else if(currentMode==='short') remaining=shortBreak;
    else remaining=longBreak;
    updateDisplay();
    saveState();
  }

  function switchMode(mode){
    currentMode = mode;
    modeBtns.forEach(b=>b.classList.remove('active'));
    document.querySelector(`.mode_btn[data-mode="${mode}"]`).classList.add('active');
    if(mode==='focus') remaining=focusTime;
    else if(mode==='short') remaining=shortBreak;
    else remaining=longBreak;
    endTime=null;
    pauseTimer();
    updateDisplay();
    saveState();
  }

  function showNotification(msg){
    const note = document.createElement('div');
    note.className='notification';
    note.textContent=msg;
    document.body.appendChild(note);
    setTimeout(()=>note.remove(),3000);
  }

  // load saved settings
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
  if(settings.focusTime) focusTime=settings.focusTime;
  if(settings.shortBreak) shortBreak=settings.shortBreak;
  if(settings.longBreak) longBreak=settings.longBreak;

  // load saved timer state
  loadState();
  if(endTime){
    remaining = Math.round(endTime - Date.now()/1000);
    startTimer();
  } else {
    if(currentMode==='focus') remaining=focusTime;
    else if(currentMode==='short') remaining=shortBreak;
    else remaining=longBreak;
  }

  modeBtns.forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);

  // ⚙️ Settings modal
  settingsBtn.addEventListener('click', ()=>modal.style.display='flex');
  closeModal.addEventListener('click', ()=>modal.style.display='none');
  window.addEventListener('click', e=>{ if(e.target===modal) modal.style.display='none'; });
  saveSettings.addEventListener('click', ()=>{
    const f=parseInt(document.getElementById('focusInput').value)||25;
    const s=parseInt(document.getElementById('shortInput').value)||5;
    const l=parseInt(document.getElementById('longInput').value)||15;
    focusTime=f*60;
    shortBreak=s*60;
    longBreak=l*60;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({focusTime, shortBreak, longBreak}));
    modal.style.display='none';
    resetTimer();
  });

  updateDisplay();

  // ---------- STICKY NOTES ----------
  const todoForm = document.getElementById('todoForm');
  const todoInput = document.getElementById('todoInput');
  const colors = ['#fff0db','#ffd4d9','#f4b2b0','#ed929f','#f38d9e'];
  const NOTE_KEY = 'cozy_sticky_notes';
  let zIndexCounter=100;

  const savedNotes = JSON.parse(localStorage.getItem(NOTE_KEY)||'[]');
  savedNotes.forEach(createStickyFromData);

  todoForm.addEventListener('submit', e=>{
    e.preventDefault();
    const text = todoInput.value.trim();
    if(!text) return;

    const noteData = {
      id: Date.now(),
      text,
      color: colors[Math.floor(Math.random()*colors.length)],
      left:`${Math.random()*(window.innerWidth-160)}px`,
      top:`${Math.random()*(window.innerHeight-120)}px`,
      rotation:`${(Math.random()-0.5)*10}deg`,
      width:'140px',
      height:'100px',
      pinned:false
    };
    createStickyFromData(noteData);
    saveNote(noteData);
    todoInput.value='';
  });

  function createStickyFromData(data){
    const note=document.createElement('div');
    note.className='sticky';
    note.textContent=data.text;
    note.dataset.id=data.id;
    note.style.background=data.color;
    note.style.left=data.left;
    note.style.top=data.top;
    note.style.width=data.width;
    note.style.height=data.height;
    note.style.setProperty('--rot', data.rotation);
    note.style.zIndex=++zIndexCounter;

    const del=document.createElement('button');
    del.className='delete-btn'; del.innerHTML='✖';
    del.addEventListener('click',()=>deleteNote(data.id,note));
    note.appendChild(del);

    const pin=document.createElement('button');
    pin.className='pin-btn';
    pin.innerHTML=data.pinned?'📌':'📍';
    pin.addEventListener('click',()=>togglePin(data.id,note,pin));
    note.appendChild(pin);

    const resize=document.createElement('div');
    resize.className='resize-handle';
    note.appendChild(resize);

    if(data.pinned) lockNote(note);

    makeDraggable(note);
    makeResizable(note);
    document.body.appendChild(note);
  }

  function togglePin(id, el, btn){
    const notes=JSON.parse(localStorage.getItem(NOTE_KEY)||'[]');
    const note=notes.find(n=>n.id==id);
    if(!note) return;
    note.pinned=!note.pinned;
    localStorage.setItem(NOTE_KEY,JSON.stringify(notes));
    if(note.pinned){ lockNote(el); btn.innerHTML='📌'; el.style.zIndex=9999; }
    else { unlockNote(el); btn.innerHTML='📍'; el.style.zIndex=++zIndexCounter; }
  }

  function lockNote(el){
    el.classList.add('pinned');
    el.querySelector('.resize-handle').style.display='none';
    el.style.cursor='default';
  }
  function unlockNote(el){
    el.classList.remove('pinned');
    el.querySelector('.resize-handle').style.display='block';
    el.style.cursor='move';
  }

  function makeDraggable(el){
    let dragging=false, offsetX, offsetY;
    el.addEventListener('mousedown', e=>{
      if(el.classList.contains('pinned')) return;
      if(['resize-handle','delete-btn','pin-btn'].some(c=>e.target.classList.contains(c))) return;
      dragging=true;
      offsetX=e.clientX-el.offsetLeft;
      offsetY=e.clientY-el.offsetTop;
      el.style.zIndex=++zIndexCounter;
    });
    document.addEventListener('mousemove', e=>{ if(dragging){ el.style.left=e.clientX-offsetX+'px'; el.style.top=e.clientY-offsetY+'px'; } });
    document.addEventListener('mouseup', ()=>{ if(dragging){ dragging=false; updateNoteData(el); } });
  }

  function makeResizable(el){
    const handle = el.querySelector('.resize-handle');
    let resizing=false, startX, startY, startW, startH;
    handle.addEventListener('mousedown', e=>{
      if(el.classList.contains('pinned')) return;
      e.stopPropagation();
      resizing=true;
      startX=e.clientX; startY=e.clientY;
      startW=el.offsetWidth; startH=el.offsetHeight;
      el.style.zIndex=++zIndexCounter;
    });
    document.addEventListener('mousemove', e=>{
      if(!resizing) return;
      el.style.width=startW+(e.clientX-startX)+'px';
      el.style.height=startH+(e.clientY-startY)+'px';
    });
    document.addEventListener('mouseup', ()=>{ if(resizing){ resizing=false; updateNoteData(el); } });
  }

  function saveNote(noteData){
    const notes=JSON.parse(localStorage.getItem(NOTE_KEY)||'[]');
    notes.push(noteData);
    localStorage.setItem(NOTE_KEY,JSON.stringify(notes));
  }

  function updateNoteData(el){
    const id=el.dataset.id;
    const notes=JSON.parse(localStorage.getItem(NOTE_KEY)||'[]');
    const note=notes.find(n=>n.id==id);
    if(note){
      note.left=el.style.left;
      note.top=el.style.top;
      note.width=el.style.width;
      note.height=el.style.height;
      localStorage.setItem(NOTE_KEY,JSON.stringify(notes));
    }
  }

  function deleteNote(id, el){
    el.remove();
    const notes=JSON.parse(localStorage.getItem(NOTE_KEY)||'[]');
    localStorage.setItem(NOTE_KEY,JSON.stringify(notes.filter(n=>n.id!=id)));
  }

 // Array of inspirational quotes
const quotes = [
    "Believe in yourself!",
    "Take it one step at a time.",
    "You are capable of amazing things.",
    "Stay positive,work hard,make it happen.",
    "Every day is a second chance.",
    "Study now ,shine later.",
    "Focus on your goals.",
    "Progress, not perfection.",
    "Your only limit is your mind.",
    "Dream it. Wish it. Do it."
];

const quoteDisplay = document.getElementById('quoteDisplay');
let currentIndex = 0;

// Function to update the quote
function updateQuote() {
    quoteDisplay.style.opacity = 0; // fade out
    setTimeout(() => {
        quoteDisplay.textContent = quotes[currentIndex];
        quoteDisplay.style.opacity = 1; // fade in
        currentIndex = (currentIndex + 1) % quotes.length;
    }, 500); // fade duration in ms
}

// Initialize first quote
updateQuote();

// Change quote every 5 minutes (300000 ms)
setInterval(updateQuote, 300000);





});
