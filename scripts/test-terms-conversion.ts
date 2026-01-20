import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function htmlToPlainText(html: string): string {
  if (!html) return ''

  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()

  return text
}

async function test() {
  console.log('=== Test: HTML to Plain Text Conversion ===\n')

  // Fetch Hebrew terms for EVENT
  const { data: template } = await supabase
    .from('email_templates')
    .select('body_template')
    .eq('code', 'terms_event_he')
    .eq('is_active', true)
    .single()

  if (!template?.body_template) {
    console.log('No template found!')
    return
  }

  console.log('=== Original HTML (first 500 chars) ===')
  console.log(template.body_template.substring(0, 500))
  console.log('\n...\n')

  const plainText = htmlToPlainText(template.body_template)

  console.log('=== Converted Plain Text ===')
  console.log(plainText)
  console.log('\n')
  console.log('=== Character count ===')
  console.log('HTML:', template.body_template.length)
  console.log('Plain:', plainText.length)
}

test().catch(console.error)
