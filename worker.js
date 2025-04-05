// Cloudflare Worker for Just Sticky Notes
// This handles data storage and authentication

// Main entry point - handles all incoming requests
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  async function handleRequest(request) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCors(request)
    }
    
    const url = new URL(request.url)
    const path = url.pathname
    
    try {
      // Handle different API endpoints
      if (path === '/user-data' && request.method === 'GET') {
        return await getUserData(request)
      } else if (path === '/save-data' && request.method === 'POST') {
        return await saveUserData(request)
      } else {
        return new Response('Not Found', { status: 404 })
      }
    } catch (err) {
      return new Response(`Server Error: ${err.message}`, { 
        status: 500,
        headers: corsHeaders
      })
    }
  }
  
  // CORS headers for cross-origin requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }
  
  // Handle CORS preflight requests
  function handleCors() {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }
  
  // Verify Google token and get user info
  async function verifyGoogleToken(token) {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`)
      
      if (!response.ok) {
        throw new Error('Invalid token')
      }
      
      const data = await response.json()
      return {
        id: data.sub,
        email: data.email,
        name: data.name
      }
    } catch (error) {
      throw new Error('Authentication failed')
    }
  }
  
  // Get user data from KV store
  async function getUserData(request) {
    // Get user ID from query parameters
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    
    if (!userId) {
      return new Response('User ID is required', { 
        status: 400,
        headers: corsHeaders
      })
    }
    
    // Verify authentication
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Authorization required', { 
        status: 401,
        headers: corsHeaders
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    try {
      // Verify the token
      const userInfo = await verifyGoogleToken(token)
      
      // Make sure the requested user ID matches the authenticated user
      if (userInfo.id !== userId) {
        return new Response('Unauthorized access', { 
          status: 403,
          headers: corsHeaders
        })
      }
      
      // Get data from KV
      const userData = await STICKY_NOTES_DATA.get(userId)
      
      return new Response(userData || '{"notes":[],"pins":[],"strings":[]}', {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    } catch (error) {
      return new Response(`Authentication error: ${error.message}`, { 
        status: 401,
        headers: corsHeaders
      })
    }
  }
  
  // Save user data to KV store
  async function saveUserData(request) {
    // Verify authentication
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Authorization required', { 
        status: 401,
        headers: corsHeaders
      })
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    try {
      // Verify the token
      const userInfo = await verifyGoogleToken(token)
      
      // Get the request body
      const data = await request.json()
      
      // Add metadata
      data.lastSaved = new Date().toISOString()
      
      // Save to KV
      await STICKY_NOTES_DATA.put(userInfo.id, JSON.stringify(data))
      
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    } catch (error) {
      return new Response(`Error saving data: ${error.message}`, { 
        status: 400,
        headers: corsHeaders
      })
    }
  }