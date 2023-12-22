export type Tree = {
    [name: string]: Tree | string | Uint8Array
};

export class Exit extends Error {
    code: number;
    files: Tree;
}

export type Command = {
    (args?: string[], files?: Tree, options?: {
        print?: (chars: string) => void,
        printLine?: (line: string) => void
    }): Promise<Tree>;

    requiresUSBDevice: {
        vendorId?: number,
        productId?: number,
        classCode?: number,
        subclassCode?: number,
        protocolCode?: number,
        serialNumber?: number
    }[];
};


export const runOpenFPGALoader: Command;

export const commands: {
    'openFPGALoader': Command,
};
