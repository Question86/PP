'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { walletConnector } from '@/lib/wallet';
import { buildMintTransaction, getCurrentHeight } from '@/lib/tx-builder';
import { Prompt } from '@/types';

const ERGO_EXPLORER_API = process.env.NEXT_PUBLIC_ERGO_EXPLORER_API || 'https://api-testnet.ergoplatform.com';

export default function PromptDetailPage() {
  const params = useParams();
  const promptId = params.id as string;

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMinting, setIsMinting] = useState(false);
  const [mintMessage, setMintMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');

  useEffect(() => {
    loadPrompt();
    checkWalletConnection();
  }, [promptId]);

  async function loadPrompt() {
    try {
      const response = await fetch(`/api/prompts/${promptId}`);
      if (!response.ok) {
        throw new Error('Prompt not found');
      }
      const data = await response.json();
      setPrompt(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkWalletConnection() {
    try {
      const connected = await walletConnector.isConnected();
      if (connected) {
        setIsConnected(true);
        const address = await walletConnector.getChangeAddress();
        setUserAddress(address);
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  }

  async function handleConnectWallet() {
    try {
      await walletConnector.connect();
      setIsConnected(true);
      const address = await walletConnector.getChangeAddress();
      setUserAddress(address);
      setMintMessage('Wallet connected successfully');
    } catch (error: any) {
      setMintMessage(`Failed to connect: ${error.message}`);
    }
  }

  async function handleMint() {
    if (!prompt) return;
    if (!isConnected) {
      setMintMessage('Please connect your wallet first');
      return;
    }

    setIsMinting(true);
    setMintMessage('Preparing transaction...');

    try {
      // Get UTXOs from wallet
      const utxos = await walletConnector.getUtxos();
      
      if (utxos.length === 0) {
        throw new Error('No UTXOs available. Please add funds to your wallet.');
      }

      // Get current blockchain height
      const creationHeight = await getCurrentHeight(ERGO_EXPLORER_API);

      // Build unsigned transaction
      setMintMessage('Building transaction...');
      const unsignedTx = await buildMintTransaction(
        {
          promptId: prompt.id,
          promptHashHex: prompt.prompt_hash,
          urlPath: `/p/${prompt.id}`,
          userAddress,
          utxos,
        },
        creationHeight
      );

      // Sign transaction with Nautilus
      setMintMessage('Please sign the transaction in Nautilus...');
      const signedTxHex = await walletConnector.signTx(unsignedTx);

      // Submit transaction
      setMintMessage('Submitting transaction...');
      const txId = await walletConnector.submitTx(signedTxHex);

      // Confirm with backend
      setMintMessage('Confirming transaction...');
      const tokenId = utxos[0].boxId; // Token ID = first input box ID
      
      await fetch(`/api/prompts/${promptId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          txId,
          tokenId,
        }),
      });

      setMintMessage(`✅ NFT minted successfully! TX ID: ${txId}`);
      
      // Reload prompt to update status
      setTimeout(() => {
        loadPrompt();
      }, 2000);
    } catch (error: any) {
      console.error('Mint error:', error);
      setMintMessage(`❌ Minting failed: ${error.message}`);
    } finally {
      setIsMinting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card">
          <p className="text-center text-gray-600">Loading prompt...</p>
        </div>
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-800">{error || 'Prompt not found'}</p>
          <a href="/" className="btn btn-secondary mt-4 inline-block">
            ← Back to Home
          </a>
        </div>
      </div>
    );
  }

  const canMint = prompt.status === 'stored';
  const isMinted = prompt.status === 'minted' || prompt.status === 'mint_pending';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Status Banner */}
      <div className={`card ${
        isMinted ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">
              Status: <span className="uppercase">{prompt.status}</span>
            </h3>
            {prompt.token_id && (
              <p className="text-sm text-gray-700 mt-1">
                Token ID: <code className="bg-white px-2 py-1 rounded">{prompt.token_id}</code>
              </p>
            )}
            {prompt.mint_tx_id && (
              <p className="text-sm text-gray-700 mt-1">
                TX ID: <code className="bg-white px-2 py-1 rounded">{prompt.mint_tx_id}</code>
              </p>
            )}
          </div>
          {isMinted && (
            <span className="text-3xl">✅</span>
          )}
        </div>
      </div>

      {/* Prompt Content */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Prompt #{prompt.id}</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Owner Address
          </label>
          <code className="block bg-gray-100 px-3 py-2 rounded text-sm">
            {prompt.owner_address}
          </code>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prompt Hash
          </label>
          <code className="block bg-gray-100 px-3 py-2 rounded text-sm break-all">
            {prompt.prompt_hash}
          </code>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prompt Text
          </label>
          <div className="bg-gray-50 p-4 rounded border border-gray-200 whitespace-pre-wrap">
            {prompt.prompt_text}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          Created: {new Date(prompt.created_at).toLocaleString()}
        </div>
      </div>

      {/* Mint Section */}
      {canMint && (
        <div className="card">
          <h3 className="text-xl font-bold mb-4">Mint NFT</h3>
          <p className="text-gray-700 mb-4">
            Mint this prompt as an Ergo NFT. The NFT will contain proof of ownership with the prompt hash stored in its registers.
          </p>

          {!isConnected ? (
            <button
              onClick={handleConnectWallet}
              className="btn btn-primary"
            >
              Connect Nautilus Wallet
            </button>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Connected: {userAddress.substring(0, 12)}...{userAddress.substring(userAddress.length - 8)}
              </div>
              
              <button
                onClick={handleMint}
                disabled={isMinting}
                className="btn btn-primary w-full"
              >
                {isMinting ? 'Minting...' : 'Mint NFT (0.05 ERG service fee)'}
              </button>
            </>
          )}

          {mintMessage && (
            <div className={`mt-4 p-3 rounded ${
              mintMessage.includes('✅')
                ? 'bg-green-50 border border-green-200 text-green-800'
                : mintMessage.includes('❌')
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
              {mintMessage}
            </div>
          )}
        </div>
      )}

      {/* Verify Section (Placeholder for MVP) */}
      {isMinted && (
        <div className="card bg-gray-50">
          <h3 className="text-xl font-bold mb-4">Verify NFT</h3>
          <p className="text-gray-700 mb-2">
            Verification features will allow anyone to:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4">
            <li>Fetch the NFT box from the blockchain</li>
            <li>Read the prompt hash from register R4</li>
            <li>Compare it with the hash of the stored prompt text</li>
            <li>Confirm authenticity</li>
          </ul>
          <p className="text-sm text-gray-500 italic">
            Note: Full verification via explorer API will be implemented in the next iteration.
          </p>
        </div>
      )}

      <div className="text-center">
        <a href="/" className="btn btn-secondary">
          ← Back to Home
        </a>
      </div>
    </div>
  );
}
