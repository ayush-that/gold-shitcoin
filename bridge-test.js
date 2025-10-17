import axios from "axios";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const bnbPrivateKey = process.env.BNB_PRIVATE_KEY;
  const amountBnb = process.argv[2];
  const ethRecipient = process.argv[3];

  if (!bnbPrivateKey) {
    throw new Error("Missing BNB_PRIVATE_KEY in .env");
  }
  if (!amountBnb || !ethRecipient) {
    throw new Error(
      "Usage: node bridge-test.js <amountBNB> <ethRecipient> [slippage]"
    );
  }

  const BSC_RPC = "https://bsc-dataseed.binance.org";
  const SRC_CHAIN_ID = "56";
  const DST_CHAIN_ID = "1";
  const BNB_NATIVE = "0x0000000000000000000000000000000000000000";
  const PAXG_ETH = "0x45804880De22913dAFE09f4980848ECE6EcbAf78";
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const wallet = new ethers.Wallet(bnbPrivateKey, provider);

  const params = {
    srcChainId: SRC_CHAIN_ID,
    srcChainTokenIn: BNB_NATIVE,
    srcChainTokenInAmount: ethers.parseEther(amountBnb).toString(),
    dstChainId: DST_CHAIN_ID,
    dstChainTokenOut: PAXG_ETH,
    dstChainTokenOutAmount: "auto",
    dstChainTokenOutRecipient: ethRecipient,
    senderAddress: wallet.address,
    srcChainOrderAuthorityAddress: wallet.address,
    dstChainOrderAuthorityAddress: ethRecipient,
    srcChainPriorityLevel: "normal",
  };

  let orderData;
  const tryHosts = [
    "https://dln.debridge.finance/v1.0/dln/order/create-tx",
    "https://api.dln.trade/v1.0/dln/order/create-tx",
  ];
  let lastError = null;
  for (const host of tryHosts) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await axios.get(host, {
          params,
          headers: { Accept: "application/json" },
        });
        orderData = resp.data;
        break;
      } catch (e) {
        lastError = e;
        const status = e && e.response && e.response.status;
        if (status && status >= 500) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        break;
      }
    }
    if (orderData) break;
  }
  if (!orderData) {
    const server =
      lastError && lastError.response && lastError.response.data
        ? lastError.response.data
        : null;
    process.stderr.write(
      (server
        ? JSON.stringify(server)
        : lastError && lastError.message
          ? lastError.message
          : "Failed to create order") + "\n"
    );
    process.exit(1);
  }

  const tx = {
    to: orderData.tx.to,
    data: orderData.tx.data,
    value: orderData.tx.value ? ethers.toBigInt(orderData.tx.value) : 0n,
  };

  const sent = await wallet.sendTransaction(tx);
  const receipt = await sent.wait();

  process.stdout.write(
    JSON.stringify({
      hash: sent.hash,
      status: receipt.status,
      orderId: orderData.orderId,
    }) + "\n"
  );
}

main().catch((e) => {
  process.stderr.write(e && e.message ? e.message + "\n" : String(e) + "\n");
  process.exit(1);
});
