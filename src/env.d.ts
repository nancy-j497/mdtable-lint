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
}
