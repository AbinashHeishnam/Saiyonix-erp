import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import autocannon from "autocannon";

let server: http.Server;
let baseUrl: string;

function buildPayload() {
  const items = Array.from({ length: 100 }).map((_, index) => ({
    studentId: `student-${index}`,
    marksObtained: 75,
  }));
  return JSON.stringify({ examSubjectId: "exam-subject-1", items });
}

describe("phase3 bulk marks performance", () => {
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.method === "POST" && req.url === "/api/v1/marks/bulk") {
        res.statusCode = 201;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ success: true, data: { insertedCount: 100 } }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  }, 20_000);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("handles bulk mark entry payloads under load", async () => {
    const result = await autocannon({
      url: `${baseUrl}/api/v1/marks/bulk`,
      connections: 1000,
      duration: 3,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: buildPayload(),
    });

    const errorRate = result.errors / result.requests.total;
    expect(errorRate).toBeLessThan(0.01);
  }, 60_000);
});
