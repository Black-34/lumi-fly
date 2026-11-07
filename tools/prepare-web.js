// Copies the Capacitor runtime and the two fonts (SIL Open Font License) into www/.
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', 'node_modules'), WWW = path.join(__dirname, '..', 'www');

const cap = path.join(NM, '@capacitor/core/dist/capacitor.js');
if (!fs.existsSync(cap)) throw new Error('capacitor.js not found');
fs.copyFileSync(cap, path.join(WWW, 'capacitor.js'));

const out = path.join(WWW, 'fonts'); fs.mkdirSync(out, { recursive: true });
let css = '';
for (const [pkg, file] of [['lilita-one', '400.css'], ['fredoka', '500.css'], ['fredoka', '600.css']]) {
  const dir = path.join(NM, '@fontsource', pkg);
  let c = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const m of c.matchAll(/url\(\.\/files\/([^)]+)\)/g)) fs.copyFileSync(path.join(dir, 'files', m[1]), path.join(out, m[1]));
  css += c.replace(/url\(\.\/files\//g, 'url(./') + '\n';
  const lic = path.join(dir, 'LICENSE');
  if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(out, 'LICENSE-' + pkg + '.txt'));
}
// the game asks for "Lilita One" and "Fredoka" – same names as fontsource uses
fs.writeFileSync(path.join(out, 'fonts.css'), css);
console.log('web assets ready:', fs.readdirSync(out).length, 'font files');
