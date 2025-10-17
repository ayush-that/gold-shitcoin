import { ethers } from "ethers";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const BNB_PRIVATE_KEY = process.env.BNB_PRIVATE_KEY;
const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY;
const BSC_RPC_URL = process.env.BSC_RPC_URL;
const ETH_RPC_URL = process.env.ETH_RPC_URL;
const PAXG_CONTRACT_ADDRESS = process.env.PAXG_CONTRACT_ADDRESS;

const bscProvider = new ethers.JsonRpcProvider(BSC_RPC_URL);
const ethProvider = new ethers.JsonRpcProvider(ETH_RPC_URL);

export async function getBNBBalance() {
  const wallet = new ethers.Wallet(BNB_PRIVATE_KEY, bscProvider);
  const balance = await bscProvider.getBalance(wallet.address);
  const balanceInBNB = ethers.formatEther(balance);
  return { address: wallet.address, balance: balanceInBNB };
}

export async function getPAXGBalance() {
  const wallet = new ethers.Wallet(ETH_PRIVATE_KEY, ethProvider);

  const paxgABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  const paxgContract = new ethers.Contract(
    PAXG_CONTRACT_ADDRESS,
    paxgABI,
    ethProvider
  );
  const balance = await paxgContract.balanceOf(wallet.address);
  const decimals = await paxgContract.decimals();
  const balanceInPAXG = ethers.formatUnits(balance, decimals);

  return { address: wallet.address, balance: balanceInPAXG };
}

export async function getDebridgeQuote(amountBNB) {
  const url = "https://api.dln.trade/v1.0/dln/order/quote";

  const params = {
    srcChainId: "56",
    dstChainId: "1",
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    dstChainTokenOut: PAXG_CONTRACT_ADDRESS,
    amountIn: ethers.parseEther(amountBNB).toString(),
    slippage: "0.03",
  };

  const response = await axios.get(url, {
    params,
    headers: {
      Accept: "application/json",
    },
  });

  return response.data;
}

export async function createDebridgeOrder(amountBNB) {
  const quote = await getDebridgeQuote(amountBNB);

  const orderParams = {
    srcChainId: "56",
    dstChainId: "1",
    srcChainTokenIn: "0x0000000000000000000000000000000000000000",
    dstChainTokenOut: PAXG_CONTRACT_ADDRESS,
    amountIn: ethers.parseEther(amountBNB).toString(),
    slippage: "0.03",
    referralCode:
      "0x0000000000000000000000000000000000000000000000000000000000000000",
  };

  const url = "https://api.dln.trade/v1.0/dln/order/create-tx";

  const response = await axios.post(url, orderParams, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

export async function swapBNBtoPAXG(amountBNB) {
  const bnbWallet = new ethers.Wallet(BNB_PRIVATE_KEY, bscProvider);

  const orderData = await createDebridgeOrder(amountBNB);

  const tx = {
    to: orderData.tx.to,
    data: orderData.tx.data,
    value: ethers.parseEther(amountBNB),
    gasLimit: orderData.tx.gas,
    gasPrice: orderData.tx.gasPrice,
  };

  const signedTx = await bnbWallet.sendTransaction(tx);
  await signedTx.wait();

  return {
    hash: signedTx.hash,
    orderId: orderData.orderId,
    dstChainOrderId: orderData.dstChainOrderId,
  };
}

export async function checkOrderStatus(orderId) {
  const url = `https://api.dln.trade/v1.0/dln/order/${orderId}`;

  const response = await axios.get(url, {
    headers: {
      Accept: "application/json",
    },
  });

  return response.data;
}

export async function waitForOrderCompletion(orderId, maxWaitTime = 300000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkOrderStatus(orderId);

    if (status.status === "FULFILLED") {
      return { completed: true, status };
    } else if (status.status === "FAILED") {
      return { completed: false, status, error: "Order failed" };
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  return { completed: false, error: "Timeout waiting for order completion" };
}
