const fs = require('fs');
let code = fs.readFileSync('Code.js', 'utf8');

// fix toString on result or allMatchesData
code = code.replace(/([\w\[\]\.]+)\s*\.toString\(\)\.includes\('Win'\)/g, "(String($1) || '').includes('Win')");
code = code.replace(/result\.toString/g, "(String(result))");
code = code.replace(/\.toString\(\)\.toLowerCase/g, "?.toString()?.toLowerCase");

fs.writeFileSync('Code.js', code);
console.log("Replaced toString issues");
