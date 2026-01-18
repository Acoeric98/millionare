from flask import Flask, request, jsonify, send_from_directory
import json
import os
import random
import string
import time

app = Flask(__name__)

# --- Config ---
GAMES_FOLDER = "games"
QUESTIONS_FILE = "questions.json"
TOP10_FILE = "top10.json"
REWARD_FILE = "reward.json"

os.makedirs(GAMES_FOLDER, exist_ok=True)

# --- Helper functions ---


def get_guaranteed_reward(index, milestones, reward_table):
    highest = 0
    for m in milestones:
        if m <= index:
            highest = reward_table[m - 1]["Reward"]
    return int(highest)


def update_single_top10(player_name, score):
    SINGLE_TOP10_FILE = "single_top10.json"
    if not os.path.exists(SINGLE_TOP10_FILE):
        top10 = []
    else:
        with open(SINGLE_TOP10_FILE, "r", encoding="utf-8") as f:
            top10 = json.load(f)
    top10.append({"name": player_name, "score": score})
    top10 = sorted(top10, key=lambda x: x["score"], reverse=True)[:10]
    with open(SINGLE_TOP10_FILE, "w", encoding="utf-8") as f:
        json.dump(top10, f, indent=2)


def generate_game_id(prefix="MIL", length=4):
    return f"{prefix}-" + ''.join(random.choices(string.digits, k=length))


def load_questions():
    with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_rewards():
    with open(REWARD_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def create_game_state(mode="multi"):
    questions = load_questions()
    question_order = random.sample([q["id"] for q in questions], 15)
    return {
        "mode": mode,
        "question_order": question_order,
        "ready_for_next": True,
        "current_index": 0,
        "player_name": None,
        "used_helps": {
            "fifty": False,
            "phone": False,
            "audience": False
        },
        "answers": {},
        "audience_votes": {},
        "status": "waiting",
        "score": 0,
        "check_performed": False,
        "help_history": []   # <-- EZ AZ ÚJ
    }


def save_game(game_id, data):
    with open(f"{GAMES_FOLDER}/{game_id}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def load_game(game_id):
    with open(f"{GAMES_FOLDER}/{game_id}.json", "r", encoding="utf-8") as f:
        return json.load(f)


def update_top10(player_name, score):
    if not os.path.exists(TOP10_FILE):
        top10 = []
    else:
        with open(TOP10_FILE, "r", encoding="utf-8") as f:
            top10 = json.load(f)
    top10.append({"name": player_name, "score": score})
    top10 = sorted(top10, key=lambda x: x["score"], reverse=True)[:10]
    with open(TOP10_FILE, "w", encoding="utf-8") as f:
        json.dump(top10, f, indent=2)


@app.route("/active_games")
def active_games():
    result = []
    for filename in os.listdir(GAMES_FOLDER):
        if filename.endswith(".json"):
            path = os.path.join(GAMES_FOLDER, filename)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                result.append({
                    "game_id": filename.replace(".json", ""),
                    "player_name": data.get("player_name", "Ismeretlen")
                })
    return jsonify(result)


@app.route("/create_game")
def create_game():
    mode = request.args.get("mode", "multi")
    prefix = "SNG" if mode == "single" else "MIL"
    game_id = generate_game_id(prefix=prefix)
    game_state = create_game_state(mode=mode)
    player_name = request.args.get("player_name")
    if player_name:
        game_state["player_name"] = player_name
    save_game(game_id, game_state)
    return jsonify({"game_id": game_id})


@app.route("/get_question")
def get_question():
    game_id = request.args.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        questions = load_questions()
        rewards = load_rewards()
        current_index = game["current_index"]

        # Ha az utolsó kérdés már megválaszolt és ellenőrizve van, automatikus
        # győzelem
        if current_index == 14 and game.get(
                "check_performed") and game.get("score", 0) >= 1000000:
            game["status"] = "ended"
            save_game(game_id, game)
            if game.get("mode") == "single":
                update_single_top10(game["player_name"], game.get("score", 0))
            else:
                update_top10(game["player_name"], game.get("score", 0))
        # Fájl TÖRLÉS NINCS ITT
            return jsonify({
                "status": "ended",
                "won": True,
                "score": game["score"],
                "help_history": game.get("help_history", [])
            })

        # Ha minden kérdés elfogyott (hibás állapot)
        if current_index >= len(game["question_order"]):
            game["status"] = "ended"
            save_game(game_id, game)
            if game.get("mode") == "single":
                update_single_top10(game["player_name"], game.get("score", 0))
            else:
                update_top10(game["player_name"], game.get("score", 0))
            os.remove(f"{GAMES_FOLDER}/{game_id}.json")
            return jsonify({
                "status": "ended",
                "won": True,
                "score": game["score"]
            })

        current_id = game["question_order"][current_index]
        question = next(q for q in questions if q["id"] == current_id)

        return jsonify({
            "question": question["question"],
            "answers": question["answers"],
            "question_number": current_index + 1,
            "correct": question["correct"],
            "status": game["status"],
            "checked": game.get("check_performed", False),
            "check_performed": game.get("check_performed", False),
            "check_feedback_visible": game.get("check_feedback_visible", False),
            "player_answer": game["answers"].get(str(current_index)),
            "timer_start": game.get("timer_start"),
            "used_helps": game.get("used_helps", {}),
            "reward": rewards[current_index]["Reward"],
            "milestones": [5, 10, 15],
            "fifty_removed": game.get("fifty_removed", []),
            "ready_for_next": game.get("ready_for_next", True),
            "help_history": game.get("help_history", [])  # 💥 EZT TEDD HOZZÁ
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/submit_answer", methods=["POST"])
def submit_answer():
    data = request.get_json()
    game_id = data.get("game_id")
    answer = data.get("answer")
    if not game_id or not answer:
        return "Missing game_id or answer", 400
    try:
        game = load_game(game_id)
        index = game["current_index"]
        game["answers"][str(index)] = answer
        game["status"] = "answered"
        game["check_performed"] = False
        save_game(game_id, game)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/check_answer")
def check_answer():
    game_id = request.args.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        index = game["current_index"]
        answer = game["answers"].get(str(index))
        if not answer:
            return jsonify({"error": "No answer submitted yet"})
        questions = load_questions()
        current_id = game["question_order"][index]
        question = next(q for q in questions if q["id"] == current_id)
        correct = question["correct"]
        is_correct = (answer == correct)
        if is_correct:
            game["score"] += 100000
        else:
            # Garantált nyeremény logika
            rewards = load_rewards()
            milestones = [5, 10, 15]
            guaranteed = get_guaranteed_reward(index + 1, milestones, rewards)
            game["score"] = guaranteed
            game["status"] = "ended"

        # Ezek minden esetben kellenek
        game["check_performed"] = True
        game["ready_for_next"] = False
        game["check_feedback_visible"] = False  # ÚJ FLAG

        save_game(game_id, game)
        return jsonify({
            "player_answer": answer,
            "correct_answer": correct,
            "is_correct": is_correct,
            "status": game["status"],
            "checked": True
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/mark_feedback_seen", methods=["POST"])
def mark_feedback_seen():
    data = request.get_json()
    game_id = data.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        # 💣 Védelem: csak akkor engedjük, ha már check_performed = True
        if not game.get("check_performed", False):
            return jsonify({"error": "Answer has not been checked yet"}), 400
        game["check_feedback_visible"] = True
        save_game(game_id, game)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/next_question", methods=["POST"])
def next_question():
    data = request.get_json()
    game_id = data.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        if game["current_index"] + 1 >= len(game["question_order"]):
            return jsonify({"status": "end", "message": "No more questions"})
        game["current_index"] += 1
        game["status"] = "waiting"
        game["check_performed"] = False
        game["ready_for_next"] = False
        game["fifty_removed"] = []              # 🔁 reseteljük az 50:50-et
        game["audience_votes"] = {
            k: 0 for k in [
                "A",
                "B",
                "C",
                "D"]}  # 🔁 nullázzuk a szavazatokat
        game["used_helps"]["audience"] = False  # ✅ fontos
        save_game(game_id, game)
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/end_game", methods=["POST"])
def end_game():
    data = request.get_json()
    game_id = data.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        if not game.get("player_name"):
            game["player_name"] = "Ismeretlen"
        if game.get("mode") == "single":
            update_single_top10(game["player_name"], game.get("score", 0))
        else:
            update_top10(game["player_name"], game.get("score", 0))
        os.remove(f"{GAMES_FOLDER}/{game_id}.json")
        return jsonify({"status": "game ended"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/submit_vote", methods=["POST"])
def submit_vote():
    data = request.get_json()
    game_id = data.get("game_id")
    vote = data.get("vote")
    if not game_id or vote not in ["A", "B", "C", "D"]:
        return "Missing or invalid parameters", 400
    try:
        game = load_game(game_id)
        game["audience_votes"][vote] = game["audience_votes"].get(vote, 0) + 1
        save_game(game_id, game)
        return jsonify({"status": "vote recorded"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/use_help", methods=["POST"])
def use_help():
    data = request.get_json()
    game_id = data.get("game_id")
    help_type = data.get("help")
    if not game_id or help_type not in ["fifty", "phone", "audience"]:
        return "Missing or invalid parameters", 400
    try:
        game = load_game(game_id)
        if game["used_helps"].get(help_type):
            return jsonify({"error": "Help already used"}), 400
        game["used_helps"][help_type] = True

        if help_type == "audience":
            for key in ["A", "B", "C", "D"]:
                game["audience_votes"].setdefault(key, 0)

            # 🎯 SINGLEPLAYER mód – szimulált közönségszavazás
            if game["mode"] == "single":
                questions = load_questions()
                current_id = game["question_order"][game["current_index"]]
                question = next(q for q in questions if q["id"] == current_id)
                correct = question["correct"]

                is_correct = random.random() < 0.9
                main = correct if is_correct else random.choice(
                    [k for k in ["A", "B", "C", "D"] if k != correct])
                others = [k for k in ["A", "B", "C", "D"] if k != main]

                votes = {k: 0 for k in ["A", "B", "C", "D"]}
                votes[main] = random.randint(35, 50)
                remaining = 75 - votes[main]

                for k in others:
                    votes[k] = random.randint(0, remaining)
                    remaining -= votes[k]
                if remaining > 0:
                    votes[random.choice(others)] += remaining

                game["audience_votes"] = votes

        # 📝 segítség naplózása minden esetben, de csak egyszer
        game.setdefault("help_history", []).append({
            "type": help_type,
            "question_index": game["current_index"],
            "timestamp": time.time()
        })

        if help_type == "fifty":
            questions = load_questions()
            current_id = game["question_order"][game["current_index"]]
            question = next(q for q in questions if q["id"] == current_id)
            correct = question["correct"]
            options = ["A", "B", "C", "D"]
            removed = random.sample([o for o in options if o != correct], 2)
            game["fifty_removed"] = removed

        save_game(game_id, game)
        return jsonify({"status": "help activated"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/start_timer", methods=["POST"])
def start_timer():
    data = request.get_json()
    game_id = data.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        game["timer_start"] = time.time()
        save_game(game_id, game)
        return jsonify({"status": "timer started"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/get_phone_help")
def get_phone_help():
    game_id = request.args.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        with open("phone_calls.json", "r", encoding="utf-8") as f:
            calls = json.load(f)

        game = load_game(game_id)
        if game["mode"] != "single":
            return jsonify({"error": "Only for singleplayer"}), 400

        questions = load_questions()
        current_id = game["question_order"][game["current_index"]]
        question = next(q for q in questions if q["id"] == current_id)
        correct = question["correct"]

        # 90% eséllyel helyes, 10%-ban rossz választ ajánl
        is_correct = random.random() < 0.9
        suggested = correct if is_correct else random.choice([k for k in ["A", "B", "C", "D"] if k != correct])

        # Véletlen párbeszéd kiválasztása és sablon lecserélése
        selected = random.choice(calls)
        dialogue = [line.replace("{{suggested}}", suggested) for line in selected["dialogue"]]

        return jsonify({"dialogue": dialogue})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@app.route("/get_votes")
def get_votes():
    game_id = request.args.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        votes = game.get("audience_votes", {})
        result = {letter: votes.get(letter, 0)
                  for letter in ["A", "B", "C", "D"]}
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/register_player", methods=["POST"])
def register_player():
    data = request.get_json()
    game_id = data.get("game_id")
    name = data.get("name")
    if not game_id or not name:
        return "Missing parameters", 400
    try:
        game = load_game(game_id)
        game["player_name"] = name
        save_game(game_id, game)
        return jsonify({"status": "name saved"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/reward.json')
def get_reward_json():
    return send_from_directory('.', 'reward.json')


@app.route("/allow_next", methods=["POST"])
def allow_next():
    data = request.get_json()
    game_id = data.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        game["ready_for_next"] = True
        save_game(game_id, game)
        return jsonify({"status": "next allowed"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/show_decision", methods=["POST"])
def show_decision():
    data = request.get_json()
    game_id = data.get("game_id")
    if not game_id:
        return "Missing game_id", 400
    try:
        game = load_game(game_id)
        if not game.get("check_performed", False):
            return jsonify({"error": "Answer has not been checked yet"}), 400
        game["status"] = "show_decision"
        save_game(game_id, game)
        return jsonify({"status": "decision_shown"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5002, debug=True)
