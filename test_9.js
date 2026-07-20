
      function bjHit() {
        if (!bjState.active) return;
        bjState.playerHand.push(bjState.deck.pop());
        bjRender();
        if (bjGetScore(bjState.playerHand) > 21)
          bjEndGame("LOSE", "¡TE HAS PASADO!");
      }

      function bjStand() {
        if (!bjState.active) return;
        bjState.active = false;
        while (bjGetScore(bjState.dealerHand) < 17) {
          bjState.dealerHand.push(bjState.deck.pop());
        }
        bjRender();
        let pScore = bjGetScore(bjState.playerHand);
        let dScore = bjGetScore(bjState.dealerHand);
        if (dScore > 21 || pScore > dScore) bjEndGame("WIN", "¡HAS GANADO!");
        else if (pScore < dScore) bjEndGame("LOSE", "HA GANADO LA BANCA");
        else bjEndGame("PUSH", "EMPATE");
      }

      function bjEndGame(result, msg) {
        bjState.active = false;
        const resDiv = document.getElementById("bj-result");
        resDiv.classList.remove(
          "hidden",
          "text-emerald-400",
          "text-red-400",
          "text-slate-400",
        );
        resDiv.innerText = msg;
        if (result === "WIN") {
          resDiv.classList.add("text-emerald-400");
          google.script.run
            .withSuccessHandler(loadWalletBalance)
            .addBalance(
              localStorage.getItem("my_summoner_name"),
              bjState.bet * 2,
              "Blackjack Win",
            );
        } else if (result === "LOSE") {
          resDiv.classList.add("text-red-400");
        } else {
          resDiv.classList.add("text-slate-400");
          google.script.run
            .withSuccessHandler(loadWalletBalance)
            .addBalance(
              localStorage.getItem("my_summoner_name"),
              bjState.bet,
              "Blackjack Push",
            );
        }
        document.getElementById("bj-action-controls").classList.add("hidden");
        setTimeout(() => {
          document.getElementById("bj-bet-controls").classList.remove("hidden");
        }, 3000);
      }

      // ============================================================
      // 🃏 SISTEMA DE POKER MEJORADO
      // ============================================================
      window.pokerMyBuyIn = 0;
      window.pokerInGame = false;

      function pokerJoinRoom() {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) {
          alert("Inicia sesión para jugar.");
          return;
        }

        // Mostrar selector de buy-in
        const modal = document.getElementById("poker-buyin-modal");
        if (modal) {
          modal.style.display = "flex";
          return;
        }

        // Crear modal de buy-in dinámicamente si no existe
        let buyinHtml = ' <div id="poker-buyin-modal" style="display:flex; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.85); align-items:center; justify-content:center;"> <div class="bg-slate-900 border-2 border-yellow-500 rounded-2xl p-8 w-full max-w-sm shadow-[0_0_50px_rgba(251,191,36,0.3)]"> <h3 class="font-oswald text-yellow-400 text-2xl tracking-widest uppercase text-center mb-2">🃏 BUY-IN</h3> <p class="text-slate-400 text-xs text-center mb-6 uppercase tracking-widest">Elige tu stack inicial para la partida</p> <div class="mb-4"> <label class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 block">Cantidad (WG Coins)</label> <input id="poker-buyin-amount" type="number" min="1000" max="100000" step="500" value="5000" class="w-full bg-black border border-yellow-500/50 text-yellow-400 font-black text-2xl rounded-lg px-4 py-3 text-center focus:outline-none focus:border-yellow-400" oninput="document.getElementById(\'poker-buyin-display\').innerText = parseInt(this.value || 0).toLocaleString() + \' WG\'"> <div id="poker-buyin-display" class="text-center text-yellow-500 font-oswald text-lg mt-2">5,000 WG</div> </div> <div class="flex gap-2 mb-4"> ' +
          ([1000, 2500, 5000, 10000, 25000].map((v) => '<button onclick="document.getElementById(\'poker-buyin-amount\').value=' + (v) +
          '; document.getElementById(\'poker-buyin-display\').innerText=\'' + (v.toLocaleString()) +
          ' WG\'" class="flex-1 bg-slate-800 hover:bg-yellow-500/20 border border-slate-600 hover:border-yellow-500 text-slate-300 hover:text-yellow-400 text-[10px] font-bold py-1.5 rounded transition">' +
          (v >= 1000 ? v / 1000 + "k" : v) + '</button>').join("")) +
          ' </div> <div class="flex gap-3"> <button onclick="document.getElementById(\'poker-buyin-modal\').style.display=\'none\'" class="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition uppercase tracking-widest">CANCELAR</button> <button onclick="pokerConfirmJoin()" class="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl transition uppercase tracking-widest shadow-[0_0_20px_rgba(251,191,36,0.4)]">ENTRAR</button> </div> </div> </div>';
        document.body.insertAdjacentHTML("beforeend", buyinHtml);
      }

      function pokerConfirmJoin() {
        const summoner = localStorage.getItem("my_summoner_name");
        const buyIn = parseInt(
          document.getElementById("poker-buyin-amount").value,
        );
        if (isNaN(buyIn) || buyIn < 1000) {
          alert("El buy-in mínimo es 1,000 WG Coins.");
          return;
        }
        if (buyIn > (window.myLigaWalletBalance || 0)) {
          alert("No tienes suficientes WG Coins.");
          return;
        }

        document.getElementById("poker-buyin-modal").style.display = "none";
        window.pokerMyBuyIn = buyIn;
        window.pokerInGame = true;

        google.script.run
          .withSuccessHandler(function (res) {
            if (res && res.success === false) {
              alert(res.msg);
              return;
            }
          })
          .withFailureHandler(function (err) {
            alert("Error al unirse: " + err.message);
          })
          .pokerJoin(summoner, buyIn);
      }

      function pokerLeaveRoom() {
        const summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) return;
        if (!confirm("¿Seguro que quieres abandonar la mesa?")) return;
        window.pokerInGame = false;
        window.pokerMyBuyIn = 0;
        google.script.run
          .withSuccessHandler(function () {})
          .pokerLeave(summoner);
      }

      function pokerAddBot() {
        google.script.run
          .withSuccessHandler(function (res) {
            if (res && res.success === false) {
              alert(res.msg);
              return;
            }
          })
          .pokerJoin("🤖 BOT-WARGOD", 5000);
      }

      function pokerStartGame() {
        google.script.run
          .withSuccessHandler(function (state) {
            if (state && state.active) {
              renderPokerGame(state);
            } else {
              alert("Hubo un problema iniciando la partida. Reintenta.");
            }
          })
          .pokerStartGame();
      }

      function pokerRefreshState() {
        if (
          !document.getElementById("casino-panel-games") ||
          document
            .getElementById("casino-panel-games")
            .classList.contains("hidden")
        )
          return;
        google.script.run
          .withSuccessHandler(function (state) {
            if (!state) return;
            renderPokerLobby(state);
            if (state.active) renderPokerGame(state);
          })
          .withFailureHandler(function () {})
          .pokerGetState();
      }

      function renderPokerLobby(state) {
        const list = document.getElementById("poker-players-list");
        if (!list) return;
        const summoner = localStorage.getItem("my_summoner_name") || "";
        const isInGame =
          state.players &&
          state.players.some(
            (p) => (typeof p === "object" ? p.name : p) === summoner,
          );

        list.innerHTML = (state.players || [])
          .map((p) => {
            const pName = typeof p === "object" ? p.name : p;
            const pStack = typeof p === "object" ? p.stack : "?";
            const isBot = pName && pName.includes("BOT");
            return '<div class="bg-slate-800 border ' + (isBot ? "border-purple-500" : "border-slate-600") +
              ' px-3 py-1.5 rounded-full text-xs text-white flex items-center gap-2"> <span>' +
              (isBot ? "🤖" : "👤") + '</span> <span class="font-bold">' + (escHtml(pName)) + '</span> ' +
              (pStack ? '<span class="text-yellow-400 font-mono text-[10px]">' + (parseInt(pStack).toLocaleString()) +
              ' WG</span>' : "") +
              ' </div>';
          })
          .join("");

        // Mostrar/ocultar botones según si el jugador está en la sala
        const joinBtn = document.getElementById("btn-poker-join");
        const leaveBtn = document.getElementById("btn-poker-leave");
        const botBtn = document.getElementById("btn-poker-bot");
        const startBtn = document.getElementById("btn-poker-start");
        const canStart =
          isInGame &&
          state.players &&
          state.players.length >= 2 &&
          !state.active;

        if (joinBtn) joinBtn.style.display = isInGame ? "none" : "inline-flex";
        if (leaveBtn)
          leaveBtn.style.display = isInGame ? "inline-flex" : "none";
        if (botBtn) botBtn.style.display = "inline-flex";
        if (startBtn)
          startBtn.style.display = canStart ? "inline-flex" : "none";

        // Indicar cuántos jugadores
        const countEl = document.getElementById("poker-player-count");
        if (countEl)
          countEl.innerText = ((state.players || []).length) + '/6 jugadores';

        if (state.active) {
          document.getElementById("poker-lobby").style.display = "none";
        } else {
          document.getElementById("poker-lobby").style.display = "block";
          if (document.getElementById("poker-game"))
            document.getElementById("poker-game").classList.add("hidden");
        }
      }

      function renderPokerGame(state) {
        const lobby = document.getElementById("poker-lobby");
        const game = document.getElementById("poker-game");
        if (game) game.classList.remove("hidden");
        if (document.getElementById("poker-pot"))
          document.getElementById("poker-pot").innerText =
            'POT: ' + (state.pot || 0) + ' WG';
      }

      function pokerAction(act) {
        let summoner = localStorage.getItem("my_summoner_name");
        if (!summoner) return;
        google.script.run
          .withSuccessHandler(function (res) {
            // Si hay un bot en la sala, simular acción del bot después de 1.5s
            if (
              res &&
              res.players &&
              res.players.some((p) =>
                (typeof p === "object" ? p.name : p).includes("BOT"),
              )
            ) {
              setTimeout(pokerBotMove, 1500);
            }
          })
          .pokerDoAction(summoner, act);
      }

      function pokerBotMove() {
        // El bot hace una acción aleatoria ponderada (call 50%, raise 30%, fold 20%)
        const r = Math.random();
        let botAct = r < 0.5 ? "CALL" : r < 0.8 ? "RAISE" : "FOLD";
        google.script.run
          .withSuccessHandler(pokerRefreshState)
          .pokerDoAction("🤖 BOT-WARGOD", botAct);
      }
    