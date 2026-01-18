const gameId = new URLSearchParams(window.location.search).get('game_id');
  document.getElementById('gameIdDisplay').innerText = `Játék azonosító: ${gameId}`;

  async function getLatestGameState() {
    const res = await fetch(`/millionare-api/get_question?game_id=${gameId}`);
    return await res.json();
  }

  async function loadQuestion() {
    const res = await fetch(`/millionare-api/get_question?game_id=${gameId}`);
    const data = await res.json();
    document.getElementById('question').innerText = `(${data.question_number}) ${data.question}`;
    const answers = data.answers;
    const answersDiv = document.getElementById('answers');
    answersDiv.innerHTML = '';
    for (const [key, value] of Object.entries(answers)) {
      const p = document.createElement('p');
      p.className = 'answer';
      p.innerHTML = `<span>${key}</span> ${value}`;
      answersDiv.appendChild(p);
    }
    document.getElementById('correctAnswer').innerText = `Helyes válasz: ${data.correct}`;

    const data2 = await getLatestGameState();
    const statusDiv = document.getElementById('player-status');
    if (data2.player_answer) {
      statusDiv.innerText = `Játékos választása: ${data2.player_answer}`;
    } else {
      statusDiv.innerText = 'Játékos még nem válaszolt.';
    }
  }

  async function checkAnswer() {
    const res = await fetch(`/millionare-api/check_answer?game_id=${gameId}`);
    const data = await res.json();

    if (data.error) {
      alert('Nincs válasz, amit ellenőrizni lehet!');
      return;
    }

    const statusDiv = document.getElementById('player-status');
    statusDiv.innerText = data.player_answer
      ? `Válasz: ${data.player_answer} → ${data.is_correct ? '✔ HELYES' : '❌ HELYTELEN'} (Helyes: ${data.correct_answer})`
      : 'Még nincs válasz';

    if (!data.is_correct) {
      statusDiv.innerText += "\n❌ Helytelen válasz! Nemsokára a toplistára ugrunk...";
      setTimeout(async () => {
        await fetch('/millionare-api/end_game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game_id: gameId })
        });
        window.location.href = 'top10.html';
      }, 3000); // 3 másodperc késleltetés
      return;
    }

    document.getElementById('nextBtn').disabled = false;
  }

  async function nextQuestion() {
    await fetch('/millionare-api/next_question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId })
    });
    document.getElementById('nextBtn').disabled = true;
    document.getElementById('player-status').innerText = 'Várakozás a játékosra...';
    await loadQuestion();
  }

  async function loadPlayerStatus() {
    const data = await getLatestGameState();
    const statusDiv = document.getElementById('player-status');
    if (data.player_answer) {
      statusDiv.innerText = `Játékos választása: ${data.player_answer}`;
    } else {
      statusDiv.innerText = 'Játékos még nem válaszolt.';
    }
    if (data.used_helps && data.used_helps.phone) {
  const now = Date.now() / 1000;
  const timerStarted = data.timer_start || 0;
  if (timerStarted === 0) {
    statusDiv.innerText += "\n📞 Telefonos segítség kérve, de időzítő még nem indult!";
  } else if (now - timerStarted < 45) {
    statusDiv.innerText += "\n📞 Telefonos segítség aktiválva!";
  } else {
    statusDiv.innerText += "\n📞 Telefonos segítség lejárt.";
  }
}
  }

  
  async function startTimer() {
  await fetch('/millionare-api/start_timer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game_id: gameId })
  });
  alert("⏱ Timer elindítva a játékosnál!");
}

  loadQuestion();
  setInterval(loadPlayerStatus, 3000);