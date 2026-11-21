/**
 * ProductMind AI — Feedback AI Execution Queue
 * Optimized for Groq free-tier rate limits (single concurrency, bounded delay,
 * no auto-retry loops on 429, and clean status lifecycle).
 */

import { feedbackService } from './feedbackService'

export const AI_STATUS = {
  AWAITING_ANALYSIS: 'Awaiting Analysis',
  PENDING: 'Pending',
  QUEUED: 'Queued',
  ANALYZING: 'Analyzing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  RATE_LIMITED: 'Rate Limited',
}

class FeedbackAIQueue {
  constructor() {
    this.queue = []
    this.isProcessing = false
    this.statusMap = new Map() // feedbackId -> status
    this.subscribers = new Set() // callback for status updates

    // Configurable Groq free-tier execution controls
    this.config = {
      concurrencyLimit: 1, // Single serial execution to avoid bursting free-tier TPM/RPM
      spacingDelayMs: 1200, // 1.2s delay between consecutive LLM invocations
      maxQueueSize: 25, // Bounded queue limit
    }
  }

  /**
   * Subscribe to queue status changes across items
   */
  subscribe(callback) {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  notify(feedbackId, status, data = null, error = null) {
    this.statusMap.set(feedbackId, status)
    for (const sub of this.subscribers) {
      try {
        sub({ feedbackId, status, data, error })
      } catch (err) {
        console.warn('AI Queue subscriber error:', err)
      }
    }
  }

  getStatus(feedbackId) {
    return this.statusMap.get(feedbackId) || AI_STATUS.AWAITING_ANALYSIS
  }

  /**
   * Enqueue a feedback item for real AI Feedback Intelligence Agent analysis
   */
  enqueue(feedbackId, options = {}) {
    if (!feedbackId) return

    // Prevent duplicate entries in active queue
    const alreadyQueued = this.queue.some(task => task.feedbackId === feedbackId)
    if (alreadyQueued) return

    if (this.queue.length >= this.config.maxQueueSize) {
      console.warn(`AI analysis queue reached maximum capacity of ${this.config.maxQueueSize}.`)
      this.notify(feedbackId, AI_STATUS.FAILED, null, new Error('Queue full'))
      return
    }

    const task = {
      feedbackId,
      forceReanalyze: Boolean(options.forceReanalyze),
      onSuccess: options.onSuccess,
      onError: options.onError,
    }

    this.queue.push(task)
    this.notify(feedbackId, AI_STATUS.QUEUED)

    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  /**
   * Manually retry an item (e.g. after rate limit or failure)
   */
  retry(feedbackId, options = {}) {
    return this.enqueue(feedbackId, { ...options, forceReanalyze: true })
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0) {
      const task = this.queue.shift()
      const { feedbackId, forceReanalyze, onSuccess, onError } = task

      this.notify(feedbackId, AI_STATUS.ANALYZING)

      try {
        const res = await feedbackService.analyzeFeedback(feedbackId, forceReanalyze)
        this.notify(feedbackId, AI_STATUS.COMPLETED, res)
        if (onSuccess) onSuccess(res)
      } catch (err) {
        const isRateLimit =
          err?.response?.status === 429 ||
          err?.status === 429 ||
          (err?.message && err.message.includes('429')) ||
          (err?.message && err.message.toLowerCase().includes('rate limit'))

        const finalStatus = isRateLimit ? AI_STATUS.RATE_LIMITED : AI_STATUS.FAILED
        this.notify(feedbackId, finalStatus, null, err)
        if (onError) onError(err, isRateLimit)
      }

      // Gentle pause to protect Groq free-tier rate limits between requests
      if (this.queue.length > 0 && this.config.spacingDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.config.spacingDelayMs))
      }
    }

    this.isProcessing = false
  }
}

export const feedbackAiQueue = new FeedbackAIQueue()
export default feedbackAiQueue
