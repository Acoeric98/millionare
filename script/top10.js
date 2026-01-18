 async function loadTop10() {
      const res = await fetch('/millionare/top10.json');
      const data = await res.json();
      const tbody = document.querySelector('#top10 tbody');
      tbody.innerHTML = '';
      data.sort((a, b) => b.score - a.score);
      data.slice(0, 10).forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${index + 1}</td><td>${entry.name}</td><td>${entry.score.toLocaleString()} Ft</td>`;
        tbody.appendChild(row);
      });
    }
    
  async function loadSingleTop10() {
  const res = await fetch('/millionare/single_top10.json');
  const data = await res.json();
  const tbody = document.querySelector('#top10s tbody');
  tbody.innerHTML = '';
  data.sort((a, b) => b.score - a.score);
  data.slice(0, 10).forEach((entry, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${index + 1}</td><td>${entry.name}</td><td>${entry.score.toLocaleString()} Ft</td>`;
    tbody.appendChild(row);
  });
}

loadTop10();
loadSingleTop10();