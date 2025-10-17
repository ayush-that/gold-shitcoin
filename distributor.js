import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY;
const ETH_RPC_URL = process.env.ETH_RPC_URL;
const PAXG_CONTRACT_ADDRESS = process.env.PAXG_CONTRACT_ADDRESS;

const ethProvider = new ethers.JsonRpcProvider(ETH_RPC_URL);

const PAXG_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export async function distributePAXG(holders, totalPAXG) {
  const wallet = new ethers.Wallet(ETH_PRIVATE_KEY, ethProvider);
  const paxgContract = new ethers.Contract(
    PAXG_CONTRACT_ADDRESS,
    PAXG_ABI,
    wallet,
  );

  const decimals = await paxgContract.decimals();
  const totalPAXGWei = ethers.parseUnits(totalPAXG.toString(), decimals);

  const distributionResults = [];
  const minDistribution = ethers.parseUnits("0.001", decimals);

  for (const holder of holders) {
    if (!holder.percentage) {
      continue;
    }

    const holderShare = (holder.percentage / 100) * totalPAXG;
    const holderShareWei = ethers.parseUnits(holderShare.toString(), decimals);

    if (holderShareWei < minDistribution) {
      continue;
    }

    try {
      const tx = await paxgContract.transfer(holder.address, holderShareWei);
      await tx.wait();

      const result = {
        address: holder.address,
        share: holderShare,
        shareWei: holderShareWei.toString(),
        txHash: tx.hash,
        rank: holder.rank,
        percentage: holder.percentage,
      };

      distributionResults.push(result);
    } catch (error) {
      distributionResults.push({
        address: holder.address,
        share: holderShare,
        shareWei: holderShareWei.toString(),
        txHash: null,
        rank: holder.rank,
        percentage: holder.percentage,
        error: error.message,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return distributionResults;
}

export async function saveDistributionHistory(results, totalPAXG) {
  const fs = await import("fs");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `distribution-${timestamp}.json`;

  const data = {
    timestamp: new Date().toISOString(),
    totalPAXG: totalPAXG,
    totalRecipients: results.length,
    successfulDistributions: results.filter((r) => r.txHash).length,
    failedDistributions: results.filter((r) => !r.txHash).length,
    results: results,
  };

  fs.writeFileSync(filename, JSON.stringify(data, null, 2));

  return filename;
}

export async function getDistributionSummary(results) {
  const successful = results.filter((r) => r.txHash);
  const failed = results.filter((r) => !r.txHash);
  const totalDistributed = successful.reduce((sum, r) => sum + r.share, 0);

  return {
    totalRecipients: results.length,
    successful: successful.length,
    failed: failed.length,
    totalDistributed: totalDistributed,
    successRate: (successful.length / results.length) * 100,
  };
}
