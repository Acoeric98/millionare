let selectedAnswer = null;
let localAnswerJustSubmitted = false;
let alreadyChecked = false;
let currentQuestionIndex = null;
let pendingNewQuestion = false;
let fiftyHiddenOptions = [];
let lastAudienceChartQuestion = null;

const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('game_id');
const playerName = urlParams.get('name');
const isSingle = gameId.startsWith('SNG-');

function playSound(id) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(e => console.warn("Hanglejátszási hiba:", e));
  }
}

async function getLatestGameState() {
  const res = await fetch(`/millionare-api/get_question?game_id=${gameId}`);
  return await res.json();
}

async function loadQuestion(force = false) {
  const data = await getLatestGameState();
  if (data.error) return;

  if (data.status === "ended" && data.won) {
    playSound("audio-win");
    document.getElementById("question").innerText = "🎉 VÉGE 🎉";
    document.querySelector('.answers').style.display = "none";
    document.getElementById("reward-status").innerText = `Összes nyereményed: ${data.score} Ft`;
    document.getElementById("gameWonPrompt").style.display = "block";
    return;
  }

  if (data.status === "ended") return;

  if (!force && data.question_number !== null && data.question_number !== currentQuestionIndex && currentQuestionIndex !== null) {
    pendingNewQuestion = true;
    document.getElementById('continuePrompt').style.display = 'block';
    document.getElementById('question').style.opacity = 0;
    document.querySelector('.answers').style.opacity = 0;
    document.getElementById('controls').style.opacity = 0;
    return;
  }

  if (data.question_number !== currentQuestionIndex) {
    currentQuestionIndex = data.question_number;
    selectedAnswer = null;
    alreadyChecked = false;
    localAnswerJustSubmitted = false;
    fiftyHiddenOptions = [];

    // közönség chart eltüntetése (új kérdésnél)
    const chartWrapper = document.getElementById("audience-chart-wrapper");
    const chart = document.getElementById("audience-chart");
    if (chartWrapper) chartWrapper.style.display = "none";
    if (chart) chart.innerHTML = "";
  }

  if (!isSingle && data.check_performed && localAnswerJustSubmitted && data.player_answer === selectedAnswer) {
    alreadyChecked = true;
    localAnswerJustSubmitted = false;
    await showCheckFeedback();
  }

  if (data.status !== 'waiting') return;

  document.getElementById('continuePrompt').style.display = 'none';
  document.getElementById('question').style.opacity = 1;
  document.querySelector('.answers').style.opacity = 1;
  document.getElementById('controls').style.opacity = 1;

  document.getElementById('question').innerText = data.question;

  for (const [key, value] of Object.entries(data.answers)) {
    const btn = document.getElementById('btn' + key);
    btn.style.display = fiftyHiddenOptions.includes(key) ? "none" : "inline-block";
    btn.innerText = `${key}) ${value}`;
    btn.disabled = false;
    btn.className = '';
    btn.onclick = () => submitAnswer(key, btn);
  }

  document.getElementById('controls').style.display = 'block';

  if (data.timer_start) {
    const elapsed = Date.now() / 1000 - data.timer_start;
    const phoneBtn = document.getElementById("btn-phone");
    if (data.used_helps && data.used_helps.phone) {
      if (elapsed < 45) {
        if (!timerRunning) {
          startCircleTimer(Math.ceil(45 - elapsed));
        }
        if (phoneBtn) {
          phoneBtn.disabled = true;
          if (phoneBtn.innerText !== "📞 Használva") {
            phoneBtn.innerText = "📞 Folyamatban...";
          }
        }
      } else {
        if (phoneBtn) {
          phoneBtn.disabled = true;
          phoneBtn.innerText = "📞 Használva";
        }
      }
    }
  }

  if (data.used_helps && data.used_helps.audience) {
    const btn = document.getElementById("btn-audience");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "👥 Használva";
    }
    if (!document.getElementById("audience-chart")) {
      await renderAudienceChart();
    }
  }

  if (data.used_helps && data.used_helps.fifty) {
    const btn = document.getElementById("btn-fifty");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "50:50 Használva";
    }
  }

  document.getElementById('reward-status').innerHTML =
    `💰 Kérdés ${data.question_number}/15 – Nyeremény: <strong>${data.reward} Ft</strong>` +
    (data.milestones.includes(data.question_number)
      ? " – 🎯 <strong>Garantált összeg!</strong>"
      : "");

  await renderRewardLadder(data.question_number, data.milestones);
}

function confirmNextQuestion() {
  playSound("audio-next");
  document.getElementById('continuePrompt').style.display = 'none';
  pendingNewQuestion = false;
  loadQuestion(true);
}

async function submitAnswer(answerKey, btn) {
  if (selectedAnswer) return;
  selectedAnswer = answerKey;
  const buttons = document.querySelectorAll('.answers button');
  buttons.forEach(b => b.disabled = true);
  btn.classList.add('selected');
  playSound("audio-check");
  await fetch('/millionare-api/submit_answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, answer: answerKey })
  });
  if (isSingle) await showCheckFeedback();
  localAnswerJustSubmitted = true;
}

async function showCheckFeedback() {
  const checkRes = await fetch(`/millionare-api/check_answer?game_id=${gameId}`);
  const checkData = await checkRes.json();
  if (!checkData.correct_answer) return;

  const buttons = document.querySelectorAll('.answers button');
  buttons.forEach(b => {
    const key = b.getAttribute('data-key');
    if (key === checkData.correct_answer) {
      b.classList.remove('selected');
      b.classList.add('correct');
    } else if (key === selectedAnswer) {
      b.classList.remove('selected');
      b.classList.add('incorrect');
    }
  });

  if (!checkData.is_correct) {
    playSound("audio-lose");
    document.getElementById("gameOverPrompt").style.display = "block";
  } else {
    playSound("audio-correct");
    if (currentQuestionIndex === 1) {
      playSound("audio-win");
    }
  }
}

async function goToToplist() {
  await fetch('/millionare-api/end_game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId })
  });
  window.location.href = 'top10.html';
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

let timerInterval = null;
let timerRunning = false;

function startCircleTimer(seconds) {
  if (timerRunning) return;
  timerRunning = true;

  const circle = document.getElementById("progress");
  const text = document.getElementById("timeText");
  const container = document.getElementById("circle-timer");

  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = "0";
  container.style.display = "block";

  let timeLeft = seconds;
  text.textContent = timeLeft;

  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      text.textContent = "0";
      circle.style.strokeDashoffset = `${circumference}`;
      setTimeout(() => {
        container.style.display = "none";
      }, 1000);
    } else {
      text.textContent = timeLeft;
      const offset = circumference * (1 - timeLeft / seconds);
      circle.style.strokeDashoffset = offset;
    }
  }, 1000);
}

async function usePhoneHelp() {
  const btn = document.getElementById("btn-phone");
  btn.disabled = true;
  btn.innerText = "📞 Folyamatban...";
  const res = await fetch('/millionare-api/use_help', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, help: "phone" })
  });
  const data = await res.json();
  if (data.error) {
    alert("Hiba: " + data.error);
    btn.disabled = false;
    btn.innerText = "📞 Telefon";
  } else {
    alert("📞 A kérdezőt értesítettük!");
  }
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

  let container = document.getElementById("audience-chart");

  if (!container) {
    container = document.createElement("div");
    container.id = "audience-chart";
    container.style.marginTop = "2rem";
    container.style.display = "flex";
    container.style.justifyContent = "center";
    container.style.gap = "2rem";
    document.body.appendChild(container);
  }

  container.innerHTML = "";

  for (const [letter, count] of Object.entries(data)) {
    const bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.flexDirection = "column";
    bar.style.alignItems = "center";
    bar.innerHTML = `
      <div style="
        height: ${10 + count * 10}px;
        width: 30px;
        background: gold;
        margin-bottom: 0.5rem;
        transition: height 0.3s ease;
      "></div>
      <div style="color: #0ff; font-weight: bold;">${letter}</div>
      <div style="color: #aaa;">${count}</div>
    `;
    container.appendChild(bar);
  }
  document.getElementById("audience-chart-wrapper").style.display = "block";
}

async function useFiftyHelp() {
  const btn = document.getElementById("btn-fifty");
  btn.disabled = true;
  btn.innerText = "50:50 folyamatban...";

  const res = await fetch('/millionare-api/use_help', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, help: "fifty" })
  });

  const data = await res.json();
  if (data.error) {
    alert("Hiba: " + data.error);
    btn.disabled = false;
    btn.innerText = "50:50";
    return;
  }

  const correctAnswer = (await getLatestGameState()).correct;
  const options = ["A", "B", "C", "D"].filter(key => key !== correctAnswer);
  fiftyHiddenOptions = shuffle(options).slice(0, 2);

  fiftyHiddenOptions.forEach(key => {
    const btn = document.getElementById("btn" + key);
    if (btn) btn.style.display = "none";
  });

  btn.innerText = "50:50 Használva";
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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

function confirmNextQuestion() {
  playSound("audio-next");
  document.getElementById('continuePrompt').style.display = 'none';
  pendingNewQuestion = false;

  // ÚJ: Értesítjük a szervert, hogy mehet a következő kérdés
  fetch('/millionare-api/allow_next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId })
  }).then(() => loadQuestion(true));
}
async function registerPlayerName() {
  if (!playerName) return;
  await fetch('/millionare-api/register_player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId, name: playerName })
  });
}


(async () => {
  await registerPlayerName();
  document.getElementById("audio-bg")?.play().catch(()=>{});
  loadQuestion();
})();

setInterval(() => {
  if (!pendingNewQuestion) {
    loadQuestion();

    // ha a közönség segítséget már használták, frissítsük újra a chartot
    getLatestGameState().then(state => {
      if (state.used_helps && state.used_helps.audience) {
        renderAudienceChart();
      }
    });
  }
}, 3000);