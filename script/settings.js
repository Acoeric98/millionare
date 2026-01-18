    function toggleMusic() {
      const enabled = document.getElementById('musicToggle').checked;
      localStorage.setItem('music_enabled', enabled ? 'yes' : 'no');
      alert(enabled ? 'Zene bekapcsolva!' : 'Zene kikapcsolva!');
    }

    window.onload = () => {
      const music = localStorage.getItem('music_enabled');
      if (music === 'yes') {
        document.getElementById('musicToggle').checked = true;
      }
    };