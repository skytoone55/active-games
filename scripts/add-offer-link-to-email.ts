/**
 * Script: Add {{offer_section}} variable to email templates
 *
 * The offer_section variable is generated dynamically in email-sender.ts
 * It contains the complete HTML for the offer link section (or empty string if no offer)
 * This allows conditional display without template logic
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function addOfferSection() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Update all booking confirmation templates
  const templateCodes = ['booking_confirmation_he', 'booking_confirmation_en', 'booking_confirmation_fr']

  for (const code of templateCodes) {
    const { data: template } = await supabase
      .from('email_templates')
      .select('id, body_template')
      .eq('code', code)
      .single()

    if (!template) {
      console.log(`❌ Template ${code} not found`)
      continue
    }

    console.log(`\n📧 Processing ${code}...`)
    console.log(`   Current length: ${template.body_template.length}`)

    // Check if offer_section already exists
    if (template.body_template.includes('{{offer_section}}')) {
      console.log('   ℹ️  {{offer_section}} already exists')
      continue
    }

    // Find the position to insert - after terms_conditions section
    // Look for {{terms_conditions}} followed by closing tags
    const termsPattern = '{{terms_conditions}}'
    const termsIndex = template.body_template.indexOf(termsPattern)

    if (termsIndex === -1) {
      console.log('   ❌ Could not find {{terms_conditions}}')
      // Fallback: try to find footer
      const footerPattern = '<!-- Footer -->'
      const footerIndex = template.body_template.indexOf(footerPattern)

      if (footerIndex === -1) {
        console.log('   ❌ Could not find footer either')
        continue
      }

      // Insert before footer
      const newBody =
        template.body_template.slice(0, footerIndex) +
        '{{offer_section}}\n\n                    ' +
        template.body_template.slice(footerIndex)

      const { error } = await supabase
        .from('email_templates')
        .update({ body_template: newBody })
        .eq('id', template.id)

      if (error) {
        console.log(`   ❌ Error: ${error.message}`)
      } else {
        console.log('   ✅ Added {{offer_section}} before footer')
      }
      continue
    }

    // Find the </td></tr> after terms_conditions
    const afterTerms = template.body_template.slice(termsIndex)
    // Look for the pattern: </div> followed by whitespace and </td>
    const closingDivMatch = afterTerms.match(/<\/div>\s*<\/td>/)

    if (!closingDivMatch) {
      console.log('   ❌ Could not find </div></td> pattern after terms')
      continue
    }

    const closingDivIndex = termsIndex + (afterTerms.indexOf(closingDivMatch[0]) || 0)
    const afterClosingDiv = template.body_template.slice(closingDivIndex)

    // Find the </tr> after </td>
    const closingTrMatch = afterClosingDiv.match(/<\/td>\s*<\/tr>/)

    if (!closingTrMatch) {
      console.log('   ❌ Could not find </td></tr> pattern')
      continue
    }

    // Calculate insertion point (after the </tr>)
    const insertPosition = closingDivIndex + (afterClosingDiv.indexOf(closingTrMatch[0]) || 0) + closingTrMatch[0].length

    // Insert {{offer_section}}
    const newBody =
      template.body_template.slice(0, insertPosition) +
      '\n                    {{offer_section}}' +
      template.body_template.slice(insertPosition)

    const { error } = await supabase
      .from('email_templates')
      .update({ body_template: newBody })
      .eq('id', template.id)

    if (error) {
      console.log(`   ❌ Error: ${error.message}`)
    } else {
      console.log('   ✅ Added {{offer_section}} after terms_conditions')
      console.log(`   New length: ${newBody.length}`)
    }
  }

  console.log('\n✨ Done!')
}

addOfferSection().catch(console.error)
