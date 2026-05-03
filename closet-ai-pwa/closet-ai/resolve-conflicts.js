const fs = require('fs');
const filePath = './src/App.jsx';

let content = fs.readFileSync(filePath, 'utf8');

// Patrón para encontrar conflictos y mantener HEAD
const conflictRegex = /<<<<<<< HEAD\r?\n([\s\S]*?)\r?\n=======\r?\n[\s\S]*?\r?\n>>>>>>> [a-f0-9]{40}\r?\n/g;

let matches = 0;
const resolved = content.replace(conflictRegex, (fullMatch, headContent) => {
  matches++;
  return headContent + '\n';
});

if (matches > 0) {
  fs.writeFileSync(filePath, resolved, 'utf8');
  console.log(`✓ ${matches} conflictos resueltos`);
  process.exit(0);
} else {
  console.log('✗ No se encontraron conflictos');
  process.exit(1);
}
