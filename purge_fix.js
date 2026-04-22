const fs = require('fs');
const path = require('path');

function purge(filePath) {
  if (!fs.existsSync(filePath)) return;
  console.log(`Purgando: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Lista de secuencias de basura comunes en este proyecto
  const garbage = [
    'Ã‚Â', 
    'Ã‚', 
    '\u00C2\u00A0', // El espacio duro real codificado mal
    '\u00C2'        // El prefijo fantasma
  ];
  
  let originalLength = content.length;
  
  garbage.forEach(g => {
    content = content.split(g).join(' ');
  });
  
  // Tambien arreglar la codificación de la 'ó' que se rompió en el comentario
  content = content.split('ÃƒÂ³').join('o');
  
  // Eliminar CUALQUIER carácter que no sea ASCII estándar para estar seguros
  // Google Apps Script a veces odia caracteres invisibles por encima de 127
  content = content.replace(/[^\x00-\x7F]/g, ' ');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Finalizado. ${filePath} purgado.`);
}

purge('Code.js');
purge('code.gs');
