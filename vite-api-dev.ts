import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const runnerScript = path.join(projectRoot, 'scripts', 'api-dev-runner.ts');

function getRunnerCommand(handlerId: string): { command: string; args: string[] } {
    const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    if (existsSync(tsxCli)) {
        return {
            command: process.execPath,
            args: [tsxCli, runnerScript, handlerId],
        };
    }

    const localTsx = path.join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
    if (existsSync(localTsx)) {
        return { command: localTsx, args: [runnerScript, handlerId] };
    }

    return {
        command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args: ['tsx', runnerScript, handlerId],
    };
}

/**
 * Run a Vercel API handler in a child Node process (tsx) so CJS deps like firebase-admin work.
 */
export async function invokeLocalApi(
    handlerId: string,
    req: IncomingMessage,
    res: ServerResponse
): Promise<void> {
    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const bodyStr = Buffer.concat(chunks).toString();
    const url = new URL(req.url || '/', 'http://localhost');

    let parsedBody: unknown = undefined;
    if (bodyStr) {
        try {
            parsedBody = JSON.parse(bodyStr);
        } catch {
            parsedBody = bodyStr;
        }
    }

    const payload = JSON.stringify({
        method: req.method,
        headers: req.headers,
        body: parsedBody,
        query: Object.fromEntries(url.searchParams.entries()),
    });

    const { command, args } = getRunnerCommand(handlerId);

    await new Promise<void>((resolve) => {
        const child = spawn(command, args, {
            cwd: projectRoot,
            env: process.env,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            shell: false,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });
        child.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        child.on('error', (err) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Failed to start API runner', message: err.message }));
            resolve();
        });

        child.on('close', (code) => {
            if (code !== 0 && !stdout.trim()) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    error: 'API runner failed',
                    message: stderr.trim() || `exit code ${code}`,
                }));
                resolve();
                return;
            }

            try {
                const result = JSON.parse(stdout.trim() || '{}') as {
                    status?: number;
                    headers?: Record<string, string>;
                    body?: unknown;
                };

                res.statusCode = result.status ?? (code === 0 ? 200 : 500);
                if (result.headers) {
                    for (const [key, value] of Object.entries(result.headers)) {
                        res.setHeader(key, value);
                    }
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result.body ?? {}));
            } catch {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                    error: 'Invalid API runner output',
                    message: stderr.trim() || stdout.slice(0, 500),
                }));
            }
            resolve();
        });

        child.stdin.write(payload);
        child.stdin.end();
    });
}
