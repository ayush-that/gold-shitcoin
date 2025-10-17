import express from "express";
import cron from "node-cron";
import { runDistributionCycle } from "./orchestrator.js";
import { getTopHoldersMoralis } from "./holders.js";
import dotenv from "dotenv";
import { promises as fs } from "fs";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let isRunning = false;
let lastRunResult = null;

function toJSONSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === "bigint" ? val.toString() : val,
    ),
  );
}

async function executeCycle() {
  if (isRunning) {
    console.log("[SERVER] Cycle already running, skipping");
    return;
  }

  console.log("[SERVER] Starting distribution cycle");
  isRunning = true;

  try {
    const result = await runDistributionCycle();
    const safeResult = toJSONSafe(result);
    lastRunResult = safeResult;
    console.log(
      "[SERVER] Cycle completed:",
      JSON.stringify(safeResult, null, 2),
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `bridge-dist-${timestamp}.json`;
    await fs.writeFile(filename, JSON.stringify(safeResult, null, 2));
    console.log(`[SERVER] Saved results to ${filename}`);
  } catch (error) {
    console.log(`[SERVER] Cycle failed with error: ${error.message}`);
    console.log(`[SERVER] Error stack:`, error.stack);
    lastRunResult = {
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  } finally {
    isRunning = false;
    console.log("[SERVER] Cycle finished, isRunning set to false");
  }
}

cron.schedule("*/10 * * * *", () => {
  console.log("[SERVER] Cron triggered at", new Date().toISOString());
  executeCycle();
});

app.get("/health", (req, res) => {
  console.log("[SERVER] Health check");
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/run", async (req, res) => {
  console.log("[SERVER] Manual run triggered");
  if (isRunning) {
    console.log("[SERVER] Rejected: already running");
    return res.status(409).json({
      error: "Distribution cycle already running",
      isRunning: true,
    });
  }

  res.json({ message: "Distribution cycle started" });
  executeCycle();
});

app.get("/status", (req, res) => {
  console.log("[SERVER] Status check");
  res.json({
    isRunning: isRunning,
    lastRun: lastRunResult,
    nextRun: "Every 10 minutes",
  });
});

app.get("/holders", async (req, res) => {
  console.log("[SERVER] Holders fetch");
  try {
    const holders = await getTopHoldersMoralis();
    res.json({ count: holders.length, holders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

console.log(`[SERVER] Starting server on port ${port}`);
app.listen(port, () => {
  console.log(`[SERVER] Server listening on port ${port}`);
});

process.on("SIGINT", () => {
  console.log("[SERVER] Received SIGINT, shutting down");
  process.exit(0);
});
