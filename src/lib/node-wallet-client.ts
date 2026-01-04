/**
 * Ergo Node Wallet Client (Server-Side Only)
 * Handles payments via local Ergo node wallet API
 */

export interface NodeWalletStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  changeAddress: string;
  walletHeight: number;
}

export interface NodeWalletBalance {
  height: number;
  balance: number;
  assets: Record<string, number>;
}

export interface PaymentRecipient {
  address: string;
  value: number;
}

export class NodeWalletClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(nodeUrl?: string, apiKey?: string) {
    this.baseUrl = nodeUrl || process.env.ERGO_NODE_URL || 'http://127.0.0.1:9052';
    this.apiKey = apiKey || process.env.ERGO_NODE_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('ERGO_NODE_API_KEY is required');
    }
  }

  /**
   * Get wallet status
   */
  async getStatus(): Promise<NodeWalletStatus> {
    const response = await fetch(`${this.baseUrl}/wallet/status`, {
      headers: {
        'api_key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get wallet status: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<NodeWalletBalance> {
    const response = await fetch(`${this.baseUrl}/wallet/balances`, {
      headers: {
        'api_key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get wallet balance: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Unlock wallet (if locked)
   */
  async unlock(password: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/wallet/unlock`, {
      method: 'POST',
      headers: {
        'api_key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pass: password }),
    });

    return response.ok;
  }

  /**
   * Send transaction via node wallet
   * Node will build, sign, and broadcast the transaction
   */
  async sendTransaction(
    recipients: PaymentRecipient[],
    fee: number = 1000000
  ): Promise<string> {
    // Ensure wallet is unlocked
    const status = await this.getStatus();
    if (!status.isUnlocked) {
      throw new Error('Wallet is locked. Cannot send transaction.');
    }

    // Build transaction request
    const txRequest = {
      requests: recipients,
      fee,
    };

    const response = await fetch(`${this.baseUrl}/wallet/transaction/send`, {
      method: 'POST',
      headers: {
        'api_key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(txRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Transaction failed: ${errorText}`);
    }

    // Response is plain text transaction ID
    const txId = await response.text();
    return txId.replace(/"/g, ''); // Remove quotes if present
  }

  /**
   * Validate recipients before sending
   */
  validateRecipients(recipients: PaymentRecipient[]): void {
    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    for (const recipient of recipients) {
      if (!recipient.address || !recipient.address.startsWith('3')) {
        throw new Error(`Invalid address: ${recipient.address}`);
      }

      if (!recipient.value || recipient.value < 100000) {
        throw new Error(`Value too small: ${recipient.value} nanoERG (min 0.0001 ERG)`);
      }
    }
  }
}
