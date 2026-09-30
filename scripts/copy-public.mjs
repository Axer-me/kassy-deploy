import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'public');

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(dest, 'index.html'));
fs.copyFileSync(path.join(root, 'favicon.svg'), path.join(dest, 'favicon.svg'));
fs.cpSync(path.join(root, 'assets'), path.join(dest, 'assets'), { recursive: true });

console.log('Copied static files to public/');
