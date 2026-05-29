const fs = require('fs');
let c = fs.readFileSync('LeagueMenu.html', 'utf8');
const searchStr = 'Cara a Cara por';
const searchIndex = c.indexOf(searchStr);
const tagStart = c.lastIndexOf('<h3', searchIndex);

const insertHtml = "        html += '<div class=\"grid grid-cols-1 md:grid-cols-2 gap-4 mb-6\">';\n" +
"        html += '<div class=\"bg-slate-900 border border-slate-700 rounded-xl p-4\"><h4 class=\"text-center font-bold text-xs uppercase mb-2 text-slate-400 tracking-widest\">Team Profile (Averages)</h4><div style=\"position:relative; height:250px; width:100%\"><canvas id=\"teamScoutRadar\"></canvas></div></div>';\n" +
"        html += '<div class=\"bg-slate-900 border border-slate-700 rounded-xl p-4\"><h4 class=\"text-center font-bold text-xs uppercase mb-2 text-slate-400 tracking-widest\">Global Objectives & Vision</h4><div style=\"position:relative; height:250px; width:100%\"><canvas id=\"teamScoutBar\"></canvas></div></div>';\n" +
"        html += '</div>';\n\n";

c = c.slice(0, tagStart) + insertHtml + c.slice(tagStart);

fs.writeFileSync('LeagueMenu.html', c);
