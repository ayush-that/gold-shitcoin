import { ethers } from "ethers";
import { getBNBBalance, createDlnOrderBNBtoPAXG } from "./bridge.js";
import { getTopHoldersMoralis } from "./holders.js";

// Test mode
// const MIN_TOTAL_BNB = "1.0";
// const MIN_PER_ORDER_BNB = "0.003";
// const CONCURRENCY = 3;
// const BATCH_DELAY_MS = 2000;

const MIN_TOTAL_BNB = "1.0";
const MIN_PER_ORDER_BNB = "0.006";
const CONCURRENCY = 3;
const BATCH_DELAY_MS = 2000;

export async function runDistributionCycle() {
  console.log("[ORCHESTRATOR] Starting distribution cycle");

  const bnbBalanceStr = await getBNBBalance();
  const bnbBalance = parseFloat(bnbBalanceStr);
  console.log(`[ORCHESTRATOR] BNB balance: ${bnbBalanceStr}`);
  console.log(`[ORCHESTRATOR] MIN_TOTAL_BNB: ${MIN_TOTAL_BNB}`);

  if (bnbBalance < parseFloat(MIN_TOTAL_BNB)) {
    console.log("[ORCHESTRATOR] Balance below minimum, skipping cycle");
    return {
      status: "skipped_low_balance",
      bnbBalance: bnbBalanceStr,
      timestamp: new Date().toISOString(),
    };
  }

  const amountToBridgeBN = ethers.parseEther((bnbBalance * 0.95).toFixed(18));
  console.log(
    `[ORCHESTRATOR] Amount to bridge (95%): ${ethers.formatEther(amountToBridgeBN)} BNB`
  );

  console.log("[ORCHESTRATOR] Fetching top holders");
  let holders = await getTopHoldersMoralis();
  console.log(`[ORCHESTRATOR] Fetched ${holders.length} holders`);
  // holders = holders.slice(0, 1); // enable to force single-order test

  const sumTop = holders.reduce(
    (acc, h) => acc + parseFloat(h.balance || 0),
    0
  );
  console.log(`[ORCHESTRATOR] Total balance among top holders: ${sumTop}`);

  const allocations = [];
  let unassignedRemainder = 0n;
  const minPerOrderWei = ethers.parseEther(MIN_PER_ORDER_BNB);
  console.log(`[ORCHESTRATOR] Min per order: ${MIN_PER_ORDER_BNB} BNB`);

  for (const holder of holders) {
    const holderBalanceFloat = parseFloat(holder.balance || 0);
    if (holderBalanceFloat === 0 || sumTop === 0) continue;

    const shareFraction = holderBalanceFloat / sumTop;
    const holderShareBN =
      (amountToBridgeBN * BigInt(Math.floor(shareFraction * 1e9))) /
      BigInt(1e9);

    if (holderShareBN < minPerOrderWei) {
      console.log(
        `[ORCHESTRATOR] Skipping holder ${holder.address}: share ${ethers.formatEther(holderShareBN)} BNB below minimum`
      );
      unassignedRemainder += holderShareBN;
      continue;
    }

    console.log(
      `[ORCHESTRATOR] Allocating ${ethers.formatEther(holderShareBN)} BNB to ${holder.address}`
    );
    allocations.push({
      address: holder.address,
      amountWei: holderShareBN,
      rank: holder.rank,
      percentage: holder.percentage,
    });
  }

  console.log(`[ORCHESTRATOR] Total allocations: ${allocations.length}`);

  const results = [];
  console.log(
    `[ORCHESTRATOR] Processing ${allocations.length} allocations with concurrency ${CONCURRENCY}`
  );

  for (let i = 0; i < allocations.length; i += CONCURRENCY) {
    const batch = allocations.slice(i, i + CONCURRENCY);
    console.log(
      `[ORCHESTRATOR] Processing batch ${Math.floor(i / CONCURRENCY) + 1} with ${batch.length} orders`
    );

    const promises = batch.map((alloc) => {
      console.log(
        `[ORCHESTRATOR] Creating DLN order for ${alloc.address}: ${ethers.formatEther(alloc.amountWei)} BNB`
      );
      return createDlnOrderBNBtoPAXG(alloc.amountWei, alloc.address)
        .then((res) => {
          console.log(
            `[ORCHESTRATOR] SUCCESS for ${alloc.address}: tx ${res.hash}`
          );
          return {
            ...alloc,
            success: true,
            hash: res.hash,
            orderId: res.orderId,
          };
        })
        .catch((err) => {
          console.log(
            `[ORCHESTRATOR] FAILED for ${alloc.address}: ${err.message}`
          );
          return {
            ...alloc,
            success: false,
            error: err.message,
          };
        });
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    if (i + CONCURRENCY < allocations.length) {
      console.log(
        `[ORCHESTRATOR] Waiting ${BATCH_DELAY_MS}ms before next batch`
      );
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const totalBNBUsed = results
    .filter((r) => r.success)
    .reduce((acc, r) => acc + r.amountWei, 0n);

  console.log(
    `[ORCHESTRATOR] Cycle complete: ${succeeded} succeeded, ${failed} failed`
  );
  console.log(
    `[ORCHESTRATOR] Total BNB used: ${ethers.formatEther(totalBNBUsed)}`
  );

  return {
    status: "completed",
    timestamp: new Date().toISOString(),
    bnbBalance: bnbBalanceStr,
    attempted: results.length,
    succeeded,
    failed,
    skippedLowMin: holders.length - allocations.length,
    totalBNBUsed: ethers.formatEther(totalBNBUsed),
    unassignedRemainderBNB: ethers.formatEther(unassignedRemainder),
    results,
  };
}
