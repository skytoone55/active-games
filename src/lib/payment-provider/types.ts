/**
 * Payment Provider Abstraction Layer - Types
 * Interface generique pour les providers de paiement (iCount, Stripe, etc.)
 * ActiveLaser est la source de verite - le provider est interchangeable
 */

// ============================================
// TYPES DE BASE
// ============================================

export interface ProviderCredentials {
  cid: string
  user: string
  pass: string
}

export interface ProviderConfig {
  name: string
  credentials: ProviderCredentials
  apiUrl: string
  enabled: boolean
}

export interface ProviderResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

// ============================================
// CLIENT (CONTACT) TYPES
// ============================================

export interface ClientData {
  /** ID interne ActiveLaser */
  id: string
  /** ID custom pour le provider */
  customId?: string
  name: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  mobile?: string
  vatId?: string
  address?: {
    country?: string
    city?: string
    street?: string
    streetNumber?: string
    zip?: string
  }
}

export interface SyncClientResult {
  providerId: string
  action: 'created' | 'updated'
}

// ============================================
// PRODUCT TYPES
// ============================================

export interface ProductData {
  /** ID interne ActiveLaser */
  id: string
  code: string
  name: string
  description?: string
  /** Prix TTC */
  priceIncludingVat: number
  currency: string
  vatRate: number
}

export interface SyncProductResult {
  providerId: string
  sku?: string
  action: 'created' | 'updated'
}

// ============================================
// BILLING TYPES
// ============================================

export interface CardData {
  number: string
  validity: string  // Format MMYY ou YYYY-MM
  cvv: string
  holderId: string
  holderName?: string
}

export interface TokenizedCard {
  tokenId: string
  last4: string
  cardType?: string
  expiry?: string
  holderName?: string
}

export interface ChargeRequest {
  /** Montant a debiter */
  amount: number
  currency: string
  /** Description du paiement */
  description?: string
  /** Client provider ID */
  clientId?: string
  /** Utiliser une carte tokenisee */
  tokenId?: string
  /** OU utiliser les details de carte */
  card?: CardData
  /** Utiliser la pre-autorisation J5 si disponible */
  useJ5IfAvailable?: boolean
}

export interface ChargeResult {
  transactionId: string
  confirmationCode: string
  amount: number
  currency: string
  cardLast4?: string
  cardType?: string
}

export interface PreAuthRequest {
  /** Montant a pre-autoriser (garantie) */
  amount: number
  currency: string
  card: CardData
}

export interface PreAuthResult {
  preAuthId: string
  confirmationCode: string
  amount: number
  currency: string
  cardLast4?: string
  cardType?: string
  /** Date d'expiration de la pre-autorisation */
  expiresAt?: Date
}

export interface CapturePreAuthRequest {
  preAuthId: string
  /** Montant a capturer (peut etre inferieur au montant pre-autorise) */
  amount: number
}

export interface CapturePreAuthResult {
  transactionId: string
  confirmationCode: string
  amount: number
}

export interface ReleasePreAuthRequest {
  preAuthId: string
}

// ============================================
// CARD STORAGE (TOKENIZATION) TYPES
// ============================================

export interface StoreCardRequest {
  clientId: string
  card: CardData
}

export interface StoreCardResult {
  tokenId: string
  last4: string
  cardType?: string
  expiry?: string
  holderName?: string
}

export interface GetStoredCardsResult {
  cards: TokenizedCard[]
}

export interface DeleteCardRequest {
  tokenId: string
  clientId?: string
}

// ============================================
// PAYPAGE (PAYMENT LINK) TYPES
// ============================================

export interface PaymentLinkItem {
  description: string
  /** Prix unitaire TTC */
  unitPriceIncludingVat: number
  quantity: number
  sku?: string
}

export interface GeneratePaymentLinkRequest {
  /** ID de la paypage configuree dans le provider */
  paypageId: string
  /** Items a payer */
  items: PaymentLinkItem[]
  /** Total (optionnel - calcule si non fourni) */
  sum?: number
  currency: string
  /** Infos client pour pre-remplir le formulaire */
  client?: {
    name?: string
    email?: string
    phone?: string
    vatId?: string
  }
  /** URL de retour succes */
  successUrl?: string
  /** URL de retour echec */
  failureUrl?: string
  /** URL de retour annulation */
  cancelUrl?: string
  /** URL pour les notifications IPN (webhook) */
  ipnUrl?: string
  /** Langue de la page */
  lang?: 'he' | 'en' | 'auto'
  /** Nombre max de paiements (installments) */
  maxPayments?: number
}

export interface GeneratePaymentLinkResult {
  /** URL de paiement */
  paymentUrl: string
  /** ID unique de la vente */
  saleId: string
  /** Session ID de la vente */
  saleSessionId?: string
}

// ============================================
// DOCUMENT TYPES
// ============================================

export type DocumentType =
  | 'invoice'     // Facture
  | 'receipt'     // Recu
  | 'invrec'      // Facture-Recu
  | 'deal'        // Transaction
  | 'order'       // Bon de commande
  | 'offer'       // Devis

export interface DocumentItem {
  description: string
  unitPrice: number
  quantity: number
  sku?: string
  taxExempt?: boolean
}

export interface CreditCardPaymentInfo {
  sum: number
  cardNumber: string  // 4 derniers chiffres
  cardType: string
  confirmationCode: string
  numPayments?: number
  holderName?: string
  holderId?: string
  expMonth?: number
  expYear?: number
}

export interface CreateDocumentRequest {
  docType: DocumentType
  clientId?: string
  clientName?: string
  clientEmail?: string
  clientVatId?: string
  items: DocumentItem[]
  currency: string
  /** Paiement par carte */
  creditCard?: CreditCardPaymentInfo
  /** Paiement en especes */
  cash?: { sum: number }
  /** Virement bancaire */
  bankTransfer?: { sum: number; date: string; account?: number }
  /** Envoyer par email */
  sendEmail?: boolean
  /** Langue du document */
  lang?: 'he' | 'en'
  /** Commentaires */
  comments?: string
}

export interface CreateDocumentResult {
  docType: string
  docNum: number
  clientId?: string
  /** URL du document original */
  docUrl?: string
  /** URL de la copie */
  docCopyUrl?: string
  /** URL du PDF */
  pdfUrl?: string
}

export interface GetDocumentRequest {
  docType: DocumentType
  docNum: number
  getPdfLink?: boolean
}

export interface DocumentInfo {
  docType: string
  docNum: number
  date: string
  clientId?: string
  clientName?: string
  totalAmount: number
  totalWithVat: number
  vatAmount: number
  currency: string
  status: 'open' | 'closed' | 'cancelled'
  docUrl?: string
  pdfUrl?: string
  items?: DocumentItem[]
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface WebhookPayload {
  /** Type d'evenement */
  eventType: 'payment_success' | 'payment_failed' | 'refund' | 'document_created'
  /** ID unique du provider pour cette transaction */
  transactionId: string
  /** Montant */
  amount: number
  currency: string
  /** Infos client */
  clientEmail?: string
  clientName?: string
  /** Infos carte */
  cardLast4?: string
  cardType?: string
  /** Infos document cree */
  docType?: string
  docNum?: number
  docUrl?: string
  /** Donnees brutes du provider */
  rawPayload: Record<string, unknown>
}

// ============================================
// PROVIDER INTERFACE
// ============================================

export interface PaymentProvider {
  /** Nom du provider */
  readonly name: string

  /** Test de connexion */
  testConnection(): Promise<ProviderResult<{ valid: boolean }>>

  // --- Clients ---
  syncClient(data: ClientData): Promise<ProviderResult<SyncClientResult>>
  getClient(providerId: string): Promise<ProviderResult<ClientData>>

  // --- Products ---
  syncProduct(data: ProductData): Promise<ProviderResult<SyncProductResult>>

  // --- Billing ---
  chargeCard(request: ChargeRequest): Promise<ProviderResult<ChargeResult>>
  preAuthorize(request: PreAuthRequest): Promise<ProviderResult<PreAuthResult>>
  capturePreAuth(request: CapturePreAuthRequest): Promise<ProviderResult<CapturePreAuthResult>>
  releasePreAuth(request: ReleasePreAuthRequest): Promise<ProviderResult<void>>

  // --- Card Storage ---
  storeCard(request: StoreCardRequest): Promise<ProviderResult<StoreCardResult>>
  getStoredCards(clientId: string): Promise<ProviderResult<GetStoredCardsResult>>
  deleteCard(request: DeleteCardRequest): Promise<ProviderResult<void>>

  // --- PayPage ---
  generatePaymentLink(request: GeneratePaymentLinkRequest): Promise<ProviderResult<GeneratePaymentLinkResult>>

  // --- Documents ---
  createDocument(request: CreateDocumentRequest): Promise<ProviderResult<CreateDocumentResult>>
  getDocument(request: GetDocumentRequest): Promise<ProviderResult<DocumentInfo>>
  sendDocumentByEmail(docType: DocumentType, docNum: number, email?: string): Promise<ProviderResult<void>>

  // --- Webhooks ---
  parseWebhookPayload(rawBody: string | Record<string, unknown>): Promise<ProviderResult<WebhookPayload>>
  validateWebhookOrigin(headers: Record<string, string>, body: string): Promise<boolean>
}

// ============================================
// FACTORY TYPE
// ============================================

export type CreateProviderFn = (config: ProviderConfig) => PaymentProvider
