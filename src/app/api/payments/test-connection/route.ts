/**
 * API Route: Test Payment Provider Connection
 * POST /api/payments/test-connection
 *
 * Tests the connection to iCount API with provided credentials
 */

import { NextRequest, NextResponse } from 'next/server'

const ICOUNT_API_BASE_URL = 'https://api.icount.co.il/api/v3.php'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cid, user, pass } = body

    if (!cid || !user || !pass) {
      return NextResponse.json(
        { success: false, error: 'Missing credentials (cid, user, pass required)' },
        { status: 400 }
      )
    }

    console.log('[iCount Test] Attempting login with cid:', cid, 'user:', user)

    // Test login to iCount
    const loginResponse = await fetch(`${ICOUNT_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cid,
        user,
        pass,
      }),
    })

    const loginData = await loginResponse.json()

    console.log('[iCount Test] Login response:', JSON.stringify(loginData, null, 2))

    if (loginData.status && loginData.sid) {
      // Login successful, logout to clean up
      try {
        await fetch(`${ICOUNT_API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sid: loginData.sid,
          }),
        })
      } catch (logoutError) {
        // Ignore logout errors
        console.log('[iCount Test] Logout error (ignored):', logoutError)
      }

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        data: { valid: true }
      })
    }

    // Login failed
    return NextResponse.json({
      success: false,
      error: loginData.error_description || loginData.reason || 'Login failed',
      details: loginData.error_details || [],
      data: { valid: false }
    })

  } catch (error) {
    console.error('[iCount Test] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        data: { valid: false }
      },
      { status: 500 }
    )
  }
}
