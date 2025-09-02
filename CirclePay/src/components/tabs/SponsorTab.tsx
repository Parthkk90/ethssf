import React, { useEffect, useState, useRef } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { Address, pad, PublicClient } from "viem";
import {
  CheckCircle2,
  ArrowRight,
  Clock,
  Wallet,
  Loader2,
  Search,
} from "lucide-react";
import contractABI from "@/usdc.json";
import circlePayABI from "@/CirclePay.json";
import { initializeClient } from "@/app/utils/publicClient";
import { getChainId } from "@wagmi/core";
import { config } from "@/app/utils/config";
import {
  CIRCLEPAY_BASE,
  getContractAddress,
} from "@/app/utils/contractAddresses";
import { Transaction } from "@/types/transaction";

interface SponsorTabProps {
  setActiveTab: React.Dispatch<React.SetStateAction<number>>;
}

const SponsorTab: React.FC<SponsorTabProps> = ({ setActiveTab }) => {
  const { writeContractAsync } = useWriteContract();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [isParticipating, setIsParticipating] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string>("");
  const { address, isConnected } = useAccount();
  const clientRef = useRef<PublicClient | null>(null);
  const [blockScoutUrl, setblockScoutUrl] = useState("");

  useEffect(() => {
    const setupClient = async () => {
      try {
        const currentChainId = getChainId(config);
        setChainId(currentChainId);
        const newClient = initializeClient(currentChainId);
        clientRef.current = newClient as PublicClient;
      } catch (error) {
        console.error("Error initializing client:", error);
      }
    };

    setupClient();
    const fetchTransactions = async () => {
      try {
        const response = await fetch("/api/transactions?status=false");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data: Transaction[] = await response.json();
        console.log(data);
        setTransactions(data);
        setFilteredTransactions(data);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  useEffect(() => {
    const lowercasedTerm = searchTerm.toLowerCase();
    setFilteredTransactions(
      transactions.filter(
        (transaction) =>
          transaction.sender.toLowerCase().includes(lowercasedTerm) ||
          transaction.receiver.toLowerCase().includes(lowercasedTerm)
      )
    );
  }, [searchTerm, transactions]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleTransfer = async (
    from: string,
    to: string,
    value: string | number,
    nonce: number,
    sign: string,
    validAfter: number,
    validBefore: number,
    transactionId: string
  ) => {
    console.log("same chain transfer: calling transferWithAuthorization");
    if (!isConnected) {
      alert("Please connect your account to participate.");
      return;
    }

    setProcessingId(transactionId);
    const validateAddress = (address: string): `0x${string}` => {
      return address.startsWith("0x")
        ? (address as `0x${string}`)
        : (`0x${address}` as `0x${string}`);
    };

    try {
      if (!clientRef.current) {
        alert("Client not initialized. Please try again.");
        return;
      }
      setIsParticipating(true);

      const tx = await writeContractAsync({
        address: (await getContractAddress(chainId)) as Address,
        account: address,
        abi: contractABI,
        functionName: "transferWithAuthorization",
        args: [
          from,
          to,
          value,
          validAfter,
          validBefore,
          pad(validateAddress(nonce.toString())),
          sign,
        ],
      });

      const receipt = await clientRef.current.waitForTransactionReceipt({
        hash: tx,
      });

      if (receipt) {
        await fetch("/api/execute", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionId,
            transactionHash: receipt.transactionHash,
          }),
        });
        setIsParticipating(false);
      }
    } catch (error) {
      console.error("Error participating:", error);
    } finally {
      setIsParticipating(false);
      setProcessingId("");
    }
  };

  const handleCrossChainTransfer = async (
    from: string,
    to: string,
    value: string | number,
    nonce: number,
    sign: string,
    validAfter: number,
    validBefore: number,
    destinationChain: number,
    transactionId: string
  ) => {
    console.log("doing crosschain");
    if (!isConnected) {
      alert("Please connect your account to participate.");
      return;
    }

    setProcessingId(transactionId);
    const validateAddress = (address: string): `0x${string}` => {
      return address.startsWith("0x")
        ? (address as `0x${string}`)
        : (`0x${address}` as `0x${string}`);
    };

    try {
      if (!clientRef.current) {
        alert("Client not initialized. Please try again.");
        return;
      }
      setIsParticipating(true);

      const tx = await writeContractAsync({
        address: CIRCLEPAY_BASE,
        account: address,
        abi: circlePayABI.abi,
        functionName: "transferUsdcCrossChain",
        args: [
          from,
          value,
          validAfter,
          validBefore,
          pad(validateAddress(nonce.toString())),
          sign,
          destinationChain,
          to,
        ],
      });

      const receipt = await clientRef.current.waitForTransactionReceipt({
        hash: tx,
      });

      if (receipt) {
        await fetch("/api/execute", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionId,
            transactionHash: receipt.transactionHash,
          }),
        });
        setIsParticipating(false);
      }
    } catch (error) {
      console.error("Error participating:", error);
    } finally {
      setIsParticipating(false);
      setProcessingId("");
    }
  };

  // main function to call either handleTransfer(same chain) OR handleCrossChainTransfer(cross chain)
  const handleExecute = (transaction: Transaction) => {
    console.log(transaction.chainId);
    console.log(transaction.destinationChain);
    if (transaction.chainId != transaction.destinationChain) {
      handleCrossChainTransfer(
        transaction.sender,
        transaction.receiver,
        transaction.amount,
        transaction.nonce,
        transaction.sign,
        transaction.validAfter,
        transaction.validBefore,
        transaction.destinationChain,
        transaction._id
      );
    } else {
      handleTransfer(
        transaction.sender,
        transaction.receiver,
        transaction.amount,
        transaction.nonce,
        transaction.sign,
        transaction.validAfter,
        transaction.validBefore,
        transaction._id
      );
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string | number) => {
    return (Number(amount) / 1_000_000).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex justify-center items-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Section with Search */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Spread Joy, Pay Their Way! 🤝
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Be the spark that lights someone's day - cover their gas, make
                their transaction play ✨
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 px-4 py-3 rounded-full border border-blue-200">
                <Clock className="w-5 h-5" />
                <span className="font-bold">
                  {filteredTransactions.length} Pending
                </span>
              </div>
              <div className="flex items-center bg-white shadow-lg rounded-xl px-4 py-3 border-2 border-gray-200 focus-within:border-blue-500 transition-all duration-300">
                <Search className="text-gray-400 w-5 h-5 mr-2" />
                <input
                  type="text"
                  placeholder="Search by address..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full bg-transparent focus:outline-none text-gray-700 min-w-[200px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Connection Warning */}
        {!isConnected && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 flex items-center gap-4 text-amber-800 shadow-lg">
            <div className="flex-shrink-0">
              <Wallet className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-lg">Wallet Connection Required 🔐</p>
              <p className="text-amber-700 mt-1">
                Please connect your wallet to participate in transaction execution and help others with gas-free transfers!
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-16 text-center border border-gray-100">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">
              No Matching Transactions
            </h3>
            <p className="text-gray-500 text-lg mb-6">
              Try a different address or check back later for new transactions to sponsor.
            </p>
            <button
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-medium transition-all duration-300 shadow-lg"
              onClick={() => setActiveTab(3)}
            >
              ➕ Create New Transaction
            </button>
          </div>
        ) : (
          /* Transaction Grid */
          <div className="grid gap-8 md:grid-cols-2">
            {filteredTransactions
              .slice()
              .reverse()
              .map((transaction) => (
                <div
                  key={transaction._id}
                  className={`bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 border-2 hover:shadow-2xl
                    ${
                      processingId === transaction._id
                        ? "border-blue-500 ring-4 ring-blue-100"
                        : "border-gray-100 hover:border-blue-200"
                    }`}
                >
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-100">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                          Chain {transaction.chainId}
                        </span>
                        <ArrowRight className="text-gray-400 w-5 h-5" />
                        <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                          Chain {transaction.destinationChain}
                        </span>
                      </div>
                      <time className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full font-medium">
                        {new Date(
                          transaction.initiateDate
                        ).toLocaleDateString()}{" "}
                        {new Date(
                          transaction.initiateDate
                        ).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </time>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">

                    {/* Transaction Details */}
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                              From
                            </div>
                            <div className="font-bold text-gray-900 bg-white px-3 py-2 rounded-lg shadow-sm">
                              {formatAddress(transaction.sender)}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="text-blue-500 w-6 h-6" />
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                              To
                            </div>
                            <div className="font-bold text-gray-900 bg-white px-3 py-2 rounded-lg shadow-sm">
                              {formatAddress(transaction.receiver)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-500 font-medium mb-1">Amount</div>
                        <div className="text-2xl font-bold text-blue-700 bg-white px-4 py-2 rounded-xl shadow-sm inline-block">
                          {formatAmount(transaction.amount)} <span className="text-blue-500">USDC</span>
                        </div>
                      </div>
                    </div>

                    {/* Execute Button */}
                    <button
                      onClick={() => handleExecute(transaction)}
                      disabled={
                        processingId === transaction._id || isParticipating
                      }
                      className="w-full text-white bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 transition-all duration-300 py-4 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      {processingId === transaction._id ? (
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="animate-spin w-5 h-5" />
                          <span>Processing Transaction...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>🚀</span>
                          <span>Execute Transaction</span>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SponsorTab;
