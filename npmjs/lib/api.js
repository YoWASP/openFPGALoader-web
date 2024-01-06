import instantiate from '../gen/openFPGALoader.mjs';
import { lineBuffered } from '@yowasp/runtime/util';

export class Exit extends Error {
    constructor(code, files) {
        super(`Exited with status ${code}`);
        this.code = code;
        this.files = files;
    }
}

function createStreamDevice(FS, path, index, ops) {
    const dev = FS.makedev(2, index);
    FS.registerDevice(dev, {
        open(stream) {
            stream.seekable = false;
        },
        read(stream, buffer, offset, length, pos) {
            throw new FS.ErrnoError(29); /* EIO */
        },
        write(stream, buffer, offset, length, pos) {
            if (ops.write !== undefined) {
                // `buffer` is a slice of `HEAP8`, which is a `Int8Array`.
                ops.write(new Uint8Array(buffer.slice(offset, offset + length)));
                return length;
            }
            throw new FS.ErrnoError(29); /* EIO */
        },
        fsync(stream) {
            if (ops.write !== undefined)
                ops.write(null);
        }
    });
    FS.mkdev(path, dev);
    return path;
}

function createStandardStreams(FS, { stdout, stderr }) {
    const lineBufferedConsole = lineBuffered(console.log);
    function makeStream(streamOption) {
        if (streamOption === undefined)
            return lineBufferedConsole;
        if (streamOption === null)
            return (_bytes) => {};
        return streamOption;
    }

    createStreamDevice(FS, '/dev/stdin', 0, {});
    createStreamDevice(FS, '/dev/stdout', 1, { write: makeStream(stdout) });
    createStreamDevice(FS, '/dev/stderr', 2, { write: makeStream(stderr) });
    FS.open('/dev/stdin', 0);
    FS.open('/dev/stdout', 1);
    FS.open('/dev/stderr', 1);
}

function writeTree(FS, tree, path = '/') {
    for(const [filename, data] of Object.entries(tree)) {
        const filepath = `${path}${filename}`;
        if (typeof data === 'string' || data instanceof Uint8Array) {
            FS.writeFile(filepath, data);
        } else {
            FS.mkdir(filepath);
            writeTree(FS, data, `${filepath}/`);
        }
    }
}

function readTree(FS, path = '/') {
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
            tree[filename] = readTree(FS, `${filepath}/`);
        }
    }
    return tree;
}

export async function runOpenFPGALoader(args = null, filesIn = {}, options = {}) {
    if (args === null)
        return;

    const inst = await instantiate({ noFSInit: true });
    createStandardStreams(inst.FS, options);
    writeTree(inst.FS, filesIn);

    const argv = ['openFPGALoader', ...args, null];
    const argvPtr = inst.stackAlloc(argv.length * 4);
    argv.forEach((arg, off) =>
        inst.HEAPU32[(argvPtr>>2)+off] = arg === null ? 0 : inst.stringToUTF8OnStack(arg));
    const exitCode = await inst.ccall('main', 'number', ['number', 'number'],
        [argv.length - 1, argvPtr], { async: true });
    inst._fflush(0);

    const filesOut = readTree(inst.FS);
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
