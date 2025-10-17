import express from "express";
import cron from "node-cron";
import { getTopHoldersMoralis } from "./holders.js";
import {
  getBNBBalance,
  getPAXGBalance,
  swapBNBtoPAXG,
  waitForOrderCompletion,
} from "./debridge.js";
import {
  distributePAXG,
  saveDistributionHistory,
  getDistributionSummary,
} from "./distributor.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let isRunning = false;
let lastRunTime = null;
let lastRunStatus = null;

async function runDistributionCycle() {
  if (isRunning) {
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  try {
    const bnbBalance = await getBNBBalance();

    if (parseFloat(bnbBalance.balance) === 0) {
      lastRunStatus = "No BNB to convert";
      return;
    }

    const swapResult = await swapBNBtoPAXG(bnbBalance.balance);
    const orderStatus = await waitForOrderCompletion(swapResult.orderId);

    if (!orderStatus.completed) {
      lastRunStatus = `Order failed: ${orderStatus.error}`;
      return;
    }

    const paxgBalance = await getPAXGBalance();

    if (parseFloat(paxgBalance.balance) === 0) {
      lastRunStatus = "No PAXG received";
      return;
    }

    const holders = await getTopHoldersMoralis();
    const distributionResults = await distributePAXG(
      holders,
      parseFloat(paxgBalance.balance),
    );

    await saveDistributionHistory(
      distributionResults,
      parseFloat(paxgBalance.balance),
    );
    const summary = await getDistributionSummary(distributionResults);

    lastRunStatus = `Success: ${summary.successful}/${summary.totalRecipients} distributions`;
  } catch (error) {
    lastRunStatus = `Error: ${error.message}`;
  } finally {
    isRunning = false;
  }
}

cron.schedule("0 * * * *", () => {
  runDistributionCycle();
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    isRunning: isRunning,
    lastRunTime: lastRunTime,
    lastRunStatus: lastRunStatus,
    uptime: process.uptime(),
  });
});

app.post("/distribute", async (req, res) => {
  if (isRunning) {
    return res.status(409).json({
      error: "Distribution cycle already running",
      isRunning: true,
    });
  }

  res.json({ message: "Distribution cycle started" });
  runDistributionCycle();
});

app.get("/status", (req, res) => {
  res.json({
    isRunning: isRunning,
    lastRunTime: lastRunTime,
    lastRunStatus: lastRunStatus,
    nextRun: "Every 60 minutes at the top of the hour",
  });
});

app.listen(port);

process.on("SIGINT", () => {
  process.exit(0);
});
