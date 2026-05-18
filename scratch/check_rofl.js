
const fs = require('fs');
const filePath = 'c:\\Users\\elzorro1\\OneDrive\\Escritorio\\Antigravity\\SoloQ_Challenge\\DoB Illume vs Time2Asilo.rofl';

const buffer = fs.readFileSync(filePath);
const text = buffer.toString('utf8'); // Check whole file

console.log('gameLength index:', text.indexOf('{"gameLength"'));
console.log('gameDuration index:', text.indexOf('{"gameDuration"'));
console.log('statsJson index:', text.indexOf('statsJson'));
console.log('RIOT index:', text.indexOf('RIOT'));

if (text.indexOf('{"gameLength"') === -1 && text.indexOf('{"gameDuration"') === -1) {
    console.log('Searching for any JSON start...');
    const match = text.match(/\{"[a-zA-Z0-9]+"\s*:/);
    if (match) {
        console.log('Found potential JSON start at:', match.index);
        console.log('Context:', text.substring(match.index, match.index + 100));
    }
}
