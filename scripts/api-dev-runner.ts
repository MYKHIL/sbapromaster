/**
 * Runs Vercel API handlers in plain Node (tsx) so firebase-admin can use require().
 * Invoked by vite-api-dev.ts during local development.
 */
import dotenv from 'dotenv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

dotenv.config();

const HANDLERS: Record<string, () => Promise<{ default: (req: VercelRequest, res: VercelResponse) => Promise<unknown> }>> = {
    'activate-trial': () => import('../api/activate-trial'),
    'initialize-payment': () => import('../api/initialize-payment'),
    'verify-payment': () => import('../api/verify-payment'),
};

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString();
}

async function main() {
    const handlerId = process.argv[2];
    const loader = HANDLERS[handlerId];
    if (!loader) {
        process.stdout.write(JSON.stringify({
            status: 500,
            body: { error: `Unknown API handler: ${handlerId}` },
        }));
        process.exit(1);
    }

    const payload = JSON.parse(await readStdin()) as {
        method?: string;
        headers?: Record<string, string | string[] | undefined>;
        body?: unknown;
        query?: Record<string, string>;
    };

    const vercelReq = {
        method: payload.method,
        headers: payload.headers ?? {},
        body: payload.body,
        query: payload.query ?? {},
    } as VercelRequest;

    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let responseBody: unknown = null;
    let ended = false;

    const vercelRes = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        setHeader(name: string, value: string | number | readonly string[]) {
            responseHeaders[name] = Array.isArray(value) ? value.join(', ') : String(value);
            return this;
        },
        json(data: unknown) {
            if (!ended) {
                ended = true;
                responseBody = data;
            }
            return this;
        },
        end(data?: string) {
            if (!ended) {
                ended = true;
                if (data) {
                    try {
                        responseBody = JSON.parse(data);
                    } catch {
                        responseBody = { message: data };
                    }
                }
            }
        },
    } as VercelResponse;

    try {
        const mod = await loader();
        await mod.default(vercelReq, vercelRes);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        statusCode = 500;
        responseBody = { error: 'Internal server error', message };
        ended = true;
    }

    if (!ended) {
        responseBody = responseBody ?? { error: 'Handler did not send a response' };
    }

    process.stdout.write(JSON.stringify({
        status: statusCode,
        headers: responseHeaders,
        body: responseBody,
    }));
}

main().catch((err) => {
    process.stdout.write(JSON.stringify({
        status: 500,
        body: { error: err instanceof Error ? err.message : String(err) },
    }));
    process.exit(1);
});
