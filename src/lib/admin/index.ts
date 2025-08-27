// Client-safe admin exports (can be imported in React components)
export * from './admin-impersonation-client'

// Server-only exports - DO NOT import these in client components
// Use direct imports like: import { adminAuthService } from '@/lib/admin/admin-auth-service'
// export * from './admin-auth-service'  // Commented out to prevent client import
// export * from './admin-impersonation-service'  // Commented out to prevent client import 
