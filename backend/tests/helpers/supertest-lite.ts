import type { Express } from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";

type Headers = Record<string, string>;

type TestResponse = {
  status: number;
  body: unknown;
  headers: Record<string, unknown>;
};

class TestRequest implements PromiseLike<TestResponse> {
  private readonly app: Express;
  private readonly method: string;
  private readonly path: string;
  private headers: Headers = {};
  private body: unknown = undefined;

  constructor(app: Express, method: string, path: string) {
    this.app = app;
    this.method = method;
    this.path = path;
  }

  set(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  send(body: unknown) {
    this.body = body;
    return this.exec();
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  private exec(): Promise<TestResponse> {
    return new Promise((resolve, reject) => {
      try {
        class MockSocket extends Duplex {
          remoteAddress = "127.0.0.1";

          constructor() {
            super();
            this.readable = true;
            this.writable = true;
          }

          _read() {
            return;
          }

          _write(_chunk: unknown, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
            callback();
          }

          cork() {
            return;
          }

          uncork() {
            return;
          }

          setTimeout() {
            return this;
          }

          setNoDelay() {
            return this;
          }

          setKeepAlive() {
            return this;
          }
        }

        const socket = new MockSocket();
        const req = new IncomingMessage(socket as unknown as NodeJS.ReadableStream);
        const res = new ServerResponse(req);

        (req as { connection?: unknown }).connection = socket;
        (req as { socket?: unknown }).socket = socket;
        Object.defineProperty(req, "ip", {
          value: "127.0.0.1",
          writable: false,
          enumerable: true,
          configurable: true,
        });

        req.method = this.method;
        req.url = this.path;
        req.headers = { ...this.headers };
        if (this.body !== undefined) {
          (req as { body?: unknown }).body = this.body;
        }

        const chunks: Buffer[] = [];
        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);

        res.write = ((chunk: unknown, ...args: unknown[]) => {
          if (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          }
          return originalWrite(chunk as never, ...(args as never[]));
        }) as typeof res.write;

        let resolved = false;

        const finalize = () => {
          if (resolved) {
            return;
          }
          resolved = true;
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = raw;
          try {
            parsed = raw ? JSON.parse(raw) : raw;
          } catch {
            parsed = raw;
          }

          resolve({
            status: res.statusCode,
            body: parsed,
            headers: res.getHeaders(),
          });
        };

        res.end = ((chunk?: unknown, ...args: unknown[]) => {
          if (chunk) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          }
          const result = originalEnd(chunk as never, ...(args as never[]));
          finalize();
          return result;
        }) as typeof res.end;

        res.on("finish", () => {
          finalize();
        });

        let payload: string | undefined;
        if (this.body !== undefined) {
          payload = typeof this.body === "string" ? this.body : JSON.stringify(this.body);
          if (!req.headers["content-type"]) {
            req.headers["content-type"] = "application/json";
          }
          req.headers["content-length"] = Buffer.byteLength(payload).toString();
        }

        this.app.handle(req, res);

        process.nextTick(() => {
          if (payload !== undefined) {
            req.push(payload);
          }
          req.push(null);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default function request(app: Express) {
  return {
    get: (path: string) => new TestRequest(app, "GET", path),
    post: (path: string) => new TestRequest(app, "POST", path),
    patch: (path: string) => new TestRequest(app, "PATCH", path),
    delete: (path: string) => new TestRequest(app, "DELETE", path),
  };
}
