import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

vi.mock("axios");

describe("Holders Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MORALIS_API_KEY = "test-api-key";
    process.env.BSC_TOKEN_ADDRESS = "0xTokenAddress";
  });

  describe("getTopHoldersMoralis", () => {
    it("should fetch and return top 100 holders", async () => {
      const axios = await import("axios");
      const mockHolders = Array.from({ length: 100 }, (_, i) => ({
        owner_address: `0xHolder${i}`,
        balance: `${(100 - i) * 1e18}`,
        balance_formatted: `${100 - i}`,
        percentage_relative_to_total_supply: (100 - i) / 5050,
        is_contract: false,
      }));

      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: mockHolders,
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders).toHaveLength(100);
      expect(holders[0].rank).toBe(1);
      expect(holders[0].address).toBe("0xHolder0");
      expect(parseFloat(holders[0].balance)).toBeGreaterThan(
        parseFloat(holders[1].balance),
      );
    });

    it("should handle pagination correctly", async () => {
      const axios = await import("axios");

      const page1 = Array.from({ length: 100 }, (_, i) => ({
        owner_address: `0xHolder${i}`,
        balance: `${(200 - i) * 1e18}`,
        balance_formatted: `${200 - i}`,
        percentage_relative_to_total_supply: (200 - i) / 20100,
      }));

      const page2 = Array.from({ length: 100 }, (_, i) => ({
        owner_address: `0xHolder${i + 100}`,
        balance: `${(100 - i) * 1e18}`,
        balance_formatted: `${100 - i}`,
        percentage_relative_to_total_supply: (100 - i) / 20100,
      }));

      let callCount = 0;
      axios.default.get = vi.fn().mockImplementation((url) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              result: page1,
              cursor: "next-page-cursor",
            },
          });
        }
        return Promise.resolve({
          data: {
            result: page2,
            cursor: null,
          },
        });
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders).toHaveLength(100);
      expect(callCount).toBe(2);
      expect(axios.default.get).toHaveBeenCalledWith(
        expect.stringContaining("cursor=next-page-cursor"),
        expect.any(Object),
      );
    });

    it("should sort holders by balance descending", async () => {
      const axios = await import("axios");
      const unsortedHolders = [
        {
          owner_address: "0xHolder1",
          balance: "5000000000000000000",
          balance_formatted: "5",
        },
        {
          owner_address: "0xHolder2",
          balance: "10000000000000000000",
          balance_formatted: "10",
        },
        {
          owner_address: "0xHolder3",
          balance: "7000000000000000000",
          balance_formatted: "7",
        },
      ];

      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: unsortedHolders,
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders[0].address).toBe("0xHolder2");
      expect(holders[1].address).toBe("0xHolder3");
      expect(holders[2].address).toBe("0xHolder1");
      expect(parseFloat(holders[0].balance)).toBe(10);
    });

    it("should handle empty results", async () => {
      const axios = await import("axios");
      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: [],
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders).toHaveLength(0);
    });

    it("should include holder metadata", async () => {
      const axios = await import("axios");
      const mockHolders = [
        {
          owner_address: "0xHolder1",
          balance: "10000000000000000000",
          balance_formatted: "10",
          owner_address_label: "Binance Hot Wallet",
          entity: "Binance",
          entity_logo: "https://example.com/binance.png",
          percentage_relative_to_total_supply: 0.1,
          usd_value: "1000",
          is_contract: false,
        },
      ];

      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: mockHolders,
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders[0].label).toBe("Binance Hot Wallet");
      expect(holders[0].entity).toBe("Binance");
      expect(holders[0].entityLogo).toBe("https://example.com/binance.png");
      expect(holders[0].percentage).toBe(0.1);
      expect(holders[0].usdValue).toBe("1000");
      expect(holders[0].isContract).toBe(false);
    });

    it("should use correct API endpoint and headers", async () => {
      const axios = await import("axios");
      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: [],
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      await getTopHoldersMoralis();

      expect(axios.default.get).toHaveBeenCalledWith(
        expect.stringContaining("0xTokenAddress"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "test-api-key",
          }),
        }),
      );
    });

    it("should limit to top 100 when more holders exist", async () => {
      const axios = await import("axios");
      const mockHolders = Array.from({ length: 150 }, (_, i) => ({
        owner_address: `0xHolder${i}`,
        balance: `${(150 - i) * 1e18}`,
        balance_formatted: `${150 - i}`,
        is_contract: false,
      }));

      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: mockHolders,
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders).toHaveLength(100);
      expect(parseFloat(holders[0].balance)).toBe(150);
      expect(parseFloat(holders[99].balance)).toBe(51);
    });

    it("should skip contract addresses and return next 100", async () => {
      const axios = await import("axios");
      const mockHolders = [
        {
          owner_address: "0xLPContract",
          balance: "1000000000000000000000",
          balance_formatted: "1000",
          is_contract: true,
        },
        ...Array.from({ length: 105 }, (_, i) => ({
          owner_address: `0xHolder${i}`,
          balance: `${(105 - i) * 1e18}`,
          balance_formatted: `${105 - i}`,
          is_contract: false,
        })),
      ];

      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: mockHolders,
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders).toHaveLength(100);
      expect(holders[0].address).toBe("0xHolder0");
      expect(holders.every((h) => h.address !== "0xLPContract")).toBe(true);
    });

    it("should skip holders with LP/Pancake/Router labels", async () => {
      const axios = await import("axios");
      const mockHolders = [
        {
          owner_address: "0xLPHolder",
          balance: "200000000000000000000",
          balance_formatted: "200",
          owner_address_label: "PancakeSwap LP",
          is_contract: false,
        },
        {
          owner_address: "0xRouterHolder",
          balance: "150000000000000000000",
          balance_formatted: "150",
          owner_address_label: "Router",
          is_contract: false,
        },
        ...Array.from({ length: 102 }, (_, i) => ({
          owner_address: `0xRealHolder${i}`,
          balance: `${(102 - i) * 1e18}`,
          balance_formatted: `${102 - i}`,
          is_contract: false,
        })),
      ];

      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: mockHolders,
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders).toHaveLength(100);
      expect(holders.every((h) => h.address !== "0xLPHolder")).toBe(true);
      expect(holders.every((h) => h.address !== "0xRouterHolder")).toBe(true);
      expect(holders[0].address).toBe("0xRealHolder0");
    });

    it("should skip token contract itself", async () => {
      process.env.BSC_TOKEN_ADDRESS = "0xTokenContract";
      const axios = await import("axios");
      const mockHolders = [
        {
          owner_address: "0xTokenContract",
          balance: "500000000000000000000",
          balance_formatted: "500",
          is_contract: true,
        },
        ...Array.from({ length: 102 }, (_, i) => ({
          owner_address: `0xHolder${i}`,
          balance: `${(102 - i) * 1e18}`,
          balance_formatted: `${102 - i}`,
          is_contract: false,
        })),
      ];

      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: mockHolders,
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders).toHaveLength(100);
      expect(
        holders.every((h) => h.address.toLowerCase() !== "0xtokencontract"),
      ).toBe(true);
    });

    it("should respect SKIP_ADDRESSES env variable", async () => {
      const originalSkip = process.env.SKIP_ADDRESSES;
      process.env.SKIP_ADDRESSES = "0xBadActor1,0xBadActor2";

      vi.resetModules();

      const axios = await import("axios");
      const mockHolders = [
        {
          owner_address: "0xBadActor1",
          balance: "300000000000000000000",
          balance_formatted: "300",
          is_contract: false,
        },
        {
          owner_address: "0xBadActor2",
          balance: "200000000000000000000",
          balance_formatted: "200",
          is_contract: false,
        },
        ...Array.from({ length: 102 }, (_, i) => ({
          owner_address: `0xHolder${i}`,
          balance: `${(102 - i) * 1e18}`,
          balance_formatted: `${102 - i}`,
          is_contract: false,
        })),
      ];

      axios.default.get = vi.fn().mockResolvedValue({
        data: {
          result: mockHolders,
          cursor: null,
        },
      });

      const { getTopHoldersMoralis } = await import("../holders.js");
      const holders = await getTopHoldersMoralis();

      expect(holders).toHaveLength(100);
      expect(
        holders.every(
          (h) =>
            h.address.toLowerCase() !== "0xbadactor1" &&
            h.address.toLowerCase() !== "0xbadactor2",
        ),
      ).toBe(true);

      process.env.SKIP_ADDRESSES = originalSkip;
    });
  });
});
