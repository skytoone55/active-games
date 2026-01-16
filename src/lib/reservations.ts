/**
 * Utilitaire pour gérer les réservations (lecture/écriture fichier JSON)
 * Simple et efficace pour débuter
 */

import { promises as fs } from 'fs'
import { join } from 'path'

export interface Reservation {
  id: string
  branch: string
  type: 'game' | 'event'
  players: number
  date: string
  time: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  specialRequest: string | null
  eventType: string | null // "birthday", "bar_mitzvah", "corporate", "party", "other"
  eventAge: number | null
  reservationNumber: string
  createdAt: string
  status: 'confirmed' | 'cancelled'
}

const RESERVATIONS_FILE = join(process.cwd(), 'data', 'reservations.json')

/**
 * Lit toutes les réservations depuis le fichier JSON
 */
export async function getAllReservations(): Promise<Reservation[]> {
  try {
    const data = await fs.readFile(RESERVATIONS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    // Si le fichier n'existe pas, retourner un tableau vide
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    console.error('Error reading reservations:', error)
    throw error
  }
}

/**
 * Sauvegarde une nouvelle réservation
 */
export async function saveReservation(reservation: Omit<Reservation, 'id' | 'createdAt' | 'status'>): Promise<Reservation> {
  try {
    const reservations = await getAllReservations()
    
    const newReservation: Reservation = {
      ...reservation,
      id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      status: 'confirmed',
    }
    
    reservations.push(newReservation)
    
    await fs.writeFile(RESERVATIONS_FILE, JSON.stringify(reservations, null, 2), 'utf-8')
    
    return newReservation
  } catch (error) {
    console.error('Error saving reservation:', error)
    throw error
  }
}

/**
 * Met à jour le statut d'une réservation
 */
export async function updateReservationStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<Reservation | null> {
  try {
    const reservations = await getAllReservations()
    const index = reservations.findIndex(r => r.id === id)
    
    if (index === -1) {
      return null
    }
    
    reservations[index].status = status
    await fs.writeFile(RESERVATIONS_FILE, JSON.stringify(reservations, null, 2), 'utf-8')
    
    return reservations[index]
  } catch (error) {
    console.error('Error updating reservation:', error)
    throw error
  }
}
