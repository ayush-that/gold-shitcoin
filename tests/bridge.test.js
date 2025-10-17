import { describe, it, expect, vi, beforeEach } from "vitest";
import { ethers } from "ethers";

vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

const mockProvider = {
  getBalance: vi.fn(),
};

const mockWallet = {
  address: "0x1234567890123456789012345678901234567890",
  sendTransaction: vi.fn(),
};

const mockReceipt = {
  status: 1,
};

vi.mock("ethers", async () => {
  const actual = await vi.importActual("ethers");
  return {
    ...actual,
    JsonRpcProvider: vi.fn(() => mockProvider),
    Wallet: vi.fn(() => mockWallet),
  };
});

vi.mock("axios");

describe("Bridge Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BNB_PRIVATE_KEY = "0xprivatekey";
  });

  describe("getBNBBalance", () => {
    it("should return formatted BNB balance", async () => {
      mockProvider.getBalance.mockResolvedValue(ethers.parseEther("10.5"));

      const { getBNBBalance } = await import("../bridge.js");
      const balance = await getBNBBalance();

      expect(balance).toBe("10.5");
      expect(mockProvider.getBalance).toHaveBeenCalledWith(mockWallet.address);
    });

    it("should handle zero balance", async () => {
      mockProvider.getBalance.mockResolvedValue(0n);

      const { getBNBBalance } = await import("../bridge.js");
      const balance = await getBNBBalance();

      expect(balance).toBe("0.0");
    });
  });

  describe("createDlnOrderBNBtoPAXG", () => {
    it("should create order and return transaction details", async () => {
      const axios = await import("axios");
      const mockOrderData = {
        tx: {
          to: "0xContractAddress",
          data: "0xTransactionData",
          value: "1000000000000000000",
        },
        orderId: "order-123",
      };

      axios.default.get = vi.fn().mockResolvedValue({
        data: mockOrderData,
      });

      mockWallet.sendTransaction.mockResolvedValue({
        hash: "0xTransactionHash",
        wait: vi.fn().mockResolvedValue(mockReceipt),
      });

      const { createDlnOrderBNBtoPAXG } = await import("../bridge.js");
      const amountWei = ethers.parseEther("0.1");
      const recipient = "0xRecipient";

      const result = await createDlnOrderBNBtoPAXG(amountWei, recipient);

      expect(result).toEqual({
        hash: "0xTransactionHash",
        status: 1,
        orderId: "order-123",
      });

      expect(axios.default.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            srcChainId: "56",
            dstChainId: "1",
            srcChainTokenInAmount: amountWei.toString(),
            dstChainTokenOutRecipient: recipient,
          }),
        }),
      );
    });

    it("should retry on 5xx errors", async () => {
      const axios = await import("axios");
      const mockOrderData = {
        tx: {
          to: "0xContractAddress",
          data: "0xTransactionData",
          value: "1000000000000000000",
        },
        orderId: "order-123",
      };

      let callCount = 0;
      axios.default.get = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          const error = new Error("Server Error");
          error.response = { status: 500 };
          throw error;
        }
        return { data: mockOrderData };
      });

      mockWallet.sendTransaction.mockResolvedValue({
        hash: "0xTransactionHash",
        wait: vi.fn().mockResolvedValue(mockReceipt),
      });

      const { createDlnOrderBNBtoPAXG } = await import("../bridge.js");
      const result = await createDlnOrderBNBtoPAXG(
        ethers.parseEther("0.1"),
        "0xRecipient",
      );

      expect(result.orderId).toBe("order-123");
      expect(callCount).toBe(3);
    });

    it("should throw on 4xx errors immediately", async () => {
      const axios = await import("axios");
      const error = new Error("Bad Request");
      error.response = {
        status: 400,
        data: { errorMessage: "Invalid amount" },
      };

      axios.default.get = vi.fn().mockRejectedValue(error);

      const { createDlnOrderBNBtoPAXG } = await import("../bridge.js");

      await expect(
        createDlnOrderBNBtoPAXG(ethers.parseEther("0.001"), "0xRecipient"),
      ).rejects.toThrow("DLN API 4xx");
    });

    it("should use fallback host after primary fails", async () => {
      const axios = await import("axios");
      const mockOrderData = {
        tx: {
          to: "0xContractAddress",
          data: "0xTransactionData",
          value: "1000000000000000000",
        },
        orderId: "order-123",
      };

      let callCount = 0;
      axios.default.get = vi.fn().mockImplementation((url) => {
        callCount++;
        if (url.includes("dln.debridge.finance")) {
          const error = new Error("Timeout");
          error.response = { status: 500 };
          throw error;
        }
        return { data: mockOrderData };
      });

      mockWallet.sendTransaction.mockResolvedValue({
        hash: "0xTransactionHash",
        wait: vi.fn().mockResolvedValue(mockReceipt),
      });

      const { createDlnOrderBNBtoPAXG } = await import("../bridge.js");
      const result = await createDlnOrderBNBtoPAXG(
        ethers.parseEther("0.1"),
        "0xRecipient",
      );

      expect(result.orderId).toBe("order-123");
    });
  });
});
