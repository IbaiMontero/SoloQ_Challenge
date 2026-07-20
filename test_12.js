
      var _teamPoolCache = null;

      var TP_ELO_COLORS = {
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

      var TP_ELO_ORDER = ['Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger'];

      var TP_DIV_ICONS = {
        'Premier': '👑', 'Aspirante': '⚔️', 'Élite': '💎', 'Promesas': '💫', 'Academia': '🎓'
      };

      var TP_SERVER_FLAGS = {
        'EUW':'🌍', 'EUNE':'🌐', 'NA':'🌎', 'LAN':'🌎', 'LAS':'🌎',
        'BR':'🇧🇷', 'KR':'🇰🇷', 'JP':'🇯🇵', 'OCE':'🌏', 'TR':'🇹🇷', 'RU':'🇷🇺'
      };

      function tpEsc(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      /* ---- LOAD ---- */
      function loadTeamPool() {
        var grid = document.getElementById('tp-grid');
        if (!grid) return;
        grid.innerHTML = [1,2,3].map(function(){
          return '<div class="team-pool-card animate-pulse h-52"></div>';
        }).join('');
        var cnt = document.getElementById('tp-count');
        if (cnt) cnt.textContent = 'Cargando...';

        google.script.run
          .withSuccessHandler(function(res) {
            _teamPoolCache = (res && res.teams) || [];
            renderTeamPool();
          })
          .withFailureHandler(function(err) {
            grid.innerHTML = '<div class="team-pool-card" style="grid-column:1/-1;text-align:center;padding:2rem;"><p class="text-2xl mb-2">🔌</p><p class="text-slate-500">Error al cargar: ' + tpEsc(err.message) + '</p></div>';
          })
          .getTeamPool();
      }

      /* ---- RENDER ---- */
      function renderTeamPool() {
        if (_teamPoolCache === null) { loadTeamPool(); return; }
        var teams = _teamPoolCache.slice(); // copia

        var fServer = document.getElementById('tp-filter-server').value;
        var fDiv    = document.getElementById('tp-filter-div').value;
        var fElo    = document.getElementById('tp-filter-elo').value;
        var fSort   = document.getElementById('tp-sort').value;
        var fSearch = (document.getElementById('tp-search').value || '').trim().toLowerCase();

        // Filtros
        teams = teams.filter(function(t) {
          if (fServer && t.server !== fServer) return false;
          if (fDiv    && t.division !== fDiv)  return false;
          if (fElo) {
            var minIdx = TP_ELO_ORDER.indexOf(fElo);
            var tIdx   = TP_ELO_ORDER.indexOf(t.avgElo);
            if (tIdx < minIdx) return false;
          }
          if (fSearch) {
            var haystack = ((t.name || '') + ' ' + (t.captain || '')).toLowerCase();
            if (haystack.indexOf(fSearch) === -1) return false;
          }
          return true;
        });

        // Orden original = queue (ya viene ordenado por fecha ASC del backend)
        if (fSort === 'newest') {
          teams = teams.slice().reverse();
        } else if (fSort === 'elo') {
          teams = teams.slice().sort(function(a,b) {
            return TP_ELO_ORDER.indexOf(b.avgElo) - TP_ELO_ORDER.indexOf(a.avgElo);
          });
        }

        var cnt = document.getElementById('tp-count');
        if (cnt) cnt.textContent = teams.length + ' equipo' + (teams.length !== 1 ? 's' : '') + ' en cola';

        var grid = document.getElementById('tp-grid');
        if (!grid) return;

        if (teams.length === 0) {
          grid.innerHTML = '<div style="grid-column:1/-1" class="team-pool-card text-center py-12"><p class="text-4xl mb-3">🏟️</p><p class="text-slate-500 font-bold text-lg">Sin equipos en cola</p><p class="text-slate-600 text-sm mt-1">Sé el primero en inscribir tu equipo</p></div>';
          return;
        }

        grid.innerHTML = teams.map(function(t, idx) {
          var eloC  = TP_ELO_COLORS[t.avgElo] || { bg:'rgba(100,116,139,0.15)', border:'rgba(100,116,139,0.4)', text:'#94a3b8' };
          var divIcon = TP_DIV_ICONS[t.division] || '📋';
          var srvFlag = TP_SERVER_FLAGS[t.server] || '🌐';

          // Número de posición en cola ORIGINAL (antes de filtros/orden)
          var queuePos = _teamPoolCache.indexOf(t) + 1;

          // Fecha inscripción
          var dateStr = '';
          if (t.created_at) {
            try {
              var d = new Date(t.created_at);
              var diff = Math.floor((Date.now() - d) / 86400000);
              dateStr = isNaN(diff) ? '' : (diff <= 0 ? 'hoy' : diff === 1 ? 'hace 1 día' : 'hace ' + diff + ' días');
            } catch(e) {}
          }

          // Logo
          var logoHtml = t.logo
            ? '<img src="' + tpEsc(t.logo) + '" onerror="this.style.display=\'none\'" class="w-12 h-12 rounded-lg object-cover border border-slate-700 shrink-0" />'
            : '<div class="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">🛡️</div>';

          // Botón eliminar
          var delBtn = '<button onclick="openDeleteModal(\'team-pool\',' + (t._row||0) + ',\'' + tpEsc(t.name).replace(/'/g,"\\'") + '\')" class="text-[10px] text-slate-600 hover:text-red-400 transition" title="Eliminar inscripción">🗑️</button>';

          // Botón editar (solo admin)
          var editBtn = '';
          if (sessionStorage.getItem('wg_admin_pw')) {
            editBtn = '<button onclick="openEditTeamPoolModal(' + (t._row||0) + ', this)" data-team=\'' + tpEsc(JSON.stringify(t)).replace(/'/g,"’") + '\' class="text-[10px] text-slate-500 hover:text-orange-400 transition" title="Editar (Admin)">✏️</button>';
          }

          // Multi OPGG
          var opggBtn = t.opgg
            ? '<a href="' + tpEsc(t.opgg) + '" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-orange-300 font-bold uppercase tracking-widest transition">🔗 Multi OP.GG</a>'
            : '';

          return '<div class="team-pool-card">'
            + '<span class="queue-badge">#' + queuePos + ' en cola</span>'
            + '<div class="flex items-start gap-3 mb-3 pr-16">'
            +   logoHtml
            +   '<div class="min-w-0">'
            +     '<p class="font-oswald text-white text-lg tracking-wider leading-none truncate">' + tpEsc(t.name) + '</p>'
            +     (dateStr ? '<p class="text-[10px] text-slate-600 mt-0.5 uppercase tracking-widest">' + dateStr + '</p>' : '')
            +   '</div>'
            + '</div>'
            // Badges fila 1
            + '<div class="flex flex-wrap items-center gap-1.5 mb-2">'
            +   '<span class="tp-server-badge">' + srvFlag + ' ' + tpEsc(t.server) + '</span>'
            +   '<span class="tp-div-badge">' + divIcon + ' ' + tpEsc(t.division) + '</span>'
            +   '<span class="tp-elo-badge" style="background:' + eloC.bg + ';border-color:' + eloC.border + ';color:' + eloC.text + '">📊 ' + tpEsc(t.avgElo) + ' avg</span>'
            + '</div>'
            // Capitán
            + '<div class="flex items-center gap-2 text-xs text-slate-400 mb-1">'
            +   '<span class="text-orange-400 font-bold text-[10px] uppercase tracking-widest">Capitán:</span>'
            +   '<span class="text-white font-bold">' + tpEsc(t.captain) + '</span>'
            +   (t.discord ? '<span class="text-slate-600 font-mono text-[10px]">· ' + tpEsc(t.discord) + '</span>' : '')
            + '</div>'
            // Descripción
            + (t.desc ? '<p class="text-slate-500 text-xs leading-relaxed mt-2 line-clamp-2">' + tpEsc(t.desc) + '</p>' : '')
            // Footer
            + '<div class="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">'
            +   (opggBtn || '<span></span>')
            +   '<div class="flex items-center gap-2">' + editBtn + delBtn + '</div>'
            + '</div>'
            + '</div>';
        }).join('');
      }

      /* ---- FORM ---- */
      function openTeamPoolForm() {
        document.getElementById('tp-form-modal').style.display = 'flex';
        document.getElementById('tp-form-msg').classList.add('hidden');
      }
      function closeTeamPoolForm() {
        document.getElementById('tp-form-modal').style.display = 'none';
      }
      function showTpMsg(txt, type) {
        var el = document.getElementById('tp-form-msg');
        var styles = {
          ok:   'bg-green-500/10 border-green-500/30 text-green-400',
          warn: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          err:  'bg-red-500/10 border-red-500/30 text-red-400'
        };
        el.className = 'rounded-lg p-3 text-sm font-medium border ' + (styles[type] || styles.err);
        el.textContent = txt;
        el.classList.remove('hidden');
      }

      /* ---- SUBMIT ---- */
      function submitTeamPool() {
        var btn = document.getElementById('tp-submit-btn');
        var data = {
          name:     document.getElementById('tp-input-name').value.trim(),
          server:   document.getElementById('tp-input-server').value,
          division: document.getElementById('tp-input-div').value,
          avgElo:   document.getElementById('tp-input-elo').value,
          captain:  document.getElementById('tp-input-captain').value.trim(),
          discord:  document.getElementById('tp-input-discord').value.trim(),
          opgg:     document.getElementById('tp-input-opgg').value.trim(),
          logo:     document.getElementById('tp-input-logo').value.trim(),
          desc:     document.getElementById('tp-input-desc').value.trim()
        };

        if (!data.name)     return showTpMsg('⚠️ El nombre del equipo es obligatorio.', 'warn');
        if (!data.server)   return showTpMsg('⚠️ Selecciona el servidor.', 'warn');
        if (!data.division) return showTpMsg('⚠️ Selecciona la división de interés.', 'warn');
        if (!data.avgElo)   return showTpMsg('⚠️ Selecciona la media de elo del equipo.', 'warn');
        if (!data.captain)  return showTpMsg('⚠️ El nombre del capitán es obligatorio.', 'warn');
        if (!data.discord)  return showTpMsg('⚠️ El Discord del capitán es obligatorio.', 'warn');
        if (!data.opgg)     return showTpMsg('⚠️ El Multi OP.GG es obligatorio para verificar el equipo.', 'warn');

        btn.innerHTML = '<span>⏳</span> Inscribiendo...';
        btn.disabled = true;

        google.script.run
          .withSuccessHandler(function(res) {
            btn.innerHTML = '<span>🏟️</span> INSCRIBIRSE EN LA COLA';
            btn.disabled = false;
            if (res && res.success) {
              showTpMsg('✅ ' + (res.msg || '¡Equipo inscrito en la cola!'), 'ok');
              _teamPoolCache = null;
              setTimeout(function() { closeTeamPoolForm(); loadTeamPool(); }, 1800);
            } else {
              showTpMsg((res && res.error) || 'Error desconocido.', 'err');
            }
          })
          .withFailureHandler(function(err) {
            btn.innerHTML = '<span>🏟️</span> INSCRIBIRSE EN LA COLA';
            btn.disabled = false;
            showTpMsg('❌ Error de red: ' + err.message, 'err');
          })
          .registerTeamPool(data);
      }

      /* ---- DELETE HOOK (extend existing confirmDelete) ---- */
      // Ya cubierto arriba en confirmDelete: ctx.type==='team-pool' → deleteTeamPool(payload)

      /* ---- ADMIN EDIT TEAM POOL ---- */
      function openEditTeamPoolModal(rowIndex, btnEl) {
        if (!sessionStorage.getItem('wg_admin_pw')) return;
        var teamData = null;
        try {
          // tpEsc convierte " → &quot; y ' → ' (curly quote) al escribir en innerHTML
          // Al leerlo con getAttribute, el navegador ya decodifica &quot; → "
          // Solo hay que restaurar las curly quotes si se usaron como escape de '
          var rawAttr = btnEl.getAttribute('data-team') || '';
          rawAttr = rawAttr.replace(/\u2019/g, "'"); // curly quote → straight quote
          teamData = JSON.parse(rawAttr);
        } catch(e) { alert('Error al leer datos del equipo: ' + e.message); return; }

        // Pre-rellenar campos
        document.getElementById('tp-edit-row').value    = rowIndex;
        document.getElementById('tp-edit-name').value   = teamData.name    || '';
        document.getElementById('tp-edit-captain').value= teamData.captain || '';
        document.getElementById('tp-edit-discord').value= teamData.discord || '';
        document.getElementById('tp-edit-opgg').value   = teamData.opgg    || '';
        document.getElementById('tp-edit-logo').value   = teamData.logo    || '';
        document.getElementById('tp-edit-desc').value   = teamData.desc    || '';

        var srv = document.getElementById('tp-edit-server');
        srv.value = teamData.server || '';

        var div = document.getElementById('tp-edit-div');
        div.value = teamData.division || '';

        var elo = document.getElementById('tp-edit-elo');
        elo.value = teamData.avgElo || '';

        var descCount = document.getElementById('tp-edit-desc-counter');
        if (descCount) descCount.textContent = (teamData.desc || '').length + '/300';

        var msg = document.getElementById('tp-edit-msg');
        msg.textContent = ''; msg.classList.add('hidden');

        document.getElementById('tp-edit-btn').disabled = false;
        document.getElementById('tp-edit-btn').innerHTML = '<span>✏️</span> GUARDAR CAMBIOS';

        document.getElementById('tp-edit-modal').style.display = 'flex';
      }

      function closeEditTeamPoolModal() {
        document.getElementById('tp-edit-modal').style.display = 'none';
      }

      function showTpEditMsg(txt, type) {
        var el = document.getElementById('tp-edit-msg');
        var styles = {
          ok:   'bg-green-500/10 border-green-500/30 text-green-400',
          warn: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          err:  'bg-red-500/10 border-red-500/30 text-red-400'
        };
        el.className = 'rounded-lg p-3 text-sm font-medium border ' + (styles[type] || styles.err);
        el.textContent = txt;
        el.classList.remove('hidden');
      }

      function submitEditTeamPool() {
        if (!sessionStorage.getItem('wg_admin_pw')) {
          showTpEditMsg('❌ Solo los admins pueden editar estos datos.', 'err');
          return;
        }
        var btn = document.getElementById('tp-edit-btn');
        var rowIndex = parseInt(document.getElementById('tp-edit-row').value);
        if (!rowIndex || rowIndex < 2) { showTpEditMsg('⚠️ Fila inválida.', 'warn'); return; }

        var data = {
          rowIndex: rowIndex,
          adminKey: sessionStorage.getItem('wg_admin_pw') || '',
          name:     document.getElementById('tp-edit-name').value.trim(),
          server:   document.getElementById('tp-edit-server').value,
          division: document.getElementById('tp-edit-div').value,
          avgElo:   document.getElementById('tp-edit-elo').value,
          captain:  document.getElementById('tp-edit-captain').value.trim(),
          discord:  document.getElementById('tp-edit-discord').value.trim(),
          opgg:     document.getElementById('tp-edit-opgg').value.trim(),
          logo:     document.getElementById('tp-edit-logo').value.trim(),
          desc:     document.getElementById('tp-edit-desc').value.trim()
        };

        if (!data.name)     return showTpEditMsg('⚠️ El nombre del equipo es obligatorio.', 'warn');
        if (!data.server)   return showTpEditMsg('⚠️ Selecciona el servidor.', 'warn');
        if (!data.division) return showTpEditMsg('⚠️ Selecciona la división.', 'warn');
        if (!data.avgElo)   return showTpEditMsg('⚠️ Selecciona la media de elo.', 'warn');
        if (!data.captain)  return showTpEditMsg('⚠️ El nombre del capitán es obligatorio.', 'warn');
        if (!data.discord)  return showTpEditMsg('⚠️ El Discord del capitán es obligatorio.', 'warn');

        btn.innerHTML = '<span>⏳</span> Guardando...';
        btn.disabled = true;

        google.script.run
          .withSuccessHandler(function(res) {
            btn.innerHTML = '<span>✏️</span> GUARDAR CAMBIOS';
            btn.disabled = false;
            if (res && res.success) {
              showTpEditMsg('✅ ' + (res.msg || '¡Equipo actualizado correctamente!'), 'ok');
              _teamPoolCache = null;
              setTimeout(function() { closeEditTeamPoolModal(); loadTeamPool(); }, 1500);
            } else {
              showTpEditMsg((res && res.error) || 'Error desconocido.', 'err');
            }
          })
          .withFailureHandler(function(err) {
            btn.innerHTML = '<span>✏️</span> GUARDAR CAMBIOS';
            btn.disabled = false;
            showTpEditMsg('❌ Error de red: ' + err.message, 'err');
          })
          .updateTeamPool(data);
      }

      /* ---- SWITCHAB HOOK ---- */
      (function() {
        var _orig = window.switchTab;
        window.switchTab = function(tabId, el) {
          if (typeof _orig === 'function') _orig(tabId, el);
          if (tabId === 'team-pool' && _teamPoolCache === null) loadTeamPool();
        };
      })();
    