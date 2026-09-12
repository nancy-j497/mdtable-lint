// Minimal ambient declarations for the handful of Node built-ins this
// project touches, so the compiler doesn't need @types/node installed.

declare const process: {
  argv: string[];
  exit(code: number): never;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
};

declare module 'fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;
  export function statSync(path: string): { isDirectory(): boolean };
  export interface Dirent {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
  }
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
}

declare module 'path' {
  export function join(...parts: string[]): string;
}
