'use client'

import { useAgentContext } from '@/contexts/agent-context'
import { useAgentState } from '@/hooks/agents/use-agent-state'
import { AgentDetailsTrigger, useAgentDetails } from '@/components/ui/agent-details'

export function ChatHeader() {
  const { agentId } = useAgentContext()
  const { data: agent, isLoading } = useAgentState(agentId)
  const { isOpen } = useAgentDetails()

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">
          {agent?.name || 'Agent Chat'}
        </h1>
        {agent?.description && (
          <span className="text-sm text-muted-foreground">
            {agent.description}
          </span>
        )}
      </div>
      <AgentDetailsTrigger isLoading={isLoading} />
    </div>
  )
}