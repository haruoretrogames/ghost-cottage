'use strict';

const byId = id => document.getElementById(id);
const shell = document.querySelector('.shell');
const windowPanel = byId('window');
const room = byId('room');
const picker = byId('picker');
const cottage = byId('cottage');
const system = byId('system');
const pet = byId('pet');
const spots = byId('spots');
const progress = byId('progress');
const notice = byId('notice');
const art = name => './art/' + name + '.png';
const kinds = ['金', '木', '水', '火', '土'];
const storageKey = 'haruo-ghost-cottage-v1';
const effect = new Audio();
const statuses = {
  quiet: ['沒事', 138, ['sweep'], 'normal'],
  curious: ['好奇', 141, ['sweep'], 'nothing'],
  play: ['想玩', 145, ['play', 'scold', 'sweep'], 'happy'],
  walk: ['想外出', 146, ['walk', 'scold', 'sweep'], 'speak'],
  worried: ['好奇', 147, ['soothe', 'scold', 'sweep'], 'cry'],
  tired: ['想睡', 143, ['lights', 'sweep'], 'nothing'],
  sleep: ['睡覺', 143, ['call'], 'sleep'],
  startled: ['驚醒', 144, ['soothe', 'scold'], 'cry']
};
const actions = [
  ['play','遊戲',133], ['walk','散心',136], ['soothe','安撫',130],
  ['scold','管教',135], ['sweep','清掃',131], ['call','呼喚',137], ['lights','熄燈',134]
];
const cycle = ['play', 'curious', 'worried', 'walk', 'play', 'quiet', 'tired'];
const spotMap = [[16,23],[117,11],[5,62],[124,79]];
const hidingPlaces = [];

let chosen = 0;
let mode = 'picker';
let restoredMode = 'picker';
let status = 'quiet';
let mood = 0;
let data = { scores: [0,0,0,0,0], chosen: 0, sound: true };
let sequence = 0;
let stateTime = Infinity;
let reaction = '';
let reactionEnd = 0;
let transition = null;
let round = null;
let messageTime = 0;
let moveStart = 0;

function readSave() {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (!saved || !Array.isArray(saved.scores) || saved.scores.length !== 5) return null;
  return {
    scores: saved.scores.map(score => Number.isFinite(score) ? Math.max(0,Math.min(100,score)) : 0),
    chosen: Number.isInteger(saved.chosen) && saved.chosen >= 0 && saved.chosen < 5 ? saved.chosen : 0,
    sound: saved.sound !== false
  };
}

try { data = readSave() || data; } catch {}

function sound(name = 'button') {
  if (!data.sound) return;
  effect.pause();
  effect.src = './sound/' + name + '.wav';
  effect.play().catch(() => {});
}

function showMessage(message) {
  notice.textContent = message;
  clearTimeout(messageTime);
  messageTime = setTimeout(() => { notice.textContent = ''; },2500);
}

function setMode(next) {
  mode = next;
  windowPanel.hidden = next === 'hidden';
  byId('reopen').hidden = next !== 'hidden';
  picker.hidden = next !== 'picker';
  cottage.hidden = next !== 'room';
  system.hidden = next !== 'system';
  drawRoom();
}

function drawRoom() {
  room.src = art(mode === 'system' ? 159 : status === 'sleep' ? 116 : reaction === 'outing' ? 115 : 114);
}

function sprite(type, animation, step) {
  return art('ghost_0' + (type + 1) + '_' + animation + '_0' + step);
}

function renderState() {
  const [label, icon, eligible] = statuses[status];
  byId('need-icon').src = art(icon);
  byId('need').textContent = round ? '躲貓貓' : label;
  byId('mood').src = art(mood > 0 ? 139 : mood < 0 ? 140 : 138);
  byId('mood').alt = mood > 0 ? '心情愉快' : mood < 0 ? '心情低落' : '心情平靜';
  progress.textContent = round ? '找到 ' + round.hits + ' 次' : kinds[chosen] + '符鬼　悟性 ' + data.scores[chosen];
  for (const button of byId('commands').children) {
    button.disabled = Boolean(round || transition) || !eligible.includes(button.dataset.action);
  }
  drawRoom();
}

function setStatus(next, delay) {
  status = next;
  stateTime = performance.now() + delay;
  renderState();
}

function start(type) {
  chosen = type;
  data.chosen = type;
  mood = 0;
  sequence = 0;
  transition = null;
  reaction = '';
  moveStart = performance.now();
  for (const {picture} of hidingPlaces) picture.src = sprite(chosen,'happy',1);
  setMode('room');
  setStatus('quiet', 3500);
}

for (const [i,name] of kinds.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', name + '符鬼');
  const picture = new Image();
  picture.src = sprite(i,'normal',1);
  picture.alt = '';
  button.append(picture, name);
  button.addEventListener('click', () => { sound(); start(i); });
  byId('pets').append(button);
}

for (const [id,name,image] of actions) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'command';
  button.dataset.action = id;
  button.setAttribute('aria-label',name);
  const picture = new Image();
  picture.src = art(image);
  picture.alt = '';
  button.append(picture);
  button.addEventListener('click', () => perform(id));
  byId('commands').append(button);
}

function adjust(score, feeling) {
  data.scores[chosen] = Math.max(0, Math.min(100, data.scores[chosen] + score));
  mood = Math.sign(feeling);
}

function react(animation, duration, next = 'quiet') {
  reaction = animation;
  reactionEnd = performance.now() + duration;
  transition = next;
  renderState();
}

function perform(action) {
  sound(action === 'sweep' ? 'sweep' : action === 'lights' ? 'lights' : 'button');
  if (action === 'play') {
    playGame();
  } else if (action === 'walk') {
    adjust(0, 1);
    react('outing', 3600);
  } else if (action === 'soothe' || action === 'scold') {
    const soothing = action === 'soothe';
    adjust(status === 'worried' ? (soothing ? -5 : 3) : 0, soothing ? 1 : -1);
    react(soothing ? 'happy' : 'angry', 2200, status === 'startled' ? 'sleep' : 'quiet');
  } else if (action === 'sweep') {
    adjust(Math.random() < .33 ? 1 : 0, 1);
    const remaining = status;
    react('happy', 1100, remaining);
  } else if (action === 'call') {
    setStatus('startled', 8500);
  } else if (action === 'lights') {
    setStatus('sleep', 23000);
  }
}

for (const [i,[x,y]] of spotMap.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'spot';
  button.style.left = x + 'px';
  button.style.top = y + 'px';
  button.setAttribute('aria-label', '躲藏處 ' + (i+1));
  const picture = new Image();
  picture.alt = '';
  picture.hidden = true;
  button.append(picture);
  button.addEventListener('click', () => {
    if (!round || round.target !== i) return;
    sound();
    round.hits++;
    nextSpot(performance.now());
    renderState();
  });
  const foreground = new Image();
  foreground.className = 'hide-foreground';
  foreground.src = art('hide-foreground-' + (i + 1));
  foreground.alt = '';
  foreground.draggable = false;
  foreground.hidden = true;
  spots.append(button, foreground);
  hidingPlaces.push({button, picture, foreground});
}

function nextSpot(now) {
  const target = (round.target + 1 + Math.floor(Math.random() * (spotMap.length - 1))) % spotMap.length;
  round.target = target;
  round.next = now + 1150;
  for (const [i,{button, picture, foreground}] of hidingPlaces.entries()) {
    const active = i === target;
    picture.hidden = !active;
    foreground.hidden = !active;
    button.setAttribute('aria-label', (active ? '符鬼在躲藏處 ' : '躲藏處 ') + (i+1));
  }
}

function playGame() {
  const now = performance.now();
  round = {hits: 0, end: now + 16000, next: now, target: -1};
  pet.hidden = true;
  spots.hidden = false;
  nextSpot(now);
  renderState();
}

function finishGame(now) {
  const hits = round.hits;
  const score = hits === 0 ? -1 : Math.min(15,Math.floor(hits * .3));
  adjust(score, score >= 0 ? 1 : -1);
  cancelGame();
  react(score >= 0 ? 'happy' : 'nothing', 1700);
  showMessage('找到 ' + hits + ' 次 · 悟性 ' + (score >= 0 ? '+' : '−') + Math.abs(score));
}

function cancelGame() {
  round = null;
  spots.hidden = true;
  pet.hidden = false;
}

function leave(next) {
  cancelGame();
  setMode(next);
}

function hideRoom() {
  if (round) {
    cancelGame();
    setStatus('quiet', 3500);
  }
  restoredMode = mode === 'system' ? 'room' : mode;
  setMode('hidden');
}

function updateSoundSwitch() {
  const button = system.querySelector('[data-system=sound]');
  button.setAttribute('aria-pressed', String(data.sound));
  byId('sound-indicator').src = art(data.sound ? 157 : 156);
}
updateSoundSwitch();

byId('pot').addEventListener('click', () => {
  sound();
  if (round) {
    cancelGame();
    setStatus('quiet',3500);
  }
  setMode('system');
  system.querySelector('[data-system=return]').focus();
});
byId('hide').addEventListener('click', () => { sound(); hideRoom(); });
byId('close').addEventListener('click', () => { sound(); leave(mode === 'picker' ? 'hidden' : 'picker'); restoredMode = 'picker'; });
byId('reopen').addEventListener('click', () => { sound(); setMode(restoredMode); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mode === 'system') {
    setMode('room');
    byId('pot').focus();
  }
});
system.addEventListener('click', event => {
  const command = event.target.closest('button')?.dataset.system;
  if (!command) return;
  if (command === 'sound') {
    data.sound = !data.sound;
    if (!data.sound) effect.pause(); else sound();
    updateSoundSwitch();
    return;
  }
  sound();
  if (command === 'hide' || command === 'quit') { hideRoom(); return; }
  if (command === 'end') { leave('picker'); return; }
  if (command === 'save') {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      showMessage('已存檔');
    } catch { showMessage('此瀏覽器目前無法存檔'); }
  }
  if (command === 'load') {
    try {
      const saved = readSave();
      if (!saved) { showMessage('目前沒有存檔'); return; }
      data = saved;
      updateSoundSwitch();
      start(saved.chosen);
      showMessage('已讀取存檔');
      return;
    } catch { showMessage('無法讀取存檔'); return; }
  }
  setMode('room');
  byId('pot').focus();
});

function animate(now) {
  if (mode === 'room') {
    if (round) {
      if (now >= round.end) finishGame(now);
      else if (now >= round.next) nextSpot(now);
    } else if (transition && now >= reactionEnd) {
      const next = transition;
      transition = null;
      reaction = '';
      setStatus(next, next === 'sleep' ? 13000 : 3900);
    } else if (!transition && now >= stateTime) {
      if (status === 'tired' || status === 'startled') setStatus('sleep', 19000);
      else if (status === 'sleep') setStatus('quiet', 2800);
      else setStatus(cycle[sequence++ % cycle.length], 12500);
    }
    const idle = statuses[status][3];
    const t = (now - moveStart) / 1000;
    const walking = !reaction && status !== 'sleep' && t % 8 < 3;
    const movingRight = Math.cos(t / 2.1) >= 0;
    const animation = reaction === 'outing' || walking ? (movingRight ? 'walk_right' : 'walk_left') : reaction || idle;
    const frame = sprite(chosen, animation, 1 + Math.floor(now / 225) % 2);
    if (pet.getAttribute('src') !== frame) pet.src = frame;
    pet.style.left = (98 + (status === 'sleep' ? 0 : Math.sin(t / 2.1) * 38)) + 'px';
    pet.style.top = (status === 'sleep' ? 110 : 102 + Math.sin(t / 3) * 8) + 'px';
  }
  requestAnimationFrame(animate);
}
function tickClock() {
  const now = new Date();
  byId('clock').textContent = (now.getMonth()+1) + '月' + now.getDate() + '日 ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
}
new ResizeObserver(() => windowPanel.style.setProperty('--scale',shell.clientWidth / 280)).observe(shell);
tickClock();
setInterval(tickClock, 1000);
requestAnimationFrame(animate);
