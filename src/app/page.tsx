'use client';

import { useState, useEffect } from 'react';
import { walletConnector } from '@/lib/wallet';
import { MAX_PROMPT_LENGTH, MIN_PROMPT_LENGTH } from '@/lib/config';

export default function HomePage() {
  const [isWalletInstalled, setIsWalletInstalled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [promptText, setPromptText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if Nautilus is installed
    setIsWalletInstalled(walletConnector.isInstalled());
    
    // Check if already connected
    checkConnection();
  }, []);

  async function checkConnection() {
    try {
      const connected = await walletConnector.isConnected();
      if (connected) {
        setIsConnected(true);
        const address = await walletConnector.getChangeAddress();
        setUserAddress(address);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  }

  async function handleConnect() {
    try {
      setMessage('Connecting to Nautilus...');
      await walletConnector.connect();
      setIsConnected(true);
      const address = await walletConnector.getChangeAddress();
      setUserAddress(address);
      setMessage('Connected successfully!');
    } catch (error: any) {
      console.error('Connection error:', error);
      setMessage(`Failed to connect: ${error.message}`);
    }
  }

  async function handleSubmitPrompt() {
    if (!promptText.trim()) {
      setMessage('Please enter a prompt');
      return;
    }

    if (promptText.length < MIN_PROMPT_LENGTH) {
      setMessage(`Prompt must be at least ${MIN_PROMPT_LENGTH} characters`);
      return;
    }

    if (promptText.length > MAX_PROMPT_LENGTH) {
      setMessage(`Prompt must not exceed ${MAX_PROMPT_LENGTH} characters`);
      return;
    }

    setIsSubmitting(true);
    setMessage('Saving prompt...');

    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerAddress: userAddress,
          promptText: promptText.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save prompt');
      }

      const data = await response.json();
      setMessage('Prompt saved successfully!');
      
      // Redirect to prompt detail page
      window.location.href = data.urlPath;
    } catch (error: any) {
      console.error('Submit error:', error);
      setMessage(`Failed to save prompt: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isWalletInstalled) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card bg-red-50 border-red-200">
          <h2 className="text-xl font-bold text-red-800 mb-4">Nautilus Wallet Not Found</h2>
          <p className="text-red-700 mb-4">
            Please install the Nautilus wallet extension to use PromptPage.
          </p>
          <a
            href="https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-block"
          >
            Install Nautilus Wallet
          </a>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Welcome to PromptPage</h2>
          <p className="text-gray-700 mb-6">
            Store your prompts and mint them as Ergo NFTs. Connect your Nautilus wallet to get started.
          </p>
          <button
            onClick={handleConnect}
            className="btn btn-primary"
          >
            Connect Nautilus Wallet
          </button>
          {message && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Create Prompt</h2>
            <p className="text-sm text-gray-600">
              Connected: {userAddress.substring(0, 12)}...{userAddress.substring(userAddress.length - 8)}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt Text
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="textarea"
              rows={10}
              placeholder="Enter your prompt here..."
              maxLength={MAX_PROMPT_LENGTH}
              disabled={isSubmitting}
            />
            <div className="text-sm text-gray-500 mt-1">
              {promptText.length} / {MAX_PROMPT_LENGTH} characters
            </div>
          </div>

          <button
            onClick={handleSubmitPrompt}
            disabled={isSubmitting || !promptText.trim()}
            className="btn btn-primary w-full"
          >
            {isSubmitting ? 'Saving...' : 'Save Prompt'}
          </button>

          {message && (
            <div className={`p-3 rounded ${
              message.includes('success') 
                ? 'bg-green-50 border border-green-200 text-green-800'
                : message.includes('Failed')
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">How It Works</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700">
          <li>Write your prompt and save it (stored on server)</li>
          <li>Mint an NFT that proves ownership of your prompt</li>
          <li>The NFT contains a hash of your prompt text</li>
          <li>Later: Make your prompt bookable for others to purchase</li>
        </ol>
      </div>
    </div>
  );
}
