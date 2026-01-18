let gameId = null;

    async function loadGameList() {
      const res = await fetch('/millionare-api/active_games');
      const data = await res.json();
      const gameList = document.getElementById("gameList");
      gameList.innerHTML = "";

      if (data.length === 0) {
        gameList.innerText = "Jelenleg nincs aktív játék.";
        return;
      }

      data.forEach(game => {
        const div = document.createElement("div");
        div.className = "game-item";
        div.innerText = `${game.game_id} – ${game.player_name}`;
        div.onclick = () => selectGame(game.game_id);
        gameList.appendChild(div);
      });
    }

    async function selectGame(selectedId) {
      gameId = selectedId;
      document.getElementById("gameList").style.display = "none";
      document.getElementById("voteSection").style.display = "block";
      await loadQuestion();
    }

    async function loadQuestion() {
      const res = await fetch(`/millionare-api/get_question?game_id=${gameId}`);
      const data = await res.json();
      document.getElementById("questionText").innerText = data.question;

      const list = document.getElementById("answersList");
      list.innerHTML = "";
      for (const [key, value] of Object.entries(data.answers)) {
        const li = document.createElement("li");
        li.innerText = `${key}) ${value}`;
        list.appendChild(li);
      }
    }

    async function vote(option) {
      await fetch('/millionare-api/submit_vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, vote: option })
      });
      document.querySelector('.vote-buttons').style.display = 'none';
      document.getElementById('thankyou').style.display = 'block';
    }

    loadGameList();