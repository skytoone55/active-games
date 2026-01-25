/**
 * iCount API Client
 * Gestion de l'authentification et des requetes vers l'API iCount v3
 */

import type { ProviderCredentials, ProviderResult } from '../types'

const ICOUNT_API_BASE_URL = 'https://api.icount.co.il/api/v3.php'

// Timeout par défaut pour les requêtes iCount (30 secondes)
const ICOUNT_REQUEST_TIMEOUT_MS = 30 * 1000

/**
 * Helper pour fetch avec timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = ICOUNT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

interface ICountSession {
  sid: string
  createdAt: number
  expiresAt: number
}

interface ICountApiResponse {
  status: boolean
  reason?: string
  error_description?: string
  error_details?: string[]
  [key: string]: unknown
}

export class ICountClient {
  private credentials: ProviderCredentials
  private session: ICountSession | null = null
  private sessionTTL = 30 * 60 * 1000 // 30 minutes

  constructor(credentials: ProviderCredentials) {
    this.credentials = credentials
  }

  /**
   * Obtenir un session ID valide
   */
  private async getSessionId(): Promise<string | null> {
    // Verifier si la session est encore valide
    if (this.session && Date.now() < this.session.expiresAt) {
      return this.session.sid
    }

    // Sinon, se reconnecter
    const loginResult = await this.login()
    if (loginResult.success && loginResult.data?.sid) {
      this.session = {
        sid: loginResult.data.sid,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.sessionTTL,
      }
      return this.session.sid
    }

    return null
  }

  /**
   * Login pour obtenir un session ID
   */
  async login(): Promise<ProviderResult<{ sid: string }>> {
    try {
      const response = await fetchWithTimeout(`${ICOUNT_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cid: this.credentials.cid,
          user: this.credentials.user,
          pass: this.credentials.pass,
        }),
      })

      const data: ICountApiResponse = await response.json()

      if (data.status && data.sid) {
        return {
          success: true,
          data: { sid: data.sid as string },
        }
      }

      return {
        success: false,
        error: {
          code: data.reason || 'login_failed',
          message: data.error_description || 'Login failed',
          details: data.error_details,
        },
      }
    } catch (error) {
      // Gérer spécifiquement l'erreur de timeout
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'timeout',
            message: 'iCount API request timed out (30s)',
          },
        }
      }
      return {
        success: false,
        error: {
          code: 'network_error',
          message: error instanceof Error ? error.message : 'Network error',
        },
      }
    }
  }

  /**
   * Logout pour fermer la session
   */
  async logout(): Promise<ProviderResult<void>> {
    if (!this.session) {
      return { success: true }
    }

    try {
      await fetchWithTimeout(`${ICOUNT_API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sid: this.session.sid,
        }),
      })

      this.session = null
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'logout_error',
          message: error instanceof Error ? error.message : 'Logout error',
        },
      }
    }
  }

  /**
   * Test de connexion avec les credentials
   */
  async testConnection(): Promise<ProviderResult<{ valid: boolean }>> {
    const loginResult = await this.login()

    if (loginResult.success) {
      // Deconnexion immediate apres le test
      await this.logout()
      return {
        success: true,
        data: { valid: true },
      }
    }

    return {
      success: false,
      data: { valid: false },
      error: loginResult.error,
    }
  }

  /**
   * Effectuer une requete vers l'API iCount
   * @param module - Module API (client, doc, cc, paypage, etc.)
   * @param method - Methode API (create, update, bill, etc.)
   * @param params - Parametres de la requete
   * @param useSession - Utiliser le session ID (true par defaut)
   */
  async request<T extends ICountApiResponse>(
    module: string,
    method: string,
    params: Record<string, unknown> = {},
    useSession = true
  ): Promise<ProviderResult<T>> {
    try {
      const requestParams: Record<string, unknown> = { ...params }

      if (useSession) {
        const sid = await this.getSessionId()
        if (sid) {
          requestParams.sid = sid
        } else {
          // Fallback sur credentials directes
          requestParams.cid = this.credentials.cid
          requestParams.user = this.credentials.user
          requestParams.pass = this.credentials.pass
        }
      } else {
        // Pas de session, utiliser credentials directes
        requestParams.cid = this.credentials.cid
        requestParams.user = this.credentials.user
        requestParams.pass = this.credentials.pass
      }

      const url = `${ICOUNT_API_BASE_URL}/${module}/${method}`

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestParams),
      })

      const data: T = await response.json()

      if (data.status) {
        return {
          success: true,
          data,
        }
      }

      // Gerer l'expiration de session
      if (data.reason === 'session_expired' || data.reason === 'invalid_session') {
        this.session = null
        // Retry une fois avec nouvelle session
        const retryParams = { ...params }
        const newSid = await this.getSessionId()
        if (newSid) {
          retryParams.sid = newSid
          const retryResponse = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(retryParams),
          })
          const retryData: T = await retryResponse.json()
          if (retryData.status) {
            return { success: true, data: retryData }
          }
        }
      }

      return {
        success: false,
        error: {
          code: data.reason || 'api_error',
          message: data.error_description || 'API request failed',
          details: data.error_details,
        },
      }
    } catch (error) {
      // Gérer spécifiquement l'erreur de timeout
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[ICOUNT] Request timeout for ${module}/${method}`)
        return {
          success: false,
          error: {
            code: 'timeout',
            message: 'iCount API request timed out (30s)',
          },
        }
      }
      return {
        success: false,
        error: {
          code: 'network_error',
          message: error instanceof Error ? error.message : 'Network error',
        },
      }
    }
  }

  /**
   * Getter pour les credentials (lecture seule)
   */
  getCredentials(): Readonly<ProviderCredentials> {
    return { ...this.credentials }
  }
}
