
      // ======================================================
      // SOLO-AGENT MODULE
      // ======================================================
      var _soloAgentCache = null;

      var SA_ELO_COLORS = {
        Iron:        { bg:'rgba(120,113,108,0.2)', border:'rgba(120,113,108,0.5)', text:'#a8a29e' },
        Bronze:      { bg:'rgba(180,83,9,0.2)',    border:'rgba(180,83,9,0.5)',    text:'#fdba74' },
        Silver:      { bg:'rgba(148,163,184,0.2)', border:'rgba(148,163,184,0.5)', text:'#cbd5e1' },
        Gold:        { bg:'rgba(234,179,8,0.2)',   border:'rgba(234,179,8,0.5)',   text:'#fde047' },
        Platinum:    { bg:'rgba(20,184,166,0.2)',  border:'rgba(20,184,166,0.5)',  text:'#5eead4' },
        Emerald:     { bg:'rgba(16,185,129,0.2)',  border:'rgba(16,185,129,0.5)',  text:'#6ee7b7' },
        Diamond:     { bg:'rgba(56,189,248,0.2)',  border:'rgba(56,189,248,0.5)',  text:'#7dd3fc' },
        Master:      { bg:'rgba(168,85,247,0.2)',  border:'rgba(168,85,247,0.5)',  text:'#d8b4fe' },
        Grandmaster: { bg:'rgba(239,68,68,0.2)',   border:'rgba(239,68,68,0.5)',   text:'#fca5a5' },
        Challenger:  { bg:'rgba(251,191,36,0.2)',  border:'rgba(251,191,36,0.5)',  text:'#fbbf24' }
      };
      var SA_ROLE_ICONS = { TOP:'🛡️', JNG:'🌲', MID:'🔥', ADC:'🏹', SUPP:'💖' };

      function saEscape(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      function loadSoloAgents() {
        var grid = document.getElementById('sa-grid');
        if (!grid) return;
        grid.innerHTML = '<div class="bg-[#111827] border border-slate-800 rounded-2xl p-5 animate-pulse h-48"></div><div class="bg-[#111827] border border-slate-800 rounded-2xl p-5 animate-pulse h-48"></div><div class="bg-[#111827] border border-slate-800 rounded-2xl p-5 animate-pulse h-48"></div>';
        var cnt = document.getElementById('sa-count');
        if (cnt) cnt.textContent = 'Cargando...';

        google.script.run
          .withSuccessHandler(function (res) {
            if (res && res.ok) {
              _soloAgentCache = res.agents || [];
              renderSoloAgents();
            } else {
              grid.innerHTML = '<div class="sa-empty" style="grid-column:1/-1"><p class="text-2xl mb-2">⚠️</p><p>' + saEscape(res ? res.error : 'Error desconocido') + '</p></div>';
            }
          })
          .withFailureHandler(function (err) {
            grid.innerHTML = '<div class="sa-empty" style="grid-column:1/-1"><p class="text-2xl mb-2">🔌</p><p>Error de conexión: ' + saEscape(err.message) + '</p></div>';
          })
          .getSoloAgents();
      }

      function renderSoloAgents() {
        if (!_soloAgentCache) { loadSoloAgents(); return; }
        var agents = _soloAgentCache;

        var fRole  = document.getElementById('sa-filter-role').value;
        var fRoleSec = document.getElementById('sa-filter-role-sec').value;
        var fElo   = document.getElementById('sa-filter-elo').value;
        var fAvail = document.getElementById('sa-filter-avail').value;
        var fSearch = (document.getElementById('sa-search').value || '').trim().toLowerCase();

        var filtered = agents.filter(function (a) {
          if (fRole && a.role_main !== fRole) return false;
          if (fRoleSec && a.role_secondary !== fRoleSec) return false;
          if (fElo && a.elo_current !== fElo) return false;
          if (fAvail && a.availability !== fAvail) return false;
          if (fSearch && String(a.nickname).toLowerCase().indexOf(fSearch) === -1) return false;
          return true;
        });

        var cnt = document.getElementById('sa-count');
        if (cnt) cnt.textContent = filtered.length + ' agente' + (filtered.length !== 1 ? 's' : '') + ' disponible' + (filtered.length !== 1 ? 's' : '');

        var grid = document.getElementById('sa-grid');
        if (filtered.length === 0) {
          grid.innerHTML = '<div class="sa-empty" style="grid-column:1/-1"><p class="text-4xl mb-3">🔍</p><p class="text-slate-500 font-bold text-lg">Sin resultados</p><p class="text-slate-600 text-sm mt-1">Prueba con otros filtros o sé el primero en publicar tu perfil</p></div>';
          return;
        }

        grid.innerHTML = filtered.map(function (a) {
          var eloC = SA_ELO_COLORS[a.elo_current] || { bg:'rgba(100,116,139,0.15)', border:'rgba(100,116,139,0.4)', text:'#94a3b8' };
          var eloP = SA_ELO_COLORS[a.elo_peak] || eloC;
          var ri = SA_ROLE_ICONS[a.role_main] || '❓';
          var riSec = a.role_secondary ? (SA_ROLE_ICONS[a.role_secondary] || '') : '';

          var daysAgo = '';
          if (a.created_at) {
            var diff = Math.floor((Date.now() - new Date(a.created_at)) / 86400000);
            daysAgo = isNaN(diff) ? '' : (diff <= 0 ? 'hoy' : diff === 1 ? 'ayer' : 'hace ' + diff + ' días');
          }

          var opggBtn = a.opgg ? '<a href="' + saEscape(a.opgg) + '" target="_blank" rel="noopener" class="text-[10px] text-slate-400 hover:text-sky-400 transition font-bold uppercase tracking-widest">🔗 OP.GG</a>' : '';
          var discordBtn = a.discord ? '<span class="text-[10px] text-slate-500 font-mono">' + saEscape(a.discord) + '</span>' : '';
          var desc = a.description ? '<p class="text-slate-400 text-xs leading-relaxed sa-line-clamp mt-2">' + saEscape(a.description) + '</p>' : '';
          var peakStr = (a.elo_peak && a.elo_peak !== a.elo_current) ? '<span class="text-[9px] text-slate-600 font-bold tracking-widest uppercase">Peak: <span style="color:' + eloP.text + '">' + saEscape(a.elo_peak) + '</span></span>' : '';

          var delBtn = '';
          if (a._row) {
            delBtn = '<button onclick="openDeleteModal(\'lft-player\',' + (a._row||0) + ',\'' + saEscape(a.nickname).replace(/'/g,"&apos;") + '\')" class="text-[10px] text-slate-600 hover:text-red-400 transition" title="Eliminar perfil">🗑️</button>';
          }
          var saEditBtn = '';
          if (sessionStorage.getItem('wg_admin_pw') && a._row) {
            saEditBtn = '<button onclick="openEditSoloAgentModal(' + (a._row||0) + ', this)" data-agent=\'' + saEscape(JSON.stringify(a)).replace(/'/g,"\u2019") + '\' class="text-[10px] text-slate-500 hover:text-violet-400 transition" title="Editar (Admin)">✏️</button>';
          }

          return '<div class="sa-card">'
            + '<div class="flex items-start justify-between gap-2 mb-3">'
            +   '<div><p class="font-oswald text-white text-lg tracking-wider leading-none">' + saEscape(a.nickname) + '</p>'
            +   (daysAgo ? '<p class="text-[10px] text-slate-600 mt-0.5 uppercase tracking-widest">' + daysAgo + '</p>' : '') + '</div>'
            +   '<div class="flex flex-col items-end gap-1">'
            +     '<span class="sa-elo-badge" style="background:' + eloC.bg + ';border-color:' + eloC.border + ';color:' + eloC.text + '">' + saEscape(a.elo_current) + '</span>' + peakStr
            +   '</div>'
            + '</div>'
            + '<div class="flex items-center gap-2 flex-wrap mb-1">'
            +   '<span class="sa-role-badge">' + ri + ' ' + saEscape(a.role_main) + '</span>'
            +   (a.role_secondary ? '<span class="sa-role-badge" style="background:rgba(71,85,105,0.2);border-color:rgba(71,85,105,0.4);color:#94a3b8">' + riSec + ' ' + saEscape(a.role_secondary) + '</span>' : '')
            +   (a.availability ? '<span class="text-[10px] text-slate-500 font-bold uppercase tracking-widest border border-slate-700 px-2 py-0.5 rounded-full">🕐 ' + saEscape(a.availability) + '</span>' : '')
            + '</div>'
            + desc
            + '<div class="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">'
            +   (discordBtn || '<span></span>')
            +   '<div class="flex items-center gap-2">' + opggBtn + saEditBtn + delBtn + '</div>'
            + '</div>'
            + '</div>';
        }).join('');
      }

      function openSoloAgentForm() {
        document.getElementById('sa-form-modal').style.display = 'flex';
        document.getElementById('sa-form-msg').classList.add('hidden');
      }
      function closeSoloAgentForm() {
        document.getElementById('sa-form-modal').style.display = 'none';
      }

      function showSaMsg(msg, type) {
        var el = document.getElementById('sa-form-msg');
        el.classList.remove('hidden');
        var styles = {
          ok:   'bg-green-500/10 border-green-500/30 text-green-400',
          warn: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          err:  'bg-red-500/10 border-red-500/30 text-red-400'
        };
        el.className = 'rounded-lg p-3 text-sm font-medium border ' + (styles[type] || styles.err);
        el.textContent = msg;
      }

      function submitSoloAgent() {
        var btn = document.getElementById('sa-submit-btn');
        var data = {
          nickname:       document.getElementById('sa-input-nick').value.trim(),
          opgg:           document.getElementById('sa-input-opgg').value.trim(),
          role_main:      document.getElementById('sa-input-role-main').value,
          role_secondary: document.getElementById('sa-input-role-sec').value,
          elo_current:    document.getElementById('sa-input-elo-current').value,
          elo_peak:       document.getElementById('sa-input-elo-peak').value,
          availability:   document.getElementById('sa-input-avail').value,
          description:    document.getElementById('sa-input-desc').value.trim(),
          discord:        document.getElementById('sa-input-discord').value.trim()
        };
        if (!data.nickname)    { showSaMsg('⚠️ El nickname es obligatorio.', 'warn'); return; }
        if (!data.role_main)   { showSaMsg('⚠️ Selecciona tu rol principal.', 'warn'); return; }
        if (!data.elo_current) { showSaMsg('⚠️ Selecciona tu elo actual.', 'warn'); return; }

        btn.innerHTML = '<span>⏳</span> Publicando...';
        btn.disabled = true;

        google.script.run
          .withSuccessHandler(function (res) {
            btn.innerHTML = '<span>📤</span> PUBLICAR PERFIL';
            btn.disabled = false;
            if (res && res.ok) {
              showSaMsg(res.msg, 'ok');
              _soloAgentCache = null;
              setTimeout(function () { closeSoloAgentForm(); loadSoloAgents(); }, 1800);
            } else {
              showSaMsg((res && res.error) || 'Error desconocido.', 'err');
            }
          })
          .withFailureHandler(function (err) {
            btn.innerHTML = '<span>📤</span> PUBLICAR PERFIL';
            btn.disabled = false;
            showSaMsg('❌ Error de red: ' + err.message, 'err');
          })
          .registerSoloAgent(data);
      }

      /* ---- ADMIN EDIT SOLO-AGENT ---- */
      function openEditSoloAgentModal(rowIndex, btnEl) {
        if (!sessionStorage.getItem('wg_admin_pw')) return;
        var agentData = null;
        try {
          var rawAttr = btnEl.getAttribute('data-agent') || '';
          rawAttr = rawAttr.replace(/\u2019/g, "'"); // restore curly → straight quote
          agentData = JSON.parse(rawAttr);
        } catch(e) { alert('Error al leer datos del agente: ' + e.message); return; }

        document.getElementById('sa-edit-row').value          = rowIndex;
        document.getElementById('sa-edit-nick').value         = agentData.nickname    || '';
        document.getElementById('sa-edit-discord').value      = agentData.discord     || '';
        document.getElementById('sa-edit-opgg').value         = agentData.opgg        || '';
        document.getElementById('sa-edit-desc').value         = agentData.description || '';
        document.getElementById('sa-edit-role-main').value    = agentData.role_main   || '';
        document.getElementById('sa-edit-role-sec').value     = agentData.role_secondary || '';
        document.getElementById('sa-edit-elo-current').value  = agentData.elo_current || '';
        document.getElementById('sa-edit-elo-peak').value     = agentData.elo_peak    || '';
        document.getElementById('sa-edit-avail').value        = agentData.availability || '';

        var counter = document.getElementById('sa-edit-desc-counter');
        if (counter) counter.textContent = (agentData.description || '').length + '/280';

        var msg = document.getElementById('sa-edit-msg');
        msg.textContent = ''; msg.classList.add('hidden');

        document.getElementById('sa-edit-btn').disabled = false;
        document.getElementById('sa-edit-btn').innerHTML = '<span>✏️</span> GUARDAR CAMBIOS';

        document.getElementById('sa-edit-modal').style.display = 'flex';
      }

      function closeEditSoloAgentModal() {
        document.getElementById('sa-edit-modal').style.display = 'none';
      }

      function showSaEditMsg(txt, type) {
        var el = document.getElementById('sa-edit-msg');
        var styles = {
          ok:   'bg-green-500/10 border-green-500/30 text-green-400',
          warn: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          err:  'bg-red-500/10 border-red-500/30 text-red-400'
        };
        el.className = 'rounded-lg p-3 text-sm font-medium border ' + (styles[type] || styles.err);
        el.textContent = txt;
        el.classList.remove('hidden');
      }

      function submitEditSoloAgent() {
        if (!sessionStorage.getItem('wg_admin_pw')) {
          showSaEditMsg('❌ Solo los admins pueden editar estos datos.', 'err');
          return;
        }
        var btn = document.getElementById('sa-edit-btn');
        var rowIndex = parseInt(document.getElementById('sa-edit-row').value);
        if (!rowIndex || rowIndex < 2) { showSaEditMsg('⚠️ Fila inválida.', 'warn'); return; }

        var data = {
          rowIndex:       rowIndex,
          adminKey:       sessionStorage.getItem('wg_admin_pw') || '',
          nickname:       document.getElementById('sa-edit-nick').value.trim(),
          discord:        document.getElementById('sa-edit-discord').value.trim(),
          opgg:           document.getElementById('sa-edit-opgg').value.trim(),
          description:    document.getElementById('sa-edit-desc').value.trim(),
          role_main:      document.getElementById('sa-edit-role-main').value,
          role_secondary: document.getElementById('sa-edit-role-sec').value,
          elo_current:    document.getElementById('sa-edit-elo-current').value,
          elo_peak:       document.getElementById('sa-edit-elo-peak').value,
          availability:   document.getElementById('sa-edit-avail').value
        };

        if (!data.nickname)   return showSaEditMsg('⚠️ El nickname es obligatorio.', 'warn');
        if (!data.role_main)  return showSaEditMsg('⚠️ Selecciona el rol principal.', 'warn');
        if (!data.elo_current) return showSaEditMsg('⚠️ Selecciona el elo actual.', 'warn');

        btn.innerHTML = '<span>⏳</span> Guardando...';
        btn.disabled = true;

        google.script.run
          .withSuccessHandler(function(res) {
            btn.innerHTML = '<span>✏️</span> GUARDAR CAMBIOS';
            btn.disabled = false;
            if (res && res.ok) {
              showSaEditMsg('✅ ' + (res.msg || '¡Perfil actualizado!'), 'ok');
              _soloAgentCache = null;
              setTimeout(function() { closeEditSoloAgentModal(); loadSoloAgents(); }, 1500);
            } else {
              showSaEditMsg((res && res.error) || 'Error desconocido.', 'err');
            }
          })
          .withFailureHandler(function(err) {
            btn.innerHTML = '<span>✏️</span> GUARDAR CAMBIOS';
            btn.disabled = false;
            showSaEditMsg('❌ Error de red: ' + err.message, 'err');
          })
          .updateSoloAgent(data);
      }

      // Hook: cargar la pestaña al activarla
      (function () {
        var _origSwitch = window.switchTab;
        window.switchTab = function (tabId, el) {
          if (typeof _origSwitch === 'function') _origSwitch(tabId, el);
          if (tabId === 'solo-agent' && !_soloAgentCache) loadSoloAgents();
        };
      })();

      /* ================================================================
         📢  LFT TEAMS — Equipos buscando jugadores
      ================================================================ */
      var _lftTeamsCache = null;

      function loadLftTeams() {
        var grid = document.getElementById('lft-grid');
        grid.innerHTML = '<div class="rec-card animate-pulse h-40 col-span-1"></div><div class="rec-card animate-pulse h-40 col-span-1"></div><div class="rec-card animate-pulse h-40 col-span-1"></div>';
        document.getElementById('lft-count').textContent = 'Cargando...';
        google.script.run
          .withSuccessHandler(function (res) {
            _lftTeamsCache = (res && res.teams) || [];
            renderLftTeams();
          })
          .withFailureHandler(function () {
            _lftTeamsCache = [];
            grid.innerHTML = '<div class="sa-empty col-span-3"><div class="text-4xl mb-3">📢</div><p class="font-bold">No se pudieron cargar los anuncios.</p></div>';
          })
          .getLftTeams();
      }

      function renderLftTeams() {
        if (!_lftTeamsCache) { loadLftTeams(); return; }
        var teams = _lftTeamsCache;
        var fRole = document.getElementById('lft-filter-role').value;
        var fElo  = document.getElementById('lft-filter-elo').value;
        var fDiv  = document.getElementById('lft-filter-div').value;
        var fSearch = (document.getElementById('lft-search').value || '').toLowerCase();

        var ELO_ORDER = ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger'];

        teams = teams.filter(function (t) {
          if (fRole && !(t.roles || '').includes(fRole)) return false;
          if (fElo) {
            var minIdx = ELO_ORDER.indexOf(fElo);
            var teamIdx = ELO_ORDER.indexOf(t.eloMin || '');
            if (teamIdx < minIdx) return false;
          }
          if (fDiv && t.division !== fDiv) return false;
          if (fSearch && !(t.teamName || '').toLowerCase().includes(fSearch)) return false;
          return true;
        });

        var grid = document.getElementById('lft-grid');
        document.getElementById('lft-count').textContent = teams.length + ' anuncio' + (teams.length !== 1 ? 's' : '') + ' encontrado' + (teams.length !== 1 ? 's' : '');

        if (teams.length === 0) {
          grid.innerHTML = '<div class="sa-empty" style="grid-column:1/-1"><div class="text-4xl mb-3">📢</div><p class="font-bold">No hay anuncios con esos filtros.</p></div>';
          return;
        }

        var ROLE_ICONS = { TOP:'🛡️', JNG:'🌲', MID:'🔥', ADC:'🏹', SUPP:'💖' };
        var DIV_ICONS = { Premier:'👑', Aspirante:'⚔️', 'Élite':'💎', Promesas:'🌱', Academia:'🎓' };
        grid.innerHTML = teams.map(function (t) {
          var roles = (t.roles || '').split(',').filter(Boolean).map(function (r) {
            return '<span class="rec-badge-teal">' + (ROLE_ICONS[r] || '') + ' ' + r + '</span>';
          }).join('');
          var divIcon = DIV_ICONS[t.division] || '';
          var opggBtn = t.opgg ? '<a href="' + t.opgg + '" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-[10px] bg-slate-700 hover:bg-teal-700/60 text-teal-300 hover:text-teal-100 px-2.5 py-1 rounded-lg transition font-bold tracking-wide">🔗 Multi OP.GG</a>' : '';
          var delBtn = '<button onclick="openDeleteModal(\'lft-team\', ' + (t._rowIndex||0) + ', \'' + (t.teamName||'').replace(/'/g,"\\'") + '\')" class="text-[10px] text-slate-600 hover:text-red-400 transition px-1.5 py-0.5 rounded" title="Eliminar anuncio">🗑️</button>';
          return '<div class="rec-card">' +
            '<div class="flex items-start justify-between mb-3">' +
              '<div>' +
                '<div class="font-oswald text-lg text-white tracking-widest">' + (t.teamName || '?') + '</div>' +
                '<div class="text-[11px] text-slate-500 mt-0.5">División: <span class="text-teal-400 font-bold">' + divIcon + ' ' + (t.division || 'Libre') + '</span></div>' +
              '</div>' +
              '<div class="flex items-center gap-1.5">' +
                '<span class="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-lg">' + (t.eloMin ? 'Min: '+t.eloMin : 'Sin req.') + '</span>' +
                delBtn +
              '</div>' +
            '</div>' +
            '<div class="flex flex-wrap gap-1.5 mb-3">' + roles + '</div>' +
            (t.desc ? '<p class="text-slate-400 text-xs sa-line-clamp mb-3">' + t.desc + '</p>' : '') +
            '<div class="flex items-center justify-between pt-3 border-t border-slate-800">' +
              '<span class="text-[11px] text-slate-500">Discord: <span class="text-teal-300 font-bold">' + (t.discord || '-') + '</span></span>' +
              '<div class="flex items-center gap-2">' +
                opggBtn +
                '<span class="text-[10px] text-slate-600">' + (t.date || '') + '</span>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      function openLftTeamForm() {
        document.getElementById('lft-form-modal').style.display = 'flex';
        document.getElementById('lft-form-msg').classList.add('hidden');
      }
      function closeLftTeamForm() {
        document.getElementById('lft-form-modal').style.display = 'none';
      }
      function showLftMsg(txt, type) {
        var el = document.getElementById('lft-form-msg');
        el.className = 'rounded-lg p-3 text-sm font-medium border ' + (type === 'ok' ? 'bg-teal-900/30 border-teal-600 text-teal-300' : 'bg-red-900/30 border-red-600 text-red-300');
        el.textContent = txt;
        el.classList.remove('hidden');
      }
      function submitLftTeam() {
        var btn = document.getElementById('lft-submit-btn');
        var roles = Array.from(document.querySelectorAll('#lft-roles-check input:checked')).map(function (i) { return i.value; }).join(',');
        var data = {
          teamName: document.getElementById('lft-input-team').value.trim(),
          division: document.getElementById('lft-input-div').value,
          roles: roles,
          eloMin: document.getElementById('lft-input-elo-min').value,
          discord: document.getElementById('lft-input-discord').value.trim(),
          desc: document.getElementById('lft-input-desc').value.trim(),
          opgg: document.getElementById('lft-input-opgg').value.trim()
        };
        if (!data.teamName) return showLftMsg('⚠️ El nombre del equipo es obligatorio.', 'err');
        if (!data.discord) return showLftMsg('⚠️ El contacto Discord es obligatorio.', 'err');
        if (!data.roles) return showLftMsg('⚠️ Selecciona al menos un rol buscado.', 'err');
        btn.innerHTML = '<span class="animate-spin">⏳</span> Publicando...';
        btn.disabled = true;
        google.script.run
          .withSuccessHandler(function (res) {
            btn.innerHTML = '<span>📤</span> PUBLICAR ANUNCIO';
            btn.disabled = false;
            if (res && res.success) {
              showLftMsg('✅ Anuncio publicado correctamente.', 'ok');
              _lftTeamsCache = null;
              setTimeout(function () { closeLftTeamForm(); loadLftTeams(); }, 1500);
            } else {
              showLftMsg((res && res.error) || 'Error desconocido.', 'err');
            }
          })
          .withFailureHandler(function (err) {
            btn.innerHTML = '<span>📤</span> PUBLICAR ANUNCIO';
            btn.disabled = false;
            showLftMsg('❌ Error de red: ' + err.message, 'err');
          })
          .registerLftTeam(data);
      }

      /* ================================================================
         🤖  TEAM BUILDER — Generador automático de equipo
      ================================================================ */
      function runTeamBuilder() {
        var loading = document.getElementById('tb-loading');
        var result  = document.getElementById('tb-result');
        result.classList.add('hidden');
        loading.classList.remove('hidden');

        // Construir criterios por rol
        var slots = document.querySelectorAll('#tb-role-slots .tb-role-slot');
        var criteria = {};
        slots.forEach(function (slot) {
          var role = slot.getAttribute('data-role');
          criteria[role] = {
            elo: slot.querySelector('.tb-elo-select').value,
            avail: slot.querySelector('.tb-avail-select').value
          };
        });

        // Necesitamos el pool de Solo-Agents
        google.script.run
          .withSuccessHandler(function (res) {
            loading.classList.add('hidden');
            result.classList.remove('hidden');
            var agents = (res && res.agents) || [];
            buildTeamFromAgents(agents, criteria);
          })
          .withFailureHandler(function () {
            loading.classList.add('hidden');
            result.classList.remove('hidden');
            document.getElementById('tb-team-slots').innerHTML = '';
            document.getElementById('tb-no-match').classList.remove('hidden');
          })
          .getSoloAgents();
      }

      function buildTeamFromAgents(agents, criteria) {
        var ROLES = ['TOP', 'JNG', 'MID', 'ADC', 'SUPP'];
        var ELO_ORDER = ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger'];
        var ROLE_ICONS = { TOP:'🛡️', JNG:'🌲', MID:'🔥', ADC:'🏹', SUPP:'💖' };
        var usedIds = {};
        var teamSlots = document.getElementById('tb-team-slots');
        var noMatch = document.getElementById('tb-no-match');
        teamSlots.innerHTML = '';
        noMatch.classList.add('hidden');

        var found = 0;
        ROLES.forEach(function (role) {
          var req = criteria[role] || {};
          var minEloIdx = req.elo ? ELO_ORDER.indexOf(req.elo) : -1;

          // Filtrar candidatos para este rol
          // El backend devuelve: nickname, role_main, role_secondary, elo_current, availability, opgg
          var candidates = agents.filter(function (a) {
            var id = a.nickname || a.nick || '';
            if (usedIds[id]) return false; // ya asignado
            var mainRole = (a.role_main || a.roleMain || '').toUpperCase();
            var secRole  = (a.role_secondary || a.roleSec || '').toUpperCase();
            if (mainRole !== role && secRole !== role) return false;
            if (req.elo) {
              var agentEloIdx = ELO_ORDER.indexOf(a.elo_current || a.eloCurrent || '');
              if (agentEloIdx < minEloIdx) return false;
            }
            var avail = a.availability || '';
            if (req.avail && avail && avail !== req.avail && avail !== 'Flexible') return false;
            return true;
          });

          // Priorizar: rol principal > rol secundario; elo más alto
          candidates.sort(function (a, b) {
            var aMain = (a.role_main || a.roleMain || '').toUpperCase() === role ? 1 : 0;
            var bMain = (b.role_main || b.roleMain || '').toUpperCase() === role ? 1 : 0;
            if (bMain !== aMain) return bMain - aMain;
            return ELO_ORDER.indexOf(b.elo_current || b.eloCurrent || '') - ELO_ORDER.indexOf(a.elo_current || a.eloCurrent || '');
          });

          var pick = candidates[0];
          if (pick) {
            var pickId = pick.nickname || pick.nick || '';
            usedIds[pickId] = true;
            found++;
          }

          // Render slot
          var pickNick    = pick ? (pick.nickname || pick.nick || '?') : null;
          var pickElo     = pick ? (pick.elo_current || pick.eloCurrent || '?') : null;
          var pickOpgg    = pick ? (pick.opgg || '') : '';
          var pickAvail   = pick ? (pick.availability || '') : '';
          var pickDiscord = pick ? (pick.discord || '') : '';

          teamSlots.innerHTML += '<div class="tb-role-slot ' + (pick ? 'filled' : '') + ' text-center">' +
            '<div class="text-2xl mb-1">' + (ROLE_ICONS[role] || '?') + '</div>' +
            '<div class="font-oswald text-xs text-slate-400 tracking-widest uppercase mb-2">' + role + '</div>' +
            (pick ?
              '<div class="font-bold text-white text-sm">' + pickNick + '</div>' +
              '<div class="text-[11px] text-indigo-300 mt-1">' + pickElo + '</div>' +
              (pickOpgg ? '<a href="' + pickOpgg + '" target="_blank" class="text-[10px] text-slate-500 hover:text-indigo-400 transition mt-0.5 block">OP.GG ↗</a>' : '') +
              (pickDiscord ? '<div class="text-[10px] text-slate-600 mt-1">💬 ' + pickDiscord + '</div>' : '') +
              '<div class="text-[10px] text-slate-600 mt-0.5">' + pickAvail + '</div>'
              :
              '<div class="text-slate-600 text-xs">Sin candidatos</div>'
            ) +
          '</div>';
        });

        if (found === 0) noMatch.classList.remove('hidden');
      }


      /* ================================================================
         ⚔️  SCRIMS / INHOUSES
      ================================================================ */
      var _scrimPoolCache = null;
      var _scrimTeamsCache = null;

      function switchScrimMode(mode) {
        document.querySelectorAll('.scrim-mode-btn').forEach(function (b) {
          b.className = 'scrim-mode-btn px-5 py-2 rounded-lg text-sm font-bold tracking-widest uppercase transition text-slate-400 hover:text-white';
        });
        var activeBtn = document.getElementById('scrim-tab-' + mode);
        if (activeBtn) activeBtn.className = 'scrim-mode-btn px-5 py-2 rounded-lg text-sm font-bold tracking-widest uppercase transition bg-rose-600 text-white';
        document.getElementById('scrim-panel-individual').classList.toggle('hidden', mode !== 'individual');
        document.getElementById('scrim-panel-team').classList.toggle('hidden', mode !== 'team');
        if (mode === 'individual' && !_scrimPoolCache) loadScrimPool();
        if (mode === 'team' && !_scrimTeamsCache) loadScrimTeams();
      }

      function loadScrimPool() {
        document.getElementById('scrim-pool-list').innerHTML = '<div class="text-center text-slate-600 text-sm py-4">Cargando...</div>';
        google.script.run
          .withSuccessHandler(function (res) {
            _scrimPoolCache = (res && res.players) || [];
            renderScrimPool();
          })
          .withFailureHandler(function () {
            _scrimPoolCache = [];
            document.getElementById('scrim-pool-list').innerHTML = '<div class="text-center text-rose-600 text-sm py-4">Error al cargar.</div>';
          })
          .getScrimPool();
      }

      function renderScrimPool() {
        var players = _scrimPoolCache || [];
        var ROLES = ['TOP','JNG','MID','ADC','SUPP'];
        var counts = { TOP:0, JNG:0, MID:0, ADC:0, SUPP:0 };
        players.forEach(function (p) { if (counts[p.roleMain] !== undefined) counts[p.roleMain]++; });
        ROLES.forEach(function (r) { var el = document.getElementById('pool-count-' + r); if (el) el.textContent = counts[r]; });

        var list = document.getElementById('scrim-pool-list');
        if (players.length === 0) {
          list.innerHTML = '<div class="text-center text-slate-600 text-sm py-4">Aún no hay jugadores apuntados.</div>';
          return;
        }
        var ICONS = { TOP:'🛡️', JNG:'🌲', MID:'🔥', ADC:'🏹', SUPP:'💖' };
        list.innerHTML = players.map(function (p) {
          var delBtn = '<button onclick="openDeleteModal(\'scrim-player\', ' + (p._rowIndex||0) + ', \'' + (p.nick||'').replace(/'/g,"\\'") + '\')" class="text-[10px] text-slate-600 hover:text-red-400 transition" title="Salir del pool">🗑️</button>';
          return '<div class="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2">' +
            '<div class="flex items-center gap-2">' +
              '<span>' + (ICONS[p.roleMain] || '❓') + '</span>' +
              '<span class="font-bold text-sm text-white">' + p.nick + '</span>' +
              (p.roleSec ? '<span class="text-[10px] text-slate-500">/ ' + p.roleSec + '</span>' : '') +
            '</div>' +
            '<div class="flex items-center gap-3">' +
              '<span class="text-[11px] text-rose-300">' + (p.timeSlot || '') + '</span>' +
              (p.division ? '<span class="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">' + p.division + '</span>' : '') +
              delBtn +
            '</div>' +
          '</div>';
        }).join('');
      }

      function autoGenerateInhouse() {
        var players = _scrimPoolCache || [];
        if (players.length < 10) {
          alert('⚠️ Se necesitan al menos 10 jugadores en el pool para generar un inhouse completo. Actualmente hay ' + players.length + '.');
          return;
        }
        var ROLES = ['TOP','JNG','MID','ADC','SUPP'];
        var ICONS = { TOP:'🛡️', JNG:'🌲', MID:'🔥', ADC:'🏹', SUPP:'💖' };
        var team1 = [], team2 = [], used = {};
        // Asignar por rol principal primero
        ROLES.forEach(function (role) {
          var forRole = players.filter(function (p) { return p.roleMain === role && !used[p.nick]; });
          if (forRole[0]) { team1.push(forRole[0]); used[forRole[0].nick] = true; }
          if (forRole[1]) { team2.push(forRole[1]); used[forRole[1].nick] = true; }
        });
        alert('✅ Inhouse generado!\n\n🔵 Equipo Azul: ' + team1.map(function(p){return p.nick;}).join(', ') + '\n\n🔴 Equipo Rojo: ' + team2.map(function(p){return p.nick;}).join(', '));
      }

      function showScrimIndMsg(txt, type) {
        var el = document.getElementById('scrim-ind-msg');
        el.className = 'rounded-lg p-3 text-sm font-medium border ' + (type === 'ok' ? 'bg-rose-900/30 border-rose-600 text-rose-300' : 'bg-red-900/30 border-red-600 text-red-300');
        el.textContent = txt;
        el.classList.remove('hidden');
      }
      function submitScrimIndividual() {
        var data = {
          nick: document.getElementById('scrim-nick').value.trim(),
          division: document.getElementById('scrim-div').value,
          roleMain: document.getElementById('scrim-role-main').value,
          roleSec: document.getElementById('scrim-role-sec').value,
          timeSlot: document.getElementById('scrim-time').value,
          discord: document.getElementById('scrim-discord').value.trim(),
          scrimDate: document.getElementById('scrim-date').value || ''
        };
        if (!data.nick) return showScrimIndMsg('⚠️ El nickname es obligatorio.', 'err');
        if (!data.roleMain) return showScrimIndMsg('⚠️ Selecciona un rol principal.', 'err');
        if (!data.timeSlot) return showScrimIndMsg('⚠️ Selecciona una franja horaria.', 'err');
        if (!data.discord) return showScrimIndMsg('⚠️ El Discord de contacto es obligatorio.', 'err');
        google.script.run
          .withSuccessHandler(function (res) {
            if (res && res.success) {
              showScrimIndMsg('✅ ¡Apuntado al pool de inhouses! Se ha anunciado en Discord.', 'ok');
              _scrimPoolCache = null;
              setTimeout(loadScrimPool, 1500);
            } else {
              showScrimIndMsg((res && res.error) || 'Error desconocido.', 'err');
            }
          })
          .withFailureHandler(function (err) { showScrimIndMsg('❌ ' + err.message, 'err'); })
          .registerScrimPlayer(data);
      }

      function loadScrimTeams() {
        document.getElementById('scrim-teams-list').innerHTML = '<div class="text-center text-slate-600 text-sm py-6">Cargando...</div>';
        google.script.run
          .withSuccessHandler(function (res) {
            _scrimTeamsCache = (res && res.teams) || [];
            renderScrimTeams();
          })
          .withFailureHandler(function () {
            _scrimTeamsCache = [];
            document.getElementById('scrim-teams-list').innerHTML = '<div class="text-center text-rose-600 text-sm py-6">Error al cargar.</div>';
          })
          .getScrimTeams();
      }

      function renderScrimTeams() {
        var teams = _scrimTeamsCache || [];
        var list = document.getElementById('scrim-teams-list');
        if (teams.length === 0) {
          list.innerHTML = '<div class="text-center text-slate-600 text-sm py-6">No hay equipos buscando scrim ahora mismo.</div>';
          return;
        }
        var BO_COLOR = { Bo1:'bg-blue-900/40 text-blue-300 border-blue-700/50', Bo2:'bg-purple-900/40 text-purple-300 border-purple-700/50', Bo3:'bg-amber-900/40 text-amber-300 border-amber-700/50' };
        list.innerHTML = teams.map(function(t) {
          var boType = t.boType || 'Bo1';
          var boCls = BO_COLOR[boType] || BO_COLOR['Bo1'];
          var dateStr = t.scrimDate ? '📅 ' + t.scrimDate : '';
          var delBtn = '<button onclick="openDeleteModal(\'scrim-team\', ' + (t._rowIndex||0) + ', \'' + (t.teamName||'').replace(/'/g,"\\'") + '\')" class="text-[10px] text-slate-600 hover:text-red-400 transition ml-auto" title="Eliminar">🗑️</button>';
          return '<div class="scrim-card">' +
            '<div class="flex items-center justify-between mb-2">' +
              '<span class="font-oswald text-white text-base tracking-widest">' + (t.teamName || '?') + '</span>' +
              '<div class="flex items-center gap-2">' +
                (t.division ? '<span class="scrim-badge">' + t.division + '</span>' : '') +
                '<span class="scrim-badge border ' + boCls + '">' + boType + '</span>' +
                delBtn +
              '</div>' +
            '</div>' +
            '<div class="flex items-center gap-3 text-xs text-slate-400 flex-wrap">' +
              '<span>🕐 ' + (t.timeSlot || 'Flexible') + '</span>' +
              (dateStr ? '<span class="text-rose-300 font-bold">' + dateStr + '</span>' : '') +
              '<span>💬 ' + (t.discord || '-') + '</span>' +
            '</div>' +
            (t.players ? '<div class="text-[11px] text-slate-500 mt-2">' + t.players + '</div>' : '') +
          '</div>';
        }).join('');
      }

      function showScrimTeamMsg(txt, type) {
        var el = document.getElementById('scrim-team-msg');
        el.className = 'rounded-lg p-3 text-sm font-medium border ' + (type === 'ok' ? 'bg-rose-900/30 border-rose-600 text-rose-300' : 'bg-red-900/30 border-red-600 text-red-300');
        el.textContent = txt;
        el.classList.remove('hidden');
      }
      function submitScrimTeam() {
        var players = [
          document.getElementById('scrim-p1').value.trim(),
          document.getElementById('scrim-p2').value.trim(),
          document.getElementById('scrim-p3').value.trim(),
          document.getElementById('scrim-p4').value.trim(),
          document.getElementById('scrim-p5').value.trim()
        ].filter(Boolean).join(', ');
        var data = {
          teamName: document.getElementById('scrim-team-name').value.trim(),
          division: document.getElementById('scrim-team-div').value,
          timeSlot: document.getElementById('scrim-team-time').value,
          discord: document.getElementById('scrim-team-discord').value.trim(),
          players: players,
          scrimDate: document.getElementById('scrim-team-date').value || '',
          boType: document.getElementById('scrim-team-botype').value || 'Bo1'
        };
        if (!data.teamName) return showScrimTeamMsg('⚠️ El nombre del equipo es obligatorio.', 'err');
        if (!data.discord) return showScrimTeamMsg('⚠️ El Discord de contacto es obligatorio (se mencionará en el anuncio).', 'err');
        if (!data.timeSlot) return showScrimTeamMsg('⚠️ Selecciona una franja horaria.', 'err');
        if (!data.scrimDate) return showScrimTeamMsg('⚠️ Selecciona el día del scrim.', 'err');
        google.script.run
          .withSuccessHandler(function (res) {
            if (res && res.success) {
              showScrimTeamMsg('✅ ¡Equipo publicado! Se ha anunciado en Discord con mención a ' + data.discord, 'ok');
              _scrimTeamsCache = null;
              setTimeout(loadScrimTeams, 1500);
            } else {
              showScrimTeamMsg((res && res.error) || 'Error desconocido.', 'err');
            }
          })
          .withFailureHandler(function (err) { showScrimTeamMsg('❌ ' + err.message, 'err'); })
          .registerScrimTeam(data);
      }

      // Hook para cargar datos al cambiar de tab
      (function () {
        var _origSwitch2 = window.switchTab;
        window.switchTab = function (tabId, el) {
          if (typeof _origSwitch2 === 'function') _origSwitch2(tabId, el);
          if (tabId === 'lft-teams' && !_lftTeamsCache) loadLftTeams();
          if (tabId === 'scrims') { loadScrimPool(); loadScrimTeams(); }
        };
      })();


      /* ================================================================
         DELETE MODAL — Eliminacion de posts de reclutamiento
      ================================================================ */
      var _deleteContext = null;
      function openDeleteModal(type, rowIndex, label) {
        _deleteContext = { type: type, rowIndex: rowIndex, label: label };
        document.getElementById('del-label').textContent = label || '?';
        document.getElementById('del-nick-input').value = '';
        var m = document.getElementById('del-msg'); m.textContent = ''; m.style.display = 'none';
        document.getElementById('del-confirm-btn').disabled = false;
        document.getElementById('del-confirm-btn').textContent = 'Eliminar';
        document.getElementById('rec-delete-modal').style.display = 'flex';
      }
      function closeDeleteModal() {
        document.getElementById('rec-delete-modal').style.display = 'none';
        _deleteContext = null;
      }
      function confirmDelete() {
        if (!_deleteContext) return;
        var nick = document.getElementById('del-nick-input').value.trim();
        var adminPw = sessionStorage.getItem('wg_admin_pw') || '';
        var msgEl = document.getElementById('del-msg');
        var btn = document.getElementById('del-confirm-btn');
        if (!nick && currentUserRole !== 'admin') {
          msgEl.textContent = 'Introduce tu nickname o Discord.';
          msgEl.style.color='#f87171'; msgEl.style.display='block'; return;
        }
        btn.disabled = true; btn.textContent = 'Eliminando...';
        var payload = { rowIndex: _deleteContext.rowIndex, requesterNick: nick, adminKey: adminPw };
        var ctx = _deleteContext;
        var ok = function(res) {
          btn.disabled=false; btn.textContent='Eliminar';
          if (res && res.success) {
            closeDeleteModal();
            if (ctx.type==='lft-team')     { _lftTeamsCache=null;  loadLftTeams(); }
            if (ctx.type==='scrim-player') { _scrimPoolCache=null; loadScrimPool(); }
            if (ctx.type==='scrim-team')   { _scrimTeamsCache=null; loadScrimTeams(); }
            if (ctx.type==='team-pool')    { _teamPoolCache=null;  loadTeamPool(); }
          } else { msgEl.textContent=(res&&res.error)||'Error.'; msgEl.style.color='#f87171'; msgEl.style.display='block'; }
        };
        var fail = function(e) { btn.disabled=false; btn.textContent='Eliminar'; msgEl.textContent='Error: '+e.message; msgEl.style.color='#f87171'; msgEl.style.display='block'; };
        if (ctx.type==='lft-team')     google.script.run.withSuccessHandler(ok).withFailureHandler(fail).deleteLftTeam(payload);
        if (ctx.type==='scrim-player') google.script.run.withSuccessHandler(ok).withFailureHandler(fail).deleteScrimPlayer(payload);
        if (ctx.type==='scrim-team')   google.script.run.withSuccessHandler(ok).withFailureHandler(fail).deleteScrimTeam(payload);
        if (ctx.type==='team-pool')    google.script.run.withSuccessHandler(ok).withFailureHandler(fail).deleteTeamPool(payload);
      }
    