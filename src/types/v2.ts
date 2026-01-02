// Type definitions for V2 Modular Marketplace
import type { SnippetCategory } from '../lib/config_v2';

// =====================================================
// ERGO WALLET TYPES
// =====================================================

export interface ErgoUTXO {
  boxId: string;
  value: string; // nanoERG as string
  ergoTree: string;
  assets: { tokenId: string; amount: string }[];
  creationHeight: number;
  additionalRegisters: Record<string, string>;
  transactionId: string;
  index: number;
}

export interface UnsignedTransaction {
  inputs: ErgoUTXO[];
  outputs: {
    value: string;
    ergoTree: string;
    assets?: { tokenId: string; amount: string }[];
    additionalRegisters?: Record<string, string>;
    creationHeight: number;
  }[];
  dataInputs?: ErgoUTXO[];
}

export interface SignedTransaction {
  id: string;
  inputs: any[];
  dataInputs: any[];
  outputs: any[];
}

// =====================================================
// PAYMENT INTENT TYPES
// =====================================================

export interface PaymentIntent {
  compositionId: number;
  platformOutput: {
    address: string;
    amount: string; // nanoERG
  };
  creatorOutputs: {
    address: string;
    amount: string; // nanoERG
    snippetCount: number;
    snippetVersionIds: number[];
  }[];
  memo: string; // compositionId as string
  totalRequired: string; // nanoERG
  estimatedFee: string; // nanoERG
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

// Creator API
export interface CreateSnippetRequest {
  title: string;
  summary?: string;
  category: SnippetCategory;
}

export interface CreateSnippetResponse {
  snippetId: number;
  status: 'draft';
}

export interface CreateVersionRequest {
  content: string;
  price_nanoerg: string; // bigint as string
}

export interface CreateVersionResponse {
  versionId: number;
  version: number;
  content_hash: string;
}

export interface PublishSnippetResponse {
  snippetId: number;
  status: 'published';
}

// User API
export interface CreateRequestRequest {
  userAddress: string;
  userPrompt: string;
}

export interface CreateRequestResponse {
  requestId: number;
}

export interface ProposeCompositionRequest {
  requestId: number;
}

export interface CompositionItemResponse {
  snippetTitle: string;
  snippetSummary: string | null;
  creatorName: string;
  priceNanoerg: string;
  category: SnippetCategory;
  rationale?: string;
}

export interface ProposeCompositionResponse {
  compositionId: number;
  items: CompositionItemResponse[];
  totals: {
    snippetsTotal: string; // nanoERG
    platformFee: string; // nanoERG
    grandTotal: string; // nanoERG
  };
  status: 'proposed';
}

export interface LockCompositionRequest {
  userAddress: string;
}

export interface LockCompositionResponse {
  paymentIntent: PaymentIntent;
}

export interface ConfirmPaymentRequest {
  txId: string;
}

export interface ConfirmPaymentResponse {
  ok: boolean;
  status: 'paid' | 'failed';
  verificationDetails?: {
    platformOutputVerified: boolean;
    creatorOutputsVerified: boolean[];
    registersVerified?: boolean;
  };
}

// =====================================================
// DASHBOARD TYPES
// =====================================================

export interface CreatorDashboardData {
  creator: {
    id: number;
    displayName: string;
    payoutAddress: string;
  };
  snippets: {
    id: number;
    title: string;
    category: SnippetCategory;
    status: string;
    versions: number;
    usageCount: number;
    totalEarned: string; // nanoERG
  }[];
  earnings: {
    totalEarned: string; // nanoERG
    confirmedPayments: number;
    pendingPayments: number;
  };
}

export interface UserDashboardData {
  user: {
    address: string;
  };
  compositions: {
    id: number;
    status: string;
    snippetCount: number;
    totalPrice: string; // nanoERG
    txId: string | null;
    createdAt: string;
  }[];
  stats: {
    totalCompositions: number;
    paidCompositions: number;
    totalSpent: string; // nanoERG
  };
}

// =====================================================
// EXPLORER VERIFICATION TYPES
// =====================================================

export interface ExplorerTransaction {
  id: string;
  inputs: {
    boxId: string;
    value: number;
    address: string;
  }[];
  outputs: {
    boxId: string;
    value: number;
    address: string;
    additionalRegisters?: Record<string, string>;
  }[];
  inclusionHeight: number;
  confirmationsCount: number;
}

export interface VerificationResult {
  valid: boolean;
  platformOutputValid: boolean;
  creatorOutputsValid: boolean[];
  registersValid: boolean;
  errors: string[];
}

// =====================================================
// COMPONENT PROPS
// =====================================================

export interface WalletConnectProps {
  onConnect?: (address: string) => void;
  onDisconnect?: () => void;
}

export interface SnippetCardProps {
  snippet: {
    id: number;
    title: string;
    summary: string | null;
    category: SnippetCategory;
    price: string; // formatted ERG
  };
  onClick?: () => void;
  showActions?: boolean;
}

export interface CompositionSummaryProps {
  composition: {
    id: number;
    items: CompositionItemResponse[];
    totals: {
      snippetsTotal: string;
      platformFee: string;
      grandTotal: string;
    };
  };
  onProceedToPayment?: () => void;
}

export interface PayButtonProps {
  compositionId: number;
  paymentIntent: PaymentIntent;
  userAddress: string;
  onSuccess?: (txId: string) => void;
  onError?: (error: string) => void;
}
