"use client"

export interface ConversationItem {
  question: string;
  answer: {
    text: string;
    items: string[];
    footer?: string;
    citations?: { [key: string]: string }; // Optional citations
  };
}

// Define our paired questions and answers
export const CONVERSATIONS: ConversationItem[] = [
  {
    question: "Who are the key VCs actively investing in quantum computing hardware right now?",
    answer: {
      text: "Based on my analysis of recent funding data and the deeptech directory, here are the top VCs active in quantum computing hardware:",
      items: [
        "<strong>Quantum Capital Partners</strong> - Led by Schrodinger and Bors, led Series A for QubitTech ($12M)<sup>(1)</sup> and seed round for QuantumWave ($4M)<sup>(2)</sup>",
        "<strong>Deeptech Capital Group</strong> - Invested in 3 quantum hardware startups in the last 18 months<sup>(3)</sup>",
        "<strong>InGen Ventures</strong> - Founded by <a href=\"https://en.wikipedia.org/wiki/John_Hammond_(character)\" target=\"_blank\">John Hammond</a>, recently raised a $150M fund specifically for quantum technologies<sup>(4)</sup>"
      ],
      footer: "You are connected to two partners at Quantum Capital Partners <a href=\"https://en.wikipedia.org/wiki/Erwin_Schr%C3%B6dinger\" target=\"_blank\">(Erwin Schrodinger</a> and <a href=\"https://en.wikipedia.org/wiki/Niels_Bors\" target=\"_blank\"> Niels Bors)</a> through your network<sup>(5)</sup>. Would you like me to identify a warm intro path for these firms?",
      citations: {
        "1": "QuantumTech Funding Database, 2025",
        "2": "Series A Funding Announcement, Tech Crunch, January 2025",
        "3": "Deeptech Capital Group Portfolio Analysis, Speed to Insight, 2024",
        "4": "Venture Capital Journal, Fund Announcement, October 2024",
        "5": "Network Analysis via LinkedIn and Conference Attendance, 2023-2025"
      }
    }
  },
  {
    question: "Map the competitive landscape for carbon capture technologies",
    answer: {
      text: "I've identified 37 companies<sup>(1)</sup> in the carbon capture space. Here's a breakdown by technology approach:",
      items: [
        "<strong>Direct Air Capture (DAC)</strong> - 14 companies including Carbon Engineering<sup>(2)</sup> and Climeworks<sup>(3)</sup>",
        "<strong>Biological Capture</strong> - 9 companies using algae and microorganisms<sup>(4)</sup>",
        "<strong>Mineralization</strong> - 8 companies focused on carbon sequestration in minerals<sup>(5)</sup>"
      ],
      footer: "Several companies in this space have secured significant funding in the last 6 months<sup>(6)</sup>. Would you like details on specific technology approaches relative to your investment thesis?",
      citations: {
        "1": "Climate Tech Database, Speed to Insight Proprietary Research, 2025",
        "2": "Carbon Engineering Company Profile, S2I Analysis, March 2025",
        "3": "Climeworks Funding History, PitchBook Data, 2024",
        "4": "Biological Carbon Capture Market Report, McKinsey, 2024",
        "5": "Mineralization Technology Patent Analysis, S2I Research, 2024",
        "6": "Climate Tech Funding Dashboard, Q1 2025"
      }
    }
  },
  {
    question: "What partnerships exist between aerospace corporates and deeptech startups?",
    answer: {
      text: "I've analyzed recent partnership data across the aerospace sector<sup>(1)</sup> and found these significant collaborations:",
      items: [
        "<strong>Boeing + QuantumSense</strong> - Joint development of quantum navigation systems for next-gen aircraft<sup>(2)</sup>",
        "<strong>Airbus + NanoMaterials</strong> - Strategic investment in advanced composites for lightweight structures<sup>(3)</sup>",
        "<strong>SpaceX + FusionTech</strong> - Testing novel propulsion technologies for Mars missions<sup>(4)</sup>"
      ],
      footer: "The aerospace corporate-startup partnership landscape has grown 43% YoY<sup>(5)</sup>. Would you like me to filter for specific technology areas?",
      citations: {
        "1": "Aerospace Partnership Database, S2I Research, 2025",
        "2": "Boeing Press Release, Q1 2024",
        "3": "Airbus Ventures Investment Announcement, Dec 2023",
        "4": "Space Industry Insider Report, Proprietary Source, 2024",
        "5": "Aerospace Technology Partnership Growth Analysis, S2I, Jan-Mar 2025"
      }
    }
  },
  {
    question: "Identify potential customers for advanced battery technology in industrial applications",
    answer: {
      text: "Based on market analysis and technology requirements, here are the top potential industrial customers for advanced battery tech:",
      items: [
        "<strong>Grid-Scale Storage Providers</strong> - 8 companies actively seeking long-duration storage solutions",
        "<strong>Heavy Equipment Manufacturers</strong> - 5 companies with electrification initiatives for mining/construction",
        "<strong>Industrial Robotics</strong> - 12 companies requiring high-density power for next-gen autonomous systems"
      ],
      footer: "I've identified 3 battery tech procurement directors in your network. Would you like their contact information?"
    }
  },
]; 
