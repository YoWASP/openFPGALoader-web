import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const revCount = execFileSync('git', ['rev-list', 'HEAD'], {encoding: 'utf-8'}).split('\n').length - 1;
const packageJSON = JSON.parse(readFileSync('package-in.json', {encoding: 'utf-8'}));

let version = `0.0.0-experimental${revCount - 1}`;
console.log(`version ${version}`);

packageJSON.version = version;
writeFileSync('package.json', JSON.stringify(packageJSON, null, 4));
