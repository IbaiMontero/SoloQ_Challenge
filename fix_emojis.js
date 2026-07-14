const fs = require('fs');
let code = fs.readFileSync('Code.js', 'utf8');

const replacements = [
  { bad: "ðŸ †", good: "🏆" },
  { bad: "ðŸ’¥", good: "💥" },
  { bad: "ðŸš¨", good: "🚨" },
  { bad: "ðŸ“¢", good: "📢" },
  { bad: "ðŸ—“ï¸ ", good: "📅" },
  { bad: "ðŸ“ ", good: "📌" },
  { bad: "ðŸ‘‰", good: "👉" },
  { bad: "âœ…", good: "✅" },
  { bad: "âš”ï¸ ", good: "⚔️" },
  { bad: "â Œ", good: "❌" },
  { bad: "ðŸ‘€", good: "👀" },
  { bad: "ðŸ’Ž", good: "💎" },
  { bad: "ðŸ‘‘", good: "👑" },
  { bad: "ðŸ”¥", good: "🔥" },
  { bad: "ðŸŽ“", good: "🎓" }
];

for (let r of replacements) {
  code = code.split(r.bad).join(r.good);
}

fs.writeFileSync('Code.js', code, 'utf8');
console.log('Fixed emojis in Code.js');
