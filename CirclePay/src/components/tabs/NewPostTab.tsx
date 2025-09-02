"use client";
import { useState, useEffect, useRef } from "react";
import { Address, encodePacked, keccak256, PublicClient } from "viem";
import { signTypedData, getChainId } from "@wagmi/core";
import { config } from "@/app/utils/config";
import { initializeClient } from "@/app/utils/publicClient";
import { useAccount } from "wagmi";
import axios from "axios";
import {
  getContractAddress,
  CIRCLEPAY_BASE,
} from "@/app/utils/contractAddresses";
import {
  Calendar,
  Info,
  Wallet,
  ArrowRight,
  Network,
  Send,
} from "lucide-react";
import SelectWithIcons from "./SelectWithIcons";

export default function NewPostTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [validAfter, setValidAfter] = useState<number | string>("");
  const [validBefore, setValidBefore] = useState<number | string>("");
  const [nonce, setNonce] = useState("");
  const [isValidAfterZero, setIsValidAfterZero] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [signature, setSignature] = useState("");
  const { address, isConnected } = useAccount();
  const [chainId, setChainId] = useState<number>(0);
  const [chainName, setChainName] = useState<string>("base");
  const [receiversChainId, SetReceiversChainId] = useState<number>(84532);
  const clientRef = useRef<PublicClient | null>(null);

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
  }, []);

  const isCrossChain = () => {
    if (receiversChainId != chainId) {
      return true;
    } else {
      return false;
    }
  };

  const validateAddress = (address: string): `0x${string}` => {
    return address.startsWith("0x")
      ? (address as `0x${string}`)
      : (`0x${address}` as `0x${string}`);
  };

  const generateNonce = async () => {
    if (!address) {
      throw new Error("Address is required");
    }

    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const packedData = keccak256(
      encodePacked(["address", "uint256"], [address, timestamp])
    );
    const theNonce = keccak256(packedData);
    setNonce(theNonce);
    return theNonce;
  };

  const handleSign = async () => {
    setIsLoading(true);
    const chainId = getChainId(config);
    console.log(chainId);
    console.log((await getContractAddress(chainId)) as Address);

    try {
      const theNonce = await generateNonce();
      const validFrom = validateAddress(from);
      const validTo = validateAddress(to);

      const valueBigInt = BigInt(Math.round(Number(value) * 1_000_000));
      const validAfterTimestamp = isValidAfterZero
        ? BigInt(0)
        : BigInt(validAfter);
      const validBeforeTimestamp = BigInt(validBefore);

      const signature = await signTypedData(config, {
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        },
        domain: {
          name: "USDC",
          version: "2",
          chainId: BigInt(chainId),
          verifyingContract: (await getContractAddress(chainId)) as Address,
        },
        primaryType: "TransferWithAuthorization",
        message: {
          from: validFrom,
          // to: validTo,
          to: isCrossChain() ? CIRCLEPAY_BASE : validTo,
          value: valueBigInt,
          validAfter: validAfterTimestamp,
          validBefore: validBeforeTimestamp,
          nonce: theNonce,
        },
      });

      setSignature(signature);
      console.log(signature);

      try {
        const response = await axios.post("/api/initiateTransaction", {
          initiator: address,
          sender: from,
          receiver: to,
          amount: BigInt(Math.round(Number(value) * 1_000_000)).toString(),
          validAfter: validAfterTimestamp.toString(),
          validBefore: validBeforeTimestamp.toString(),
          chainId: chainId,
          sign: signature,
          nonce: theNonce.toString(),
          destinationChain: receiversChainId,
        });

        console.log("API response:", response.data);
      } catch (apiError) {
        console.log(apiError);
        console.error("API call error:", apiError);
        alert("Failed to submit transaction to API");
      }
    } catch (error) {
      console.error("Error signing data:", error);
      alert("Failed to sign transaction");
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Addresses" },
    { number: 2, title: "Amount" },
    { number: 3, title: "Timing" },
    { number: 4, title: "Review" },
  ];

  // Validation functions for each step
  const isStep1Valid = () => {
    return from.trim() !== "" && to.trim() !== "";
  };

  const isStep2Valid = () => {
    return value.trim() !== "" && parseFloat(value) > 0;
  };

  const isStep3Valid = () => {
    // If isValidAfterZero is true, we only need to check validBefore
    // If isValidAfterZero is false, we need to check both validAfter and validBefore
    return validBefore !== "" && (isValidAfterZero || validAfter !== "");
  };

  const handleNextStep = () => {
    switch (activeStep) {
      case 1:
        if (isStep1Valid()) {
          setActiveStep(activeStep + 1);
        }
        break;
      case 2:
        if (isStep2Valid()) {
          setActiveStep(activeStep + 1);
        }
        break;
      case 3:
        if (isStep3Valid()) {
          setActiveStep(activeStep + 1);
        }
        break;
    }
  };
  const renderStep = () => {
    switch (activeStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                From Address
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="0x..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                To Address
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  className="w-full pl-10 pr-3 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="0x..."
                />
              </div>
            </div>
            <div className="relative">
              <SelectWithIcons
                setChainName={setChainName}
                chainName={chainName}
                SetReceiversChainId={SetReceiversChainId}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Amount (USDC)
              </label>
              <div className="relative mt-2 rounded-xl shadow-sm">
                <input
                  type="number"
                  className="w-full pl-3 pr-16 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-300 text-lg font-medium"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0.00"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <span className="text-blue-600 font-bold text-lg">USDC</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="validAfterZero"
                  checked={isValidAfterZero}
                  onChange={() => {
                    setIsValidAfterZero(!isValidAfterZero);
                    setValidAfter(isValidAfterZero ? "" : "0");
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="validAfterZero"
                  className="text-sm text-gray-700"
                >
                  Valid immediately
                </label>
              </div>

              {!isValidAfterZero && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Valid After
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="datetime-local"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={
                        validAfter
                          ? new Date(Number(validAfter) * 1000)
                              .toISOString()
                              .slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setValidAfter(new Date(e.target.value).getTime() / 1000)
                      }
                      disabled={isValidAfterZero}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Valid Before
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="datetime-local"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={
                      validBefore
                        ? new Date(Number(validBefore) * 1000)
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setValidBefore(new Date(e.target.value).getTime() / 1000)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">From</span>
                <span className="text-gray-900 font-medium">{from}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">To</span>
                <span className="text-gray-900 font-medium">{to}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount</span>
                <span className="text-gray-900 font-medium">{value} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Valid After</span>
                <span className="text-gray-900 font-medium">
                  {isValidAfterZero
                    ? "Immediately"
                    : new Date(Number(validAfter) * 1000).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Valid Before</span>
                <span className="text-gray-900 font-medium">
                  {new Date(Number(validBefore) * 1000).toLocaleString()}
                </span>
              </div>
              {signature && (
                <div className="mt-4">
                  <span className="text-gray-600">Signature:</span>
                  <p className="mt-1 text-xs text-gray-900 break-all font-mono">
                    {signature}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white">
                Send USDC, Skip the Gas! ⛽️
              </h1>
              <p className="mt-2 text-blue-100">
                Let someone else handle the heavy lifting while you make the
                magic happen ✨
              </p>
            </div>
          </div>
          <div className="px-6 py-8">

            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex justify-between items-center">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-lg transition-all duration-300 ${
                        activeStep >= step.number
                          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white scale-110"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      }`}
                    >
                      {step.number}
                    </div>
                    <span
                      className={`ml-2 text-sm font-medium hidden sm:block transition-colors duration-300 ${
                        activeStep >= step.number
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    >
                      {step.title}
                    </span>
                    {index < steps.length - 1 && (
                      <div
                        className={`h-1 w-12 mx-2 rounded-full transition-all duration-300 ${
                          activeStep > step.number
                            ? "bg-gradient-to-r from-blue-500 to-purple-600"
                            : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form Content */}
            <div className="mt-8">{renderStep()}</div>

            {/* Navigation Buttons */}
            <div className="mt-8 flex justify-between">
              {activeStep > 1 && (
                <button
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="px-6 py-3 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-300 font-medium transition-all duration-300"
                >
                  Back
                </button>
              )}
              {activeStep < 4 ? (
                <button
                  onClick={handleNextStep}
                  className={`ml-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 flex items-center font-medium transition-all duration-300 shadow-lg ${
                    ((activeStep === 1 && !isStep1Valid()) ||
                      (activeStep === 2 && !isStep2Valid()) ||
                      (activeStep === 3 && !isStep3Valid())) &&
                    "opacity-50 cursor-not-allowed"
                  }`}
                  disabled={
                    !isConnected ||
                    (activeStep === 1 && !isStep1Valid()) ||
                    (activeStep === 2 && !isStep2Valid()) ||
                    (activeStep === 3 && !isStep3Valid())
                  }
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSign}
                  className={`ml-auto px-8 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-xl hover:from-green-600 hover:to-blue-700 flex items-center font-medium transition-all duration-300 shadow-lg disabled:opacity-50 ${
                    isLoading ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                  disabled={!isConnected || isLoading}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      <span>Sign Transaction</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Help Card */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl shadow-lg p-6 border border-blue-100">
          <div className="flex items-start">
            <Info className="h-6 w-6 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="ml-4">
              <h3 className="text-lg font-bold text-blue-900">
                How Does This Magic Work? ✨
              </h3>
              <p className="mt-2 text-blue-700 leading-relaxed">
                No gas, no stress! We use smart signature tech (
                <span className="font-bold text-purple-600">EIP-712</span> &{" "}
                <span className="font-bold text-purple-600">EIP-3009</span>) to let you create
                USDC transfers that others can power up later. Think of it like
                sending a pre-approved package - you pack it, someone else
                delivers it! 📦✈️
              </p>
              {!isConnected && (
                <div className="mt-3 px-4 py-2 bg-blue-100 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 font-medium">
                    🔌 Please connect your wallet to continue.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Wallet className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-800">
                  🔐 Wallet Connection Required
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Please connect your wallet to use this feature and start sending gas-free USDC!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
