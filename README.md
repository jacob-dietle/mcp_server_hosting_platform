# MCP Server Hosting Platform

A production-ready Next.js 14 application for deploying and managing Model Context Protocol (MCP) servers with enterprise-grade monitoring, security, and administration features.

## What is This?

This platform simplifies the deployment and management of MCP servers - the emerging standard for connecting AI models with external tools and data sources. Think of it as a hosting platform specifically designed for MCP servers, with built-in health monitoring, user management, and enterprise security features.

## Key Features

### 🚀 **One-Click MCP Server Deployment**
- Deploy any MCP server to Railway with a single click
- Automatic environment configuration and scaling
- Support for multiple MCP server types (filesystem, database, API, etc.)
- Custom domain support and SSL certificates

### 🏥 **Intelligent Health Monitoring**
- Real-time health checks with automatic recovery
- Multi-transport support (Server-Sent Events with HTTP fallback)
- Historical uptime metrics and performance tracking
- Smart retry logic and failure detection

### 🛡️ **Enterprise Security & Admin Tools**
- Row-level security (RLS) for multi-tenant isolation
- Admin dashboard with user impersonation capabilities
- Comprehensive audit logging for compliance
- Role-based access control with granular permissions

### 📊 **Real-Time Dashboard**
- Live deployment status updates via WebSocket connections
- Performance metrics and resource usage monitoring
- User activity tracking and analytics
- Trial system for user onboarding

## Tech Stack

**Modern Web Technologies:**
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **UI**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query v5) with Supabase real-time
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth with Server-Side Rendering support
- **Deployment**: Railway integration for MCP server hosting

**Enterprise Features:**
- Server-only code separation for security
- Comprehensive TypeScript contracts
- Centralized logging with request tracing
- Performance monitoring and error tracking

## Getting Started

### Prerequisites
- Node.js 18 or higher
- pnpm package manager
- Supabase account (free tier available)
- Railway account (for MCP server deployments)

### Quick Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd mcp-hosting-platform
   pnpm install
   ```

2. **Environment Configuration**
   Create a `.env.local` file:
   ```env
   # Supabase (Database & Auth)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Railway (MCP Server Deployment)
   RAILWAY_API_KEY=your_railway_api_key
   RAILWAY_WEBHOOK_SECRET=your_webhook_secret_for_status_updates

   # Optional: Admin Features
   ADMIN_EMAIL_WHITELIST=admin@yourcompany.com
   ```

3. **Database Setup**
   ```bash
   # Run Supabase migrations
   pnpm supabase db push
   
   # Start development server
   pnpm dev
   ```

4. **Access the Platform**
   Open [http://localhost:3000](http://localhost:3000) and create your first account.

## Architecture Overview

### Core Components

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   ├── deployments/   # MCP deployment management
│   │   ├── health/        # Health monitoring endpoints
│   │   ├── admin/         # Admin and impersonation APIs
│   │   └── trials/        # Trial management system
│   ├── dashboard/         # Main user interface
│   └── admin/             # Administrative interface
├── components/            # React components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── mcp/              # MCP-specific components
│   └── admin/            # Admin dashboard components
├── lib/                  # Core business logic
│   ├── deployment/       # Deployment orchestration
│   ├── railway-client.ts # Railway API integration
│   ├── supabase/         # Database client
│   └── admin/            # Admin services
└── hooks/                # Custom React hooks for data fetching
```

### Key Design Patterns

1. **Security-First Architecture**: All database access goes through Row Level Security (RLS) policies
2. **Server-Client Separation**: Strict separation using the `server-only` package
3. **Real-Time Updates**: Supabase subscriptions for live deployment status
4. **Type Safety**: Comprehensive TypeScript contracts for all API interactions
5. **Enterprise Logging**: Centralized logging with request tracing and performance metrics

## Understanding the Platform

### For Technical Teams

This codebase demonstrates several production-ready patterns:

- **Deployment Orchestration**: Shows how to integrate with external APIs (Railway) while maintaining reliability
- **Real-Time State Management**: Uses Supabase subscriptions with React Query for efficient state synchronization  
- **Enterprise Security**: Implements RLS, admin impersonation with audit trails, and secure secret management
- **Health Monitoring**: Intelligent retry logic with graceful degradation across transport types
- **Type Safety**: End-to-end TypeScript with runtime validation at API boundaries

### For Business Teams

The platform enables:

- **Rapid MCP Server Deployment**: Turn any MCP server into a hosted service in minutes
- **User Self-Service**: Trial system allows users to test MCP servers before committing
- **Enterprise Compliance**: Audit logs, user management, and security controls for business use
- **Operational Visibility**: Real-time monitoring prevents service interruptions
- **Scalable Architecture**: Multi-tenant design supports growth from prototype to production

## Database Schema

The platform uses a custom `auth_logic` schema with these core tables:

- **`deployments`** - MCP server deployment records with status tracking
- **`health_checks`** - Historical health monitoring data
- **`user_profiles`** - Extended user information beyond basic auth
- **`admin_users`** - Administrative role assignments
- **`trial_applications`** - User trial request management
- **`impersonation_sessions`** - Admin impersonation audit trail

All tables implement Row Level Security (RLS) for secure multi-tenancy.

## Deployment

### Development
```bash
pnpm dev          # Start development server with hot reload
pnpm type-check   # Run TypeScript validation
pnpm lint         # Code quality checks
pnpm test         # Run test suite
```

### Production
```bash
pnpm build        # Build optimized production bundle
pnpm start        # Start production server
```

The application can be deployed to any Node.js hosting platform (Vercel, Railway, AWS, etc.).

### Security Checklist

Before production deployment:
- [ ] Enable all Supabase RLS policies
- [ ] Configure admin email whitelist
- [ ] Set up monitoring and alerting
- [ ] Review audit log retention policies
- [ ] Secure all environment variables
- [ ] Enable HTTPS with proper certificates

## Contributing

We welcome contributions! The codebase follows these standards:

- **TypeScript**: Strict mode with comprehensive type coverage
- **Code Style**: ESLint + Prettier with Next.js configurations
- **Testing**: API integration tests and component testing
- **Security**: Security-focused code reviews required
- **Documentation**: All features must include documentation

## Support & Troubleshooting

### Common Issues

1. **Health Check Failures**: Verify MCP server is accessible and responding to HTTP requests
2. **Deployment Stuck**: Check Railway API credentials and project permissions
3. **Auth Issues**: Ensure Supabase configuration matches environment variables
4. **Performance Issues**: Review database query performance and connection pooling

### Getting Help

- Check server logs for detailed error messages with request IDs
- Review Supabase database logs for RLS policy issues
- Monitor Railway deployment logs for MCP server issues
- Use the admin dashboard to impersonate users for troubleshooting

## License

This project is source-available under the **Elastic License 2.0**. See LICENSE file for details.

**Key Points:**
- ✅ Free to use, modify, and distribute
- ✅ Perfect for internal company use and development
- ✅ Can be used for commercial purposes
- ❌ Cannot be offered as a competing hosted service
- ❌ Cannot circumvent or remove license functionality

This license ensures the codebase remains open for learning, modification, and internal use while protecting against direct commercialization as a hosted service.

---

**Built for the MCP ecosystem** - Empowering developers to deploy and manage Model Context Protocol servers with enterprise-grade reliability and security.