    async function startSingle() {
      const playerName = document.getElementById('playerName').value.trim();
      if (!playerName) {
        alert('Kérlek, add meg a neved!');
        return;
      }
      const res = await fetch(`/millionare-api/create_game?mode=single&player_name=${encodeURIComponent(playerName)}`);
      const data = await res.json();
      const gameId = data.game_id;
      window.location.href = `singleplayer.html?game_id=${gameId}&name=${encodeURIComponent(playerName)}`;
    }