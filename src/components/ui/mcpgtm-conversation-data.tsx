"use client"

export interface MCPGTMConversationItem {
  command: string;
  response: string;
  processingTime?: string;
}

// Define MCPGTM command/response pairs
export const MCPGTM_CONVERSATIONS: MCPGTMConversationItem[] = [
  {
    command: "Show me all underperforming campaigns across all clients",
    response: "Analyzing 47 active campaigns across 12 clients...\n\n✓ Found 8 underperforming campaigns:\n  • Client A: Facebook Lead Gen (-32% below target)\n  • Client B: Google Search Campaign 3 (-18% CTR drop)\n  • Client C: LinkedIn ABM Initiative (-45% engagement)\n  • Client D: Email Sequence 'Q1 Promo' (2.3% open rate)\n\n→ Instant analysis across your entire book",
    processingTime: "1.2s"
  },
  {
    command: "Apply our pharma playbook to three new healthcare clients",
    response: "Deploying Pharma GTM Playbook v2.4...\n\n✓ Created campaigns for:\n  • MedTech Solutions Inc.\n  • HealthFirst Partners\n  • BioInnovate Labs\n\n✓ Deployed:\n  • 12 email sequences (regulatory-compliant)\n  • 8 LinkedIn campaigns with HCP targeting\n  • 4 webinar funnels with CME tracking\n  • Custom analytics dashboards\n\n→ Complete campaign infrastructure deployed",
    processingTime: "3.7s"
  },
  {
    command: "Generate performance insights for our QBR tomorrow",
    response: "Generating Q4 2024 Performance Report...\n\n✓ Key Insights:\n  • Overall portfolio: +27% YoY growth\n  • Top performer: Client E (+142% pipeline growth)\n  • Cost efficiency: -18% CAC across all accounts\n  • Channel mix: LinkedIn now drives 43% of qualified leads\n\n✓ Created:\n  • Executive summary (2 pages)\n  • Client-by-client breakdown\n  • Predictive Q1 2025 forecasts\n  • Recommended optimizations\n\n→ Custom reports using your methodology",
    processingTime: "2.1s"
  }
]; 
