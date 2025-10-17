import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(),
  },
}));

vi.mock("../orchestrator.js", () => ({
  runDistributionCycle: vi.fn(),
}));

describe("Integration Tests", () => {
  let app;
  let server;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.PORT = "0";
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe("Server Endpoints", () => {
    it("GET /health should return ok status", async () => {
      const serverModule = await import("../server.js");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await request("http://localhost:3000")
        .get("/health")
        .expect(200);

      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
    });

    it("GET /status should return current status", async () => {
      const serverModule = await import("../server.js");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await request("http://localhost:3000")
        .get("/status")
        .expect(200);

      expect(response.body).toHaveProperty("isRunning");
      expect(response.body).toHaveProperty("lastRun");
      expect(response.body).toHaveProperty("nextRun");
    });

    it("POST /run should trigger distribution cycle", async () => {
      const { runDistributionCycle } = await import("../orchestrator.js");
      runDistributionCycle.mockResolvedValue({
        status: "completed",
        timestamp: new Date().toISOString(),
        succeeded: 5,
        failed: 0,
      });

      const serverModule = await import("../server.js");
      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await request("http://localhost:3000")
        .post("/run")
        .expect(200);

      expect(response.body.message).toBe("Distribution cycle started");

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(runDistributionCycle).toHaveBeenCalled();
    });

    it("POST /run should reject concurrent requests", async () => {
      const { runDistributionCycle } = await import("../orchestrator.js");
      runDistributionCycle.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 2000)),
      );

      const serverModule = await import("../server.js");
      await new Promise((resolve) => setTimeout(resolve, 100));

      await request("http://localhost:3000").post("/run").expect(200);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const response = await request("http://localhost:3000")
        .post("/run")
        .expect(409);

      expect(response.body.error).toContain("already running");
    });
  });

  describe("End-to-End Flow Simulation", () => {
    it("should complete full distribution cycle", async () => {
      vi.resetModules();

      const mockBridge = {
        getBNBBalance: vi.fn().mockResolvedValue("10.0"),
        createDlnOrderBNBtoPAXG: vi.fn().mockResolvedValue({
          hash: "0xHash",
          status: 1,
          orderId: "order-123",
        }),
      };

      const mockHolders = {
        getTopHoldersMoralis: vi.fn().mockResolvedValue([
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
        ]),
      };

      vi.doMock("../bridge.js", () => mockBridge);
      vi.doMock("../holders.js", () => mockHolders);

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      expect(result.status).toBe("completed");
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockBridge.getBNBBalance).toHaveBeenCalled();
      expect(mockHolders.getTopHoldersMoralis).toHaveBeenCalled();
      expect(mockBridge.createDlnOrderBNBtoPAXG).toHaveBeenCalledTimes(2);
    });

    it("should handle low balance scenario", async () => {
      vi.resetModules();

      const mockBridge = {
        getBNBBalance: vi.fn().mockResolvedValue("0.5"),
        createDlnOrderBNBtoPAXG: vi.fn(),
      };

      vi.doMock("../bridge.js", () => mockBridge);

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      expect(result.status).toBe("skipped_low_balance");
      expect(mockBridge.createDlnOrderBNBtoPAXG).not.toHaveBeenCalled();
    });

    it("should handle DLN API failures gracefully", async () => {
      vi.resetModules();

      const mockBridge = {
        getBNBBalance: vi.fn().mockResolvedValue("10.0"),
        createDlnOrderBNBtoPAXG: vi
          .fn()
          .mockRejectedValue(new Error("DLN API Error")),
      };

      const mockHolders = {
        getTopHoldersMoralis: vi.fn().mockResolvedValue([
          {
            rank: 1,
            address: "0xHolder1",
            balance: "10000",
            percentage: 100,
          },
        ]),
      };

      vi.doMock("../bridge.js", () => mockBridge);
      vi.doMock("../holders.js", () => mockHolders);

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      expect(result.status).toBe("completed");
      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBe("DLN API Error");
    });

    it("should calculate 95% distribution correctly", async () => {
      vi.resetModules();

      let capturedAmounts = [];
      const mockBridge = {
        getBNBBalance: vi.fn().mockResolvedValue("100.0"),
        createDlnOrderBNBtoPAXG: vi.fn().mockImplementation((amount) => {
          capturedAmounts.push(amount);
          return Promise.resolve({
            hash: "0xHash",
            status: 1,
            orderId: "order-123",
          });
        }),
      };

      const mockHolders = {
        getTopHoldersMoralis: vi.fn().mockResolvedValue([
          {
            rank: 1,
            address: "0xHolder1",
            balance: "10000",
            percentage: 100,
          },
        ]),
      };

      vi.doMock("../bridge.js", () => mockBridge);
      vi.doMock("../holders.js", () => mockHolders);

      const { runDistributionCycle } = await import("../orchestrator.js");
      const result = await runDistributionCycle();

      const totalUsed = parseFloat(result.totalBNBUsed);
      expect(totalUsed).toBeCloseTo(95, 0);
    });
  });

  describe("Error Handling", () => {
    it("should handle Moralis API errors", async () => {
      vi.resetModules();

      const mockBridge = {
        getBNBBalance: vi.fn().mockResolvedValue("10.0"),
      };

      const mockHolders = {
        getTopHoldersMoralis: vi
          .fn()
          .mockRejectedValue(new Error("Moralis API Error")),
      };

      vi.doMock("../bridge.js", () => mockBridge);
      vi.doMock("../holders.js", () => mockHolders);

      const { runDistributionCycle } = await import("../orchestrator.js");

      await expect(runDistributionCycle()).rejects.toThrow("Moralis API Error");
    });

    it("should handle balance check errors", async () => {
      vi.resetModules();

      const mockBridge = {
        getBNBBalance: vi.fn().mockRejectedValue(new Error("RPC Error")),
      };

      vi.doMock("../bridge.js", () => mockBridge);

      const { runDistributionCycle } = await import("../orchestrator.js");

      await expect(runDistributionCycle()).rejects.toThrow("RPC Error");
    });
  });
});
