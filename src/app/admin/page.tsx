// Force dynamic rendering for admin pages that require authentication
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import nextDynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Dynamically import the admin dashboard to prevent static generation
const DynamicAdminDashboard = nextDynamic(
  () => import('@/components/admin/AdminDashboard'),
  {
    loading: () => (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600 font-mono">LOADING ADMIN DASHBOARD...</p>
        </div>
      </div>
    ),
    ssr: false // This ensures no server-side rendering during build
  }
  )

export default function AdminPage() {
  return <DynamicAdminDashboard />
}
