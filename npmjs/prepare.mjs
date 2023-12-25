import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const gitDescribe = execFileSync('git', ['-C', '../openFPGALoader-src', 'describe'], {'encoding': 'utf-8'});
const [, major, minor, patch, node] = gitDescribe.match(/^v(\d+).(\d+).(\d+)(?:-(\d+)-)?/);

const revCount = execFileSync('git', ['rev-list', 'HEAD'], {encoding: 'utf-8'}).split('\n').length - 1;
const packageJSON = JSON.parse(readFileSync('package-in.json', {encoding: 'utf-8'}));

const version = `${major}.${minor}.${patch}-${node ?? '0'}.${revCount}`;
console.log(`version ${version}`);

packageJSON.version = version;
writeFileSync('package.json', JSON.stringify(packageJSON, null, 4));
