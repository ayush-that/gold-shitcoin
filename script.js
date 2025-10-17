import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const BSC_TOKEN_ADDRESS = process.env.BSC_TOKEN_ADDRESS;

async function getTopHoldersMoralis() {
  let allHolders = [];
  let cursor = null;
  let page = 1;
  const limit = 100;

  while (true) {
    let url = `https://deep-index.moralis.io/api/v2.2/erc20/${BSC_TOKEN_ADDRESS}/owners?chain=0x38&limit=${limit}&order=DESC`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    const response = await axios.get(url, {
      headers: {
        "X-API-Key": MORALIS_API_KEY,
        "User-Agent": "BSC-Token-Holders/1.0",
      },
      timeout: 60000,
    });

    const data = response.data;

    if (!data.result || data.result.length === 0) {
      break;
    }

    allHolders = allHolders.concat(data.result);

    if (data.cursor) {
      cursor = data.cursor;
      page++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } else {
      break;
    }
  }

  const topHolders = allHolders
    .sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance))
    .slice(0, 100)
    .map((holder, index) => {
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

  return topHolders;
}

function displayHolders(holders) {
  return holders;
}

async function saveToFile(holders) {
  const fs = await import("fs");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `top-100-holders-${timestamp}.json`;

  const data = {
    timestamp: new Date().toISOString(),
    tokenAddress: BSC_TOKEN_ADDRESS,
    totalHolders: holders.length,
    holders: holders,
  };

  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  return filename;
}

async function main() {
  const holders = await getTopHoldersMoralis();

  if (holders.length === 0) {
    return;
  }

  displayHolders(holders);
  await saveToFile(holders);
}

main();
