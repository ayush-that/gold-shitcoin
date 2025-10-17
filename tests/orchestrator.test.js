import { describe, it, expect, vi, beforeEach } from "vitest";
import { ethers } from "ethers";

vi.mock("../bridge.js", () => ({
  getBNBBalance: vi.fn(),
  createDlnOrderBNBtoPAXG: vi.fn(),
}));

vi.mock("../holders.js", () => ({
  getTopHoldersMoralis: vi.fn(),
}));

describe("Orchestrator Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runDistributionCycle", () => {
    it("should skip cycle when BNB balance < 1", async () => {
      const { getBNBBalance } = await import("../bridge.js");
      getBNBBalance.mockResolvedValue("0.5");

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      expect(result.status).toBe("skipped_low_balance");
      expect(result.bnbBalance).toBe("0.5");
      expect(result.timestamp).toBeDefined();
    });

    it("should process distribution for eligible holders", async () => {
      const { getBNBBalance, createDlnOrderBNBtoPAXG } = await import(
        "../bridge.js"
      );
      const { getTopHoldersMoralis } = await import("../holders.js");

      getBNBBalance.mockResolvedValue("10.0");

      getTopHoldersMoralis.mockResolvedValue([
        {
          rank: 1,
          address: "0xHolder1",
          balance: "5000",
          percentage: 50,
        },
        {
          rank: 2,
          address: "0xHolder2",
          balance: "3000",
          percentage: 30,
        },
        {
          rank: 3,
          address: "0xHolder3",
          balance: "2000",
          percentage: 20,
        },
      ]);

      createDlnOrderBNBtoPAXG.mockResolvedValue({
        hash: "0xHash",
        status: 1,
        orderId: "order-123",
      });

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      expect(result.status).toBe("completed");
      expect(result.attempted).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(parseFloat(result.totalBNBUsed)).toBeGreaterThan(0);
    });

    it("should skip holders below minimum threshold", async () => {
      const { getBNBBalance, createDlnOrderBNBtoPAXG } = await import(
        "../bridge.js"
      );
      const { getTopHoldersMoralis } = await import("../holders.js");

      getBNBBalance.mockResolvedValue("1.0");

      getTopHoldersMoralis.mockResolvedValue([
        {
          rank: 1,
          address: "0xHolder1",
          balance: "9000",
          percentage: 90,
        },
        {
          rank: 2,
          address: "0xHolder2",
          balance: "1000",
          percentage: 10,
        },
      ]);

      createDlnOrderBNBtoPAXG.mockResolvedValue({
        hash: "0xHash",
        status: 1,
        orderId: "order-123",
      });

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      expect(result.status).toBe("completed");
      expect(result.skippedLowMin).toBeGreaterThan(0);
      expect(parseFloat(result.unassignedRemainderBNB)).toBeGreaterThan(0);
    });

    it("should handle partial failures gracefully", async () => {
      const { getBNBBalance, createDlnOrderBNBtoPAXG } = await import(
        "../bridge.js"
      );
      const { getTopHoldersMoralis } = await import("../holders.js");

      getBNBBalance.mockResolvedValue("10.0");

      getTopHoldersMoralis.mockResolvedValue([
        {
          rank: 1,
          address: "0xHolder1",
          balance: "5000",
          percentage: 50,
        },
        {
          rank: 2,
          address: "0xHolder2",
          balance: "5000",
          percentage: 50,
        },
      ]);

      let callCount = 0;
      createDlnOrderBNBtoPAXG.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            hash: "0xHash",
            status: 1,
            orderId: "order-123",
          });
        }
        return Promise.reject(new Error("DLN error"));
      });

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      expect(result.status).toBe("completed");
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe("DLN error");
    });

    it("should calculate proportional shares correctly", async () => {
      const { getBNBBalance, createDlnOrderBNBtoPAXG } = await import(
        "../bridge.js"
      );
      const { getTopHoldersMoralis } = await import("../holders.js");

      getBNBBalance.mockResolvedValue("10.0");

      getTopHoldersMoralis.mockResolvedValue([
        {
          rank: 1,
          address: "0xHolder1",
          balance: "6000",
          percentage: 60,
        },
        {
          rank: 2,
          address: "0xHolder2",
          balance: "4000",
          percentage: 40,
        },
      ]);

      const capturedAmounts = [];
      createDlnOrderBNBtoPAXG.mockImplementation((amountWei) => {
        capturedAmounts.push(amountWei);
        return Promise.resolve({
          hash: "0xHash",
          status: 1,
          orderId: "order-123",
        });
      });

      const { runDistributionCycle } = await import("../orchestrator.js");
      await runDistributionCycle();

      const total = capturedAmounts.reduce((a, b) => a + b, 0n);
      const expectedTotal = ethers.parseEther("9.5");
      const tolerance = ethers.parseEther("0.01");

      expect(total).toBeGreaterThan(expectedTotal - tolerance);
      expect(total).toBeLessThan(expectedTotal + tolerance);

      const ratio = Number(capturedAmounts[0]) / Number(capturedAmounts[1]);
      expect(ratio).toBeCloseTo(1.5, 1);
    });

    it("should process holders in concurrent batches", async () => {
      const { getBNBBalance, createDlnOrderBNBtoPAXG } = await import(
        "../bridge.js"
      );
      const { getTopHoldersMoralis } = await import("../holders.js");

      getBNBBalance.mockResolvedValue("50.0");

      const holders = Array.from({ length: 10 }, (_, i) => ({
        rank: i + 1,
        address: `0xHolder${i}`,
        balance: "1000",
        percentage: 10,
      }));

      getTopHoldersMoralis.mockResolvedValue(holders);

      const timestamps = [];
      createDlnOrderBNBtoPAXG.mockImplementation(() => {
        timestamps.push(Date.now());
        return Promise.resolve({
          hash: "0xHash",
          status: 1,
          orderId: "order-123",
        });
      });

      const { runDistributionCycle } = await import("../orchestrator.js");
      await runDistributionCycle();

      expect(timestamps.length).toBe(10);

      const batch1 = timestamps.slice(0, 3);
      const batch2 = timestamps.slice(3, 6);

      const batch1Range = Math.max(...batch1) - Math.min(...batch1);
      expect(batch1Range).toBeLessThan(100);

      const gapBetweenBatches = Math.min(...batch2) - Math.max(...batch1);
      expect(gapBetweenBatches).toBeGreaterThan(1000);
    });

    it("should reserve 5% of BNB balance", async () => {
      const { getBNBBalance, createDlnOrderBNBtoPAXG } = await import(
        "../bridge.js"
      );
      const { getTopHoldersMoralis } = await import("../holders.js");

      getBNBBalance.mockResolvedValue("100.0");

      getTopHoldersMoralis.mockResolvedValue([
        {
          rank: 1,
          address: "0xHolder1",
          balance: "10000",
          percentage: 100,
        },
      ]);

      let capturedAmount = 0n;
      createDlnOrderBNBtoPAXG.mockImplementation((amountWei) => {
        capturedAmount = amountWei;
        return Promise.resolve({
          hash: "0xHash",
          status: 1,
          orderId: "order-123",
        });
      });

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      const usedBNB = parseFloat(result.totalBNBUsed);
      expect(usedBNB).toBeCloseTo(95, 0);
    });
  });
});
