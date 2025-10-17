import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const BSC_TOKEN_ADDRESS = process.env.BSC_TOKEN_ADDRESS;
const SKIP_ADDRESSES = (process.env.SKIP_ADDRESSES || "")
  .split(",")
  .filter(Boolean)
  .map((a) => a.toLowerCase().trim());

function shouldSkipHolder(holder, tokenAddress) {
  const address = (holder.owner_address || holder.address || "").toLowerCase();
  const label = (holder.owner_address_label || "").toLowerCase();

  if (holder.is_contract) return true;
  if (address === tokenAddress.toLowerCase()) return true;
  if (SKIP_ADDRESSES.includes(address)) return true;

  const skipPatterns = ["pancake", "router", "lp", "liquidity", "burn", "dead"];
  if (skipPatterns.some((p) => label.includes(p) || address.includes(p)))
    return true;

  return false;
}

export async function getTopHoldersMoralis() {
  console.log(`[HOLDERS] Fetching holders for token ${BSC_TOKEN_ADDRESS}`);
  let allHolders = [];
  let cursor = null;
  let page = 1;
  const limit = 100;

  while (allHolders.length < 150) {
    let url = `https://deep-index.moralis.io/api/v2.2/erc20/${BSC_TOKEN_ADDRESS}/owners?chain=0x38&limit=${limit}&order=DESC`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    console.log(
      `[HOLDERS] Fetching page ${page}, current total: ${allHolders.length}`,
    );

    const response = await axios.get(url, {
      headers: {
        "X-API-Key": MORALIS_API_KEY,
        "User-Agent": "BSC-Token-Holders/1.0",
      },
      timeout: 60000,
    });

    const data = response.data;

    if (!data.result || data.result.length === 0) {
      console.log(`[HOLDERS] No more results, stopping at page ${page}`);
      break;
    }

    console.log(`[HOLDERS] Page ${page} fetched ${data.result.length} holders`);
    allHolders = allHolders.concat(data.result);

    if (data.cursor) {
      cursor = data.cursor;
      page++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      console.log(`[HOLDERS] No more pages`);
      break;
    }
  }

  console.log(`[HOLDERS] Total holders fetched: ${allHolders.length}`);

  const sortedHolders = allHolders.sort(
    (a, b) => parseFloat(b.balance) - parseFloat(a.balance),
  );
  console.log(`[HOLDERS] Sorted ${sortedHolders.length} holders by balance`);

  const filteredHolders = sortedHolders.filter(
    (h) => !shouldSkipHolder(h, BSC_TOKEN_ADDRESS),
  );
  console.log(
    `[HOLDERS] After filtering: ${filteredHolders.length} holders (removed ${sortedHolders.length - filteredHolders.length} contracts/LP)`,
  );

  const topHolders = filteredHolders.slice(0, 100).map((holder, index) => {
    const balanceInTokens =
      holder.balance_formatted ||
      (parseFloat(holder.balance) / Math.pow(10, 18)).toFixed(6);
    return {
      rank: index + 1,
      address: holder.owner_address || holder.address,
      balance: balanceInTokens,
      label: holder.owner_address_label || null,
      entity: holder.entity || null,
      entityLogo: holder.entity_logo || null,
      percentage: holder.percentage_relative_to_total_supply || null,
      usdValue: holder.usd_value || null,
      isContract: holder.is_contract || false,
    };
  });

  console.log(`[HOLDERS] Returning top ${topHolders.length} holders`);
  return topHolders;
}
