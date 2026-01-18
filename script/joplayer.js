    function joinGame() {
  const gameId = document.getElementById('gameIdInput').value.trim().toUpperCase();
  const playerName = document.getElementById('nameInput').value.trim();

  if (!gameId) {
    alert('Kérlek, add meg a Game ID-t!');
    return;
  }
  if (!playerName) {
    alert('Kérlek, add meg a neved!');
    return;
  }

  playSound("audio-next");  // 🔊 Hozzáadva

  // késleltetett átirányítás, hogy lejátszhassa a hangot
  setTimeout(() => {
    window.location.href = `player.html?game_id=${gameId}&name=${encodeURIComponent(playerName)}`;
  }, 2000); // kb. 2.0 mp elég
}
    function playSound(id) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(e => console.warn("Hanglejátszási hiba:", e));
  }
}