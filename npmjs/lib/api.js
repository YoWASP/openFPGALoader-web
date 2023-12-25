import instantiate from '../gen/openFPGALoader.mjs';

export class Exit extends Error {
    constructor(code, files) {
        super(`Exited with status ${code}`);
        this.code = code;
        this.files = files;
    }
}

function makeTerminalWrite({ print = null, printLine = null }) {
    let terminalBuffer = [];
    return function(charCode) {
        // `print` takes priority over `printLine`
        if (print !== null) {
            if (charCode !== null)
                terminalBuffer.push(charCode);
            // flush explicitly, on CR and LF; this avoids flickering of progress messages
            if (charCode === null || charCode === 10 || charCode == 13)
                print(String.fromCharCode(...terminalBuffer.splice(0)));
        } else if (printLine !== null) {
            // only flush on LF
            if (charCode === null) {
            } else if (charCode === 10) {
                printLine(String.fromCharCode(...terminalBuffer.splice(0)));
            } else {
                terminalBuffer.push(charCode);
            }
        }
    };
}

function writeTreeToMEMFS(FS, tree, path = '/') {
    for(const [filename, data] of Object.entries(tree)) {
        const filepath = `${path}${filename}`;
        if (typeof data === 'string' || data instanceof Uint8Array) {
            FS.writeFile(filepath, data);
        } else {
            FS.mkdir(filepath);
            writeTreeToMEMFS(FS, data, `${filepath}/`);
        }
    }
}

function readTreeFromMEMFS(FS, path = '/') {
    const tree = {};
    for (const filename of FS.readdir(path)) {
        const filepath = `${path}${filename}`;
        if (filename === '.' || filename === '..')
            continue;
        if (['/tmp', '/dev', '/proc'].includes(filepath))
            continue;
        const stat = FS.stat(filepath);
        if (FS.isFile(stat.mode)) {
            tree[filename] = FS.readFile(filepath, { encoding: 'binary' });
        } else if (FS.isDir(stat.mode)) {
            tree[filename] = readTreeFromMEMFS(FS, `${filepath}/`);
        }
    }
    return tree;
}

export async function runOpenFPGALoader(args = null, filesIn = {}, options = { printLine: console.log }) {
    if (args === null)
        return;

    const terminalWrite = makeTerminalWrite(options);
    const inst = await instantiate({
        stdin: () => null,
        stdout: terminalWrite,
        stderr: terminalWrite,
    });
    inst.FS.rmdir('/home/web_user');
    inst.FS.rmdir('/home');
    writeTreeToMEMFS(inst.FS, filesIn);

    const argv = ['openFPGALoader', ...args, null];
    const argvPtr = inst.stackAlloc(argv.length * 4);
    argv.forEach((arg, off) =>
        inst.HEAPU32[(argvPtr>>2)+off] = arg === null ? 0 : inst.stringToUTF8OnStack(arg));

    const exitCode = await inst.ccall('main', 'number', ['number', 'number'],
        [argv.length - 1, argvPtr], { async: true });
    inst._fflush(0);
    const filesOut = readTreeFromMEMFS(inst.FS);

    if (exitCode == 0) {
        return filesOut;
    } else {
        throw new Exit(exitCode, filesOut)
    }
}

runOpenFPGALoader.requiresUSBDevice = [];

export const commands = {
    openFPGALoader: runOpenFPGALoader
};
