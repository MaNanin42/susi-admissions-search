import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const data=JSON.parse(read('data.json'));
const html=read('template.html').replace('__DATA__',JSON.stringify(data).replace(/</g,'\\u003c')).replace('__UI__',read('ui.js'));
if(process.argv.includes('--check')){if(read('index.html')!==html)throw Error('Contract module build differs');}
else fs.writeFileSync(path.join(root,'index.html'),html);
console.log('[PASS] 2028 contract module build');
