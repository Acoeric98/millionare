let selectedAnswer = null;
let currentQuestionIndex = null;
let countdownInterval = null;
let fiftyHiddenOptions = [];

const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('game_id');
const playerName = urlParams.get('name');

function playSound(id, duration = null) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    if (duration) {
      setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
      }, duration * 1000);
    }
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getGameState() {
  const res = await fetch(`/millionare-api/get_question?game_id=${gameId}`);
  return await res.json();
}

async function loadQuestion() {
  document.getElementById("audience-chart-wrapper").style.display = "none";
  document.getElementById("phone_help_dialog").style.display = "none";

  // 👇 IDE KELL EZ A SOR
  const data = await getGameState();

  if (data.status === "ended") {
    showEnd(data);
    return;
  }

  if (data.used_helps?.phone) {
    const btnPhone = document.getElementById("btn-phone");
    btnPhone.disabled = true;
    btnPhone.innerText = "📞 Használva";
    document.getElementById("phone_help_dialog").style.display = "none";
  }
  if (data.used_helps?.audience) {
    const btnAudience = document.getElementById("btn-audience");
    btnAudience.disabled = true;
    btnAudience.innerText = "👥 Használva";
    document.getElementById("audience-chart-wrapper").style.display = "none";
  }

  currentQuestionIndex = data.question_number;
  selectedAnswer = null;
  fiftyHiddenOptions = [];

  document.getElementById("question").innerText = data.question;

  for (const [key, value] of Object.entries(data.answers)) {
    const btn = document.getElementById("btn" + key);
    btn.style.display = "inline-block";
    btn.disabled = false;
    btn.className = '';
    btn.innerText = `${key}) ${value}`;
    btn.onclick = () => submitAnswer(key, btn);
  }

  document.getElementById("continuePrompt").style.display = "none";
  document.getElementById("gameOverPrompt").style.display = "none";
  document.getElementById("gameWonPrompt").style.display = "none";
  document.querySelector(".answers").style.display = "grid";

  document.getElementById("reward-status").innerHTML =
    `💰 Kérdés ${data.question_number}/15 – Nyeremény: <strong>${data.reward} Ft</strong>` +
    (data.milestones.includes(data.question_number)
      ? " – 🎯 <strong>Garantált összeg!</strong>"
      : "");

  renderRewardLadder(data.question_number, data.milestones);
  startCountdown(5);

}

async function submitAnswer(key, btn) {
  if (selectedAnswer) return;
  selectedAnswer = key;
  playSound("audio-check", 5);

  document.querySelectorAll(".answers button").forEach(b => b.disabled = true);
  btn.classList.add("selected");

  await fetch('/millionare-api/submit_answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, answer: key })
  });

  await showCheckFeedback(); 
}

async function showCheckFeedback() {
  // 1. lekéri a választ
  const res = await fetch(`/millionare-api/check_answer?game_id=${gameId}`);
  const data = await res.json();

  // 2. 5 másodpercig csak sárgán maradjon a kiválasztott válasz
  await delay(5000); // drámai hatásszünet

  // 3. ezután színezzük a gombokat helyes/hibás szerint
  for (const b of document.querySelectorAll(".answers button")) {
    const k = b.dataset.key;
    if (k === data.correct_answer) {
      b.classList.remove("selected");
      b.classList.add("correct");
    } else if (k === selectedAnswer) {
      b.classList.remove("selected");
      b.classList.add("incorrect");
    }
  }

  // 4. majd jöjjön a megfelelő zene és prompt
  if (data.is_correct) {
    clearInterval(countdownInterval);
    playSound("audio-correct");
    await delay(2000);

    if (currentQuestionIndex === 15) {
      const finalState = await getGameState();
      showEnd(finalState);
    } else {
      document.getElementById("continuePrompt").style.display = "block";
    }
  } else {
    playSound("audio-lose");
    await delay(5000); // zene vége után jelenjen meg a vég prompt
    document.getElementById("gameOverPrompt").style.display = "block";
  }
}

async function confirmNextQuestion() {
  playSound("audio-next", 5);
  document.getElementById("continuePrompt").style.display = "none";

  await fetch('/millionare-api/next_question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId })
  });

  await delay(5000); // 💡 10 mp helyett 5 mp
  loadQuestion();
}

async function stopGame() {
  await fetch('/millionare-api/end_game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId })
  });
  playSound("audio-win");
  alert('Játék vége!');
  window.location.href = 'top10.html';
}

async function goToToplist() {
  await fetch('/millionare-api/end_game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId })
  });
  window.location.href = 'top10.html';
}

function showEnd(data) {
  playSound("audio-win");
  document.getElementById("question").innerText = "🎉 VÉGE 🎉";
  document.querySelector('.answers').style.display = "none";
  document.getElementById("reward-status").innerText = `Összes nyereményed: ${data.score} Ft`;
  document.getElementById("gameWonPrompt").style.display = "block";
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function useFiftyHelp() {
  const btn = document.getElementById("btn-fifty");
  btn.disabled = true;
  btn.innerText = "50:50 folyamatban...";

  await fetch('/millionare-api/use_help', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, help: "fifty" })
  });

  const state = await getGameState();
  const correct = state.correct;
  const options = ["A", "B", "C", "D"].filter(k => k !== correct);
  fiftyHiddenOptions = shuffle(options).slice(0, 2);

  fiftyHiddenOptions.forEach(k => {
    const b = document.getElementById("btn" + k);
    if (b) b.style.display = "none";
  });

  btn.innerText = "50:50 Használva";
}

async function usePhoneHelp() {
  const btn = document.getElementById("btn-phone");
  btn.disabled = true;
  btn.innerText = "📞 Folyamatban...";

  const resHelp = await fetch('/millionare-api/use_help', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, help: "phone" })
  });

  const result = await resHelp.json();
  if (result.error) {
    alert("❗ A telefonos segítséget már használtad.");
    btn.innerText = "📞 Használva";
    return;
  }

  const res = await fetch(`/millionare-api/get_phone_help?game_id=${gameId}`);
  const data = await res.json();

  const dialogBox = document.getElementById("phone_help_dialog");
  dialogBox.innerHTML = "";
  dialogBox.style.background = "#111";
  dialogBox.style.color = "white";
  dialogBox.style.padding = "1rem";
  dialogBox.style.border = "2px solid orange";
  dialogBox.style.marginTop = "2rem";
  dialogBox.style.display = "block";

  if (data.dialogue) {
    for (const line of data.dialogue) {
      const p = document.createElement("p");
      p.innerText = "📞 " + line;
      dialogBox.appendChild(p);
      await delay(2000);
    }
  } else {
    dialogBox.innerHTML = "<p>📞 Nem sikerült kapcsolódni.</p>";
  }

  btn.innerText = "📞 Használva";
}

async function useAudienceHelp() {
  const btn = document.getElementById("btn-audience");
  btn.disabled = true;
  btn.innerText = "👥 Folyamatban...";

  await fetch('/millionare-api/use_help', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, help: "audience" })
  });

  await renderAudienceChart();
  btn.innerText = "👥 Használva";
}

async function renderAudienceChart() {
  const res = await fetch(`/millionare-api/get_votes?game_id=${gameId}`);
  const data = await res.json();

  const wrapper = document.getElementById("audience-chart-wrapper");
  const chart = document.getElementById("audience-chart");
  wrapper.style.display = "block";
  chart.innerHTML = "";

  for (const [letter, count] of Object.entries(data)) {
    const bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.flexDirection = "column";
    bar.style.alignItems = "center";
    bar.innerHTML = `
      <div style="height: ${10 + count * 10}px; width: 30px; background: gold; margin-bottom: 0.5rem;"></div>
      <div style="color: #0ff; font-weight: bold;">${letter}</div>
      <div style="color: #aaa;">${count}</div>
    `;
    chart.appendChild(bar);
  }
}

async function renderRewardLadder(current, milestones) {
  const res = await fetch("/millionare/reward.json");
  const rewards = await res.json();
  const ladder = rewards
    .map((r, i) => {
      const level = i + 1;
      let style = "";
      if (level === current) {
        style = "font-weight:bold; color: yellow;";
      } else if (milestones.includes(level)) {
        style = "color: white;";
      }
      return `<div style="${style}">${level}. ${r.Reward} Ft</div>`;
    })
    .reverse()
    .join("");
  document.getElementById("reward-ladder").innerHTML = ladder;
}

function startCountdown(minutes) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  let seconds = minutes * 60;
  const timerEl = document.getElementById('countdown-timer');

  function updateTimer() {
    const min = String(Math.floor(seconds / 60)).padStart(2, '0');
    const sec = String(seconds % 60).padStart(2, '0');
    timerEl.innerText = `⏳ ${min}:${sec}`;
    if (seconds <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      alert("⏰ Lejárt az idő!");
      stopGame();
    }
    seconds--;
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}


// indulás
window.addEventListener("load", () => {

if (playerName) {
  fetch('/millionare-api/register_player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, name: playerName })
  });
}

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    alert("❌ A másolás le van tiltva ezen az oldalon.");
  }
});

document.addEventListener('copy', function(e) {
  e.preventDefault();
});

  document.getElementById("audio-bg")?.play().catch(() => {});
  loadQuestion();
});