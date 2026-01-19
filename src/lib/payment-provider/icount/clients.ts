/**
 * iCount Clients Module
 * Synchronisation des clients ActiveLaser vers iCount
 */

import type { ICountClient } from './client'
import type {
  ClientData,
  ProviderResult,
  SyncClientResult,
} from '../types'

interface ICountClientResponse {
  status: boolean
  reason?: string
  error_description?: string
  error_details?: string[]
  client_id?: number
  // Info client
  client_name?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  mobile?: string
  vat_id?: string
  bus_country?: string
  bus_city?: string
  bus_street?: string
  bus_no?: string
  bus_zip?: number
  [key: string]: unknown
}

export class ICountClientsModule {
  constructor(private client: ICountClient) {}

  /**
   * Synchroniser un client vers iCount (create_or_update)
   * Utilise custom_client_id = UUID ActiveLaser pour retrouver le client
   */
  async syncClient(data: ClientData): Promise<ProviderResult<SyncClientResult>> {
    const params: Record<string, unknown> = {
      custom_client_id: data.id, // UUID ActiveLaser
      client_name: data.name,
    }

    if (data.firstName) params.first_name = data.firstName
    if (data.lastName) params.last_name = data.lastName
    if (data.email) params.email = data.email
    if (data.phone) params.phone = data.phone
    if (data.mobile) params.mobile = data.mobile
    if (data.vatId) params.vat_id = data.vatId

    // Adresse
    if (data.address) {
      if (data.address.country) params.bus_country = data.address.country
      if (data.address.city) params.bus_city = data.address.city
      if (data.address.street) params.bus_street = data.address.street
      if (data.address.streetNumber) params.bus_no = data.address.streetNumber
      if (data.address.zip) params.bus_zip = data.address.zip
    }

    const result = await this.client.request<ICountClientResponse>(
      'client',
      'create_or_update',
      params
    )

    if (result.success && result.data?.client_id) {
      return {
        success: true,
        data: {
          providerId: result.data.client_id.toString(),
          action: result.data.reason === 'client_created' ? 'created' : 'updated',
        },
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Recuperer un client par son ID iCount
   */
  async getClient(providerId: string): Promise<ProviderResult<ClientData>> {
    const result = await this.client.request<ICountClientResponse>(
      'client',
      'info',
      {
        client_id: parseInt(providerId, 10),
      }
    )

    if (result.success && result.data) {
      const data = result.data
      return {
        success: true,
        data: {
          id: providerId,
          name: data.client_name || '',
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
          phone: data.phone,
          mobile: data.mobile,
          vatId: data.vat_id,
          address: {
            country: data.bus_country,
            city: data.bus_city,
            street: data.bus_street,
            streetNumber: data.bus_no,
            zip: data.bus_zip?.toString(),
          },
        },
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Recuperer un client par custom_client_id (UUID ActiveLaser)
   */
  async getClientByCustomId(customId: string): Promise<ProviderResult<ClientData & { providerId: string }>> {
    const result = await this.client.request<ICountClientResponse>(
      'client',
      'info',
      {
        custom_client_id: customId,
      }
    )

    if (result.success && result.data?.client_id !== undefined && result.data.client_id !== null) {
      const data = result.data
      const clientId = data.client_id!
      return {
        success: true,
        data: {
          id: customId,
          providerId: clientId.toString(),
          name: data.client_name || '',
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
          phone: data.phone,
          mobile: data.mobile,
          vatId: data.vat_id,
          address: {
            country: data.bus_country,
            city: data.bus_city,
            street: data.bus_street,
            streetNumber: data.bus_no,
            zip: data.bus_zip?.toString(),
          },
        },
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }
}
