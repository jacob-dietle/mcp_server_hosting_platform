export interface MCPServerRecord {
  id: string;
  user_id: string;
  name: string;
  config: {
    transportType: 'sse' | 'streamable-http';
    url: string;
    // other config fields
  };
  created_at: string;
  updated_at: string;
} 
