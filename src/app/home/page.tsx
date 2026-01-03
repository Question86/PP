'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';

export default function HomePage() {
  const router = useRouter();
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const features = [
    {
      icon: '🧩',
      title: 'Modular Snippets',
      description: 'Build prompts from reusable, expert-crafted components',
    },
    {
      icon: '💎',
      title: 'Direct Payments',
      description: 'Pay creators directly on Ergo blockchain with zero custody',
    },
    {
      icon: '🔒',
      title: 'R4 Commitment',
      description: 'Every payment is cryptographically bound to your composition',
    },
    {
      icon: '⚡',
      title: 'Instant Access',
      description: 'Get your content immediately after payment confirmation',
    },
  ];

  const handleGetStarted = () => {
    router.push('/browse');
  };

  const handleConnectWallet = async () => {
    try {
      await wallet.connect();
      router.push('/browse');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  if (!mounted) {
    return null; // Prevent SSR hydration mismatch
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            PromptPage
          </h1>
          <p className="text-2xl text-gray-600 dark:text-gray-300 mb-4">
            The Modular AI Prompt Marketplace
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Build perfect AI prompts from expert-crafted snippets. Pay creators directly on Ergo blockchain.
            Own your prompts forever.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
          {!wallet.isConnected ? (
            <>
              <button
                onClick={handleConnectWallet}
                disabled={!wallet.isAvailable}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {wallet.isAvailable ? '🦘 Connect Nautilus Wallet' : '⚠️ Install Nautilus First'}
              </button>
              <button
                onClick={handleGetStarted}
                className="px-8 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Browse Without Wallet
              </button>
            </>
          ) : (
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 bg-green-600 text-white rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
            >
              ✓ Wallet Connected - Start Shopping
            </button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 border dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg"
            >
              <div className="text-4xl mb-3">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-blue-600 dark:text-blue-400">
                1
              </div>
              <h3 className="font-semibold mb-2">Browse Snippets</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Explore expert-crafted prompt components
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-purple-600 dark:text-purple-400">
                2
              </div>
              <h3 className="font-semibold mb-2">Build Composition</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select snippets that match your needs
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-green-600 dark:text-green-400">
                3
              </div>
              <h3 className="font-semibold mb-2">Pay on Ergo</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Secure payment with R4 commitment hash
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-orange-600 dark:text-orange-400">
                4
              </div>
              <h3 className="font-semibold mb-2">Get Content</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Instant access to your custom prompt
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20 text-center">
          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              V2
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Protocol Version
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              0%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Platform Fee
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              100%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              To Creators
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
              ~2min
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Payment Confirmation
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mb-20 p-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h2 className="text-2xl font-bold mb-4 text-center">Powered by Ergo Blockchain</h2>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">🔐</span>
                R4 Commitment Hash
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Every payment includes a Blake2b-256 commitment binding it to your specific composition
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-purple-600 dark:text-purple-400">⚡</span>
                UTXO-Safe Verification
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Payments aggregated by creator address, verified with register-based proof
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span className="text-green-600 dark:text-green-400">🎯</span>
                Zero Custody
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Funds flow directly from buyer to creators on-chain. Platform never holds your ERG.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Ready to build your perfect AI prompt?
          </p>
          <button
            onClick={handleGetStarted}
            className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold text-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            Get Started →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t dark:border-gray-800 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              © 2026 PromptPage | Built on Ergo Blockchain
            </div>
            <div className="flex gap-6">
              <a href="/browse" className="hover:text-blue-600 dark:hover:text-blue-400">
                Browse
              </a>
              <a href="https://github.com" className="hover:text-blue-600 dark:hover:text-blue-400">
                GitHub
              </a>
              <a href="https://ergoplatform.org" className="hover:text-blue-600 dark:hover:text-blue-400">
                Ergo Platform
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
