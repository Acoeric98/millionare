    async function startHost() {
      const res = await fetch('/millionare-api/create_game?mode=multi');
      const data = await res.json();
      const gameId = data.game_id;
      document.getElementById('gameId').innerText = `Game ID: ${gameId}`;
      setTimeout(() => {
        window.location.href = `host.html?game_id=${gameId}`;
      }, 2000);
    }