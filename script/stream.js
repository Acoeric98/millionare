const chart = document.getElementById("audience-chart");
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('game_id');
let currentQuestionIndex = null;

function playSound(id) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

async function loadQuestion() {
  if (!gameId) return;

  const res = await fetch(`/millionare-api/get_question?game_id=${gameId}`);
  const data = await res.json();

  if (!data || !data.question) {
    document.getElementById('question').innerText = 'A játék befejeződött.';
    document.getElementById('answers').innerHTML = '';
    document.getElementById("audience-chart").innerHTML = '';
    document.getElementById("audience-chart-wrapper").style.display = "none";
    document.getElementById('help-status').innerHTML = '';
    setTimeout(() => {
      window.location.href = '/millionare/templates/top10.html';
    }, 10000);
    return;
  }

  const qNum = parseInt(data.question_number);
  const helpHistory = Array.isArray(data.help_history) ? data.help_history : [];

  const audienceHelpUsed = helpHistory.some(h => h.type === "audience");
  const audienceHelpUsedThisQuestion = helpHistory.some(h => h.type === "audience" && h.question_index === qNum - 1);

  if (data.ready_for_next === false && qNum !== currentQuestionIndex) return;

  if (qNum !== currentQuestionIndex) {
    currentQuestionIndex = qNum;
    playSound("audio-next");
    document.getElementById("audience-chart").innerHTML = '';
    document.getElementById("audience-chart-wrapper").style.display = "none";
  }

  document.getElementById('question').innerText = data.question;
  const answersDiv = document.getElementById('answers');
  answersDiv.innerHTML = '';

  for (const [key, value] of Object.entries(data.answers)) {
    const div = document.createElement('div');
    div.setAttribute('data-key', key);
    div.innerText = `${key}) ${value}`;

    if (Array.isArray(data.fifty_removed) && data.fifty_removed.includes(key)) {
      div.classList.add("fifty-removed");
    }

    if (data.player_answer === key && data.check_performed === false) {
      div.classList.add("selected");
    }

    answersDiv.appendChild(div);
  }

  // 🔔 Színes segítségek megjelenítése badge-ekkel
  const helpStatus = document.getElementById("help-status");
  helpStatus.innerHTML = ""; // reset

  const helpsText = [];
  if (helpHistory.some(h => h.type === "fifty")) helpsText.push("🔪 50:50");
  if (helpHistory.some(h => h.type === "phone")) helpsText.push("📞 Telefon");
  if (helpHistory.some(h => h.type === "audience")) helpsText.push("👥 Közönség");

  if (helpsText.length > 0) {
    const container = document.createElement("div");
    container.className = "help-badges";
    helpsText.forEach(text => {
      const badge = document.createElement("div");
      badge.className = "help-badge";
      badge.innerText = text;
      container.appendChild(badge);
    });
    helpStatus.appendChild(container);
  } else {
    helpStatus.innerHTML = `<div style="color: gray; font-weight: bold;">Nincs segítség használva</div>`;
  }

  // 📊 Közönség chart (csak ha az adott kérdéshez használták)
  const playerHasNotAnswered = typeof data.player_answer === "undefined" || data.player_answer === null;

  if (audienceHelpUsedThisQuestion && qNum === currentQuestionIndex) {
    const voteRes = await fetch(`/millionare-api/get_votes?game_id=${gameId}`);
    const voteData = await voteRes.json();
    const hasVotes = Object.values(voteData).some(val => val > 0);

    const wrapper = document.getElementById("audience-chart-wrapper");
    if (wrapper) wrapper.style.display = "block";
    chart.innerHTML = "";

    if (hasVotes) {
      for (const [letter, count] of Object.entries(voteData)) {
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
        chart.appendChild(bar);
      }
    } else if (playerHasNotAnswered) {
      chart.innerHTML = `<div style="color: gold; font-size: 1.2rem;">Szavazás folyamatban – a nézők most szavazhatnak! 👥✅</div>`;
    }
  }

  // ✅ Ellenőrzés visszajelzés
  if (data.check_performed && data.correct) {
    const answerElems = document.querySelectorAll(".answers div");
    answerElems.forEach(div => {
      const key = div.getAttribute("data-key");
      if (key === data.correct) {
        div.classList.remove("incorrect", "selected");
        div.classList.add("correct");
        playSound("audio-correct");
      } else if (key === data.player_answer) {
        div.classList.remove("selected");
        div.classList.add("incorrect");
        playSound("audio-lose");
      }
    });
  }

  // ⏱ Telefonos visszaszámláló
  const timerDiv = document.getElementById("stream-timer");
  if (helpHistory.some(h => h.type === "phone") && data.timer_start) {
    const elapsed = Date.now() / 1000 - data.timer_start;
    const remaining = Math.max(0, Math.ceil(45 - elapsed));
    timerDiv.innerText = remaining > 0
      ? `📞 Telefonos segítség hátralévő idő: ${remaining} mp`
      : "";
  } else {
    timerDiv.innerText = "";
  }
}

if (gameId) {
  document.getElementById("audio-bg")?.play().catch(()=>{});
  loadQuestion();
  setInterval(loadQuestion, 3000);
} else {
  // 👇 EZT TEGYÜK VISSZA
  document.getElementById('question').innerText = 'Nincs game_id megadva!';
  const gameListDiv = document.createElement('div');
  gameListDiv.style.marginTop = '2rem';
  document.body.appendChild(gameListDiv);
  fetch('/millionare-api/active_games')
    .then(res => res.json())
    .then(data => {
      gameListDiv.innerHTML = '<h2 style="color: gold;">Aktív játékok:</h2>';
      data.forEach(game => {
        const btn = document.createElement('button');
        btn.innerText = `${game.game_id} – ${game.player_name}`;
        btn.style.margin = '0.5rem';
        btn.style.padding = '0.8rem 1.5rem';
        btn.style.fontSize = '1.1rem';
        btn.style.backgroundColor = '#111';
        btn.style.color = '#0f0';
        btn.style.border = '2px solid #0f0';
        btn.style.borderRadius = '8px';
        btn.style.cursor = 'pointer';
        btn.onmouseover = () => btn.style.backgroundColor = '#0f0';
        btn.onmouseout = () => btn.style.backgroundColor = '#111';
        btn.onclick = () => {
          window.location.href = `stream.html?game_id=${game.game_id}`;
        };
        gameListDiv.appendChild(btn);
      });
    });
}