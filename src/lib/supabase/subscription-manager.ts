import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from './client'
import logger from '../logger/client'

const managerLogger = logger.child({ component: 'SubscriptionManager' })

type PostgresChangeHandler = (payload: RealtimePostgresChangesPayload<any>) => void

interface HandlerInfo {
  id: string
  handler: PostgresChangeHandler
}

interface SubscriptionKey {
  channelName: string
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  filter?: string
}

interface ChannelSubscription {
  channel: RealtimeChannel
  subscriptions: Map<string, HandlerInfo[]> // key is stringified options
  isSubscribed: boolean
  subscriptionPromise?: Promise<string>
}

interface SubscriptionOptions {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  filter?: string
}

/**
 * Singleton manager for Supabase realtime subscriptions
 * Prevents duplicate subscriptions and handles proper cleanup
 */
class SubscriptionManager {
  private static instance: SubscriptionManager
  private channels: Map<string, ChannelSubscription> = new Map()
  private supabase = createClient()

  private constructor() {
    managerLogger.info('SubscriptionManager initialized')
    
    // Expose to window for debugging in development
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).subscriptionManager = this
      
      // Log stats every 10 seconds in development
      setInterval(() => {
        const stats = this.getStats()
        if (stats.length > 0) {
          managerLogger.info('Active subscriptions', { 
            count: stats.length,
            channels: stats 
          })
        }
      }, 10000)
    }
  }

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager()
    }
    return SubscriptionManager.instance
  }

  private getOptionsKey(options: SubscriptionOptions): string {
    return JSON.stringify({
      event: options.event,
      schema: options.schema,
      table: options.table,
      filter: options.filter || ''
    })
  }

  /**
   * Subscribe to postgres changes on a channel
   * Handles deduplication and ensures subscribe() is only called once
   */
  async subscribeToPostgresChanges(
    channelName: string,
    options: SubscriptionOptions,
    handler: PostgresChangeHandler
  ): Promise<() => void> {
    managerLogger.debug('Subscribe request', { channelName, options })

    let subscription = this.channels.get(channelName)
    
    if (!subscription) {
      // Create new channel and subscription
      const channel = this.supabase.channel(channelName)
      
      subscription = {
        channel,
        subscriptions: new Map(),
        isSubscribed: false,
      }
      
      this.channels.set(channelName, subscription)
      managerLogger.info('Created new channel', { channelName })
    }

    const optionsKey = this.getOptionsKey(options)
    let handlers = subscription.subscriptions.get(optionsKey)
    
    // If this is the first handler for these options, set up the listener
    if (!handlers) {
      handlers = []
      subscription.subscriptions.set(optionsKey, handlers)
      
      // Add the postgres_changes listener with proper typing
      subscription.channel.on('postgres_changes' as any, options, (payload: RealtimePostgresChangesPayload<any>) => {
        const currentHandlers = subscription!.subscriptions.get(optionsKey)
        if (currentHandlers) {
          currentHandlers.forEach(({ handler }) => {
            try {
              handler(payload)
            } catch (error) {
              managerLogger.error('Handler error', { channelName, error })
            }
          })
        }
      })
      
      managerLogger.debug('Added postgres_changes listener', { channelName, optionsKey })
    }

    // Add the handler
    const handlerId = `${Date.now()}_${Math.random()}`
    handlers.push({ id: handlerId, handler })
    
    // Subscribe only if not already subscribed
    if (!subscription.isSubscribed && !subscription.subscriptionPromise) {
      subscription.subscriptionPromise = new Promise((resolve) => {
        subscription!.channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            subscription!.isSubscribed = true
            managerLogger.info('Channel subscribed', { channelName, status })
            resolve(status)
          } else if (status === 'CHANNEL_ERROR') {
            managerLogger.error('Channel subscription error', { channelName, status })
            resolve(status)
          } else if (status === 'TIMED_OUT') {
            managerLogger.error('Channel subscription timeout', { channelName, status })
            resolve(status)
          }
        })
      })
    }

    // Wait for subscription to complete
    if (subscription.subscriptionPromise) {
      await subscription.subscriptionPromise
    }

    // Return cleanup function
    return () => {
      this.unsubscribeHandler(channelName, optionsKey, handlerId)
    }
  }

  /**
   * Unsubscribe a specific handler
   */
  private unsubscribeHandler(channelName: string, optionsKey: string, handlerId: string): void {
    const subscription = this.channels.get(channelName)
    
    if (!subscription) {
      managerLogger.warn('Attempted to unsubscribe from non-existent channel', { channelName })
      return
    }

    const handlers = subscription.subscriptions.get(optionsKey)
    if (!handlers) {
      managerLogger.warn('No handlers found for options', { channelName, optionsKey })
      return
    }

    // Remove the specific handler
    const index = handlers.findIndex(h => h.id === handlerId)
    if (index !== -1) {
      handlers.splice(index, 1)
      managerLogger.debug('Removed handler', { channelName, optionsKey, handlerId })
    }

    // Clean up empty handler arrays
    if (handlers.length === 0) {
      subscription.subscriptions.delete(optionsKey)
      managerLogger.debug('Removed empty handler array', { channelName, optionsKey })
    }

    // Clean up if no more subscriptions
    if (subscription.subscriptions.size === 0) {
      subscription.channel.unsubscribe()
      this.channels.delete(channelName)
      managerLogger.info('Channel fully unsubscribed and removed', { channelName })
    }
  }

  /**
   * Get current channel stats for debugging
   */
  getStats() {
    const stats = Array.from(this.channels.entries()).map(([name, info]) => ({
      name,
      subscriptions: info.subscriptions.size,
      totalHandlers: Array.from(info.subscriptions.values()).reduce((sum, handlers) => sum + handlers.length, 0),
      isSubscribed: info.isSubscribed,
      status: (info.channel as any).state // Access internal state for debugging
    }))
    return stats
  }

  /**
   * Force cleanup all channels (for debugging)
   */
  cleanup() {
    managerLogger.warn('Force cleaning up all channels')
    this.channels.forEach((subscription, channelName) => {
      subscription.channel.unsubscribe()
      managerLogger.info('Force unsubscribed channel', { channelName })
    })
    this.channels.clear()
  }
}

export const subscriptionManager = SubscriptionManager.getInstance()