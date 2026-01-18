# Legyen Ön is Milliomos – webes játék

Ez a projekt egy Flask alapú háttérszolgáltatást és statikus HTML/CSS/JS felületet tartalmaz a „Legyen Ön is Milliomos” kvízjátékhoz. A frontend a `/millionare` útvonal alól töltődik, a backend végpontok pedig a `/millionare-api` prefixen keresztül hívódnak (a jelenlegi JS kód ezt várja).

## Fő funkciók

- **Single- és multiplayer mód** (külön host és játékos nézetekkel).
- **Segítségek**: 50:50, telefon, közönség (utóbbi single módban szimulálva).
- **Toplista** (single és multi külön tárolva).
- **Nyeremény létra** és garantált szintek.

## Projektstruktúra

- `app.py` – Flask API a játékállapot kezelésére és a logikára.
- `templates/` – HTML oldalak (menü, host, játékos, szabályok, toplista stb.).
- `script/` – frontend logika (fetch hívások, játékmenet).
- `style/` – CSS stílusok.
- `audio/` – hangok.
- `img/` – képek.
- Adatfájlok:
  - `questions.json` – kérdésbank.
  - `reward.json` – nyeremény létra.
  - `top10.json` / `single_top10.json` – toplista.
  - `phone_calls.json` – telefonos segítség dialógusai.

## Futtatás (lokális fejlesztés)

### 1) Backend indítása

```bash
python -m venv .venv
source .venv/bin/activate
pip install flask
python app.py
```

Alapértelmezetten a backend a `http://localhost:5002` címen fut, a végpontok a gyökérből érhetők el (például `/get_question`).

### 2) Frontend kiszolgálása

A HTML fájlok és a statikus erőforrások abszolút útvonalakkal hivatkoznak (például `/millionare/style/...`), ezért érdemes a repó szülőkönyvtárából kiszolgálni a statikus fájlokat:

```bash
cd ..
python -m http.server 8000
```

Majd nyisd meg a böngészőben:

```
http://localhost:8000/millionare/templates/menu.html
```

### 3) API útvonalak bekötése

A frontend a `/millionare-api` prefixet használja (például `/millionare-api/get_question`). Ehhez javasolt egy fordított proxy vagy átirányítás:

- **Nginx példa**:

```nginx
location /millionare/ {
    alias /path/to/millionare/;
}

location /millionare-api/ {
    proxy_pass http://127.0.0.1:5002/;
}
```

Ha nem használsz proxyt, akkor vagy módosítsd a JS-ben az API hivatkozásokat, vagy adj hozzá egy helyi átirányítást (például `hosts`/proxy szinten).

## Megjegyzések

- A játékállapotok a `games/` könyvtárban jönnek létre JSON fájlokként.
- A toplisták és a beállítások szintén JSON fájlokban tárolódnak.
