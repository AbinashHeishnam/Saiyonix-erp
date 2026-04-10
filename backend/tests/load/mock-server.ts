import express from "express";

const app = express();
const port = Number.parseInt(process.env.MOCK_SERVER_PORT ?? "4000", 10);

function ok(res: express.Response, payload: Record<string, unknown>) {
  return res.status(200).json({ success: true, data: payload });
}

app.get("/api/v1/results/:examId", (req, res) => {
  return ok(res, { examId: req.params.examId, status: "PUBLISHED" });
});

app.get("/api/v1/report-cards/:examId", (req, res) => {
  return ok(res, { examId: req.params.examId, status: "READY" });
});

app.get("/api/v1/ranking/:examId", (req, res) => {
  return ok(res, { examId: req.params.examId, items: [] });
});

app.get("/api/v1/admit-cards/:examId", (req, res) => {
  return ok(res, { examId: req.params.examId, status: "UNLOCKED" });
});

app.listen(port, "127.0.0.1", () => {
  console.log(`[mock-load-server] listening on http://127.0.0.1:${port}`);
});
