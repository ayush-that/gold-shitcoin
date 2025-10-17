import axios from "axios";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const BSC_RPC = "https://bsc-dataseed.binance.org";
const SRC_CHAIN_ID = "56";
const DST_CHAIN_ID = "1";
const BNB_NATIVE = "0x0000000000000000000000000000000000000000";
const PAXG_ETH = "0x45804880De22913dAFE09f4980848ECE6EcbAf78";
const BNB_PRIVATE_KEY = process.env.BNB_PRIVATE_KEY;

const provider = new ethers.JsonRpcProvider(BSC_RPC);
const wallet = new ethers.Wallet(BNB_PRIVATE_KEY, provider);

const tryHosts = [
  "https://dln.debridge.finance/v1.0/dln/order/create-tx",
  "https://api.dln.trade/v1.0/dln/order/create-tx",
];

export async function getBNBBalance() {
  console.log(`[BRIDGE] Getting BNB balance for ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  const formatted = ethers.formatEther(balance);
  console.log(`[BRIDGE] Balance: ${formatted} BNB`);
  return formatted;
}

export async function createDlnOrderBNBtoPAXG(amountWei, recipientEth) {
  console.log(
    `[BRIDGE] Creating DLN order: ${ethers.formatEther(amountWei)} BNB -> PAXG for ${recipientEth}`,
  );

  const params = {
    srcChainId: SRC_CHAIN_ID,
    srcChainTokenIn: BNB_NATIVE,
    srcChainTokenInAmount: amountWei.toString(),
    dstChainId: DST_CHAIN_ID,
    dstChainTokenOut: PAXG_ETH,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: recipientEth,
    senderAddress: wallet.address,
    srcChainOrderAuthorityAddress: wallet.address,
    dstChainOrderAuthorityAddress: recipientEth,
    srcChainPriorityLevel: "normal",
  };

  console.log(`[BRIDGE] DLN params:`, JSON.stringify(params, null, 2));

  let orderData;
  let lastError = null;

  for (const host of tryHosts) {
    console.log(`[BRIDGE] Trying host: ${host}`);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[BRIDGE] Attempt ${attempt + 1}/3`);
        const resp = await axios.get(host, {
          params,
          headers: { Accept: "application/json" },
        });
        orderData = resp.data;
        console.log(`[BRIDGE] DLN API success, orderId: ${orderData.orderId}`);
        break;
      } catch (e) {
        lastError = e;
        const status = e && e.response && e.response.status;
        console.log(
          `[BRIDGE] DLN API error: status ${status}, message: ${e.message}`,
        );
        if (e.response?.data) {
          console.log(
            `[BRIDGE] DLN error details:`,
            JSON.stringify(e.response.data, null, 2),
          );
        }
        if (status && status >= 500) {
          console.log(
            `[BRIDGE] 5xx error, retrying after ${1000 * (attempt + 1)}ms`,
          );
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (status && status >= 400 && status < 500) {
          throw new Error(
            `DLN API 4xx: ${JSON.stringify(e.response?.data || e.message)}`,
          );
        }
        break;
      }
    }
    if (orderData) break;
  }

  if (!orderData) {
    const errorMsg = `DLN failed: ${lastError?.response?.data ? JSON.stringify(lastError.response.data) : lastError?.message || "Unknown"}`;
    console.log(`[BRIDGE] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const tx = {
    to: orderData.tx.to,
    data: orderData.tx.data,
    value: orderData.tx.value ? ethers.toBigInt(orderData.tx.value) : 0n,
  };

  console.log(
    `[BRIDGE] Sending transaction: to=${tx.to}, value=${ethers.formatEther(tx.value)} BNB`,
  );

  const sent = await wallet.sendTransaction(tx);
  console.log(`[BRIDGE] Transaction sent: ${sent.hash}`);
  console.log(`[BRIDGE] Waiting for confirmation...`);

  const receipt = await sent.wait();
  console.log(`[BRIDGE] Transaction confirmed: status=${receipt.status}`);

  return {
    hash: sent.hash,
    status: receipt.status,
    orderId: orderData.orderId,
  };
}
