import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CopilotPage } from '../pages/CopilotPage'
import { MarkdownRenderer, renderInline } from '../components/common/MarkdownRenderer'
import { copilotService } from '../services/api/copilotService'
import { useWorkspace } from '../context/WorkspaceContext'
import { useApp } from '../context/AppContext'

vi.mock('../services/api/copilotService', () => ({
  copilotService: {
    getConversations: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    sendMessage: vi.fn(),
    archiveConversation: vi.fn(),
  },
}))

vi.mock('../context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(),
}))

vi.mock('../context/AppContext', () => ({
  useApp: vi.fn(),
}))

describe('Module 9 Targeted Defect Verification', () => {
  const addToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    useApp.mockReturnValue({ addToast })
    useWorkspace.mockReturnValue({
      currentWorkspaceId: 'ws-apex',
      currentWorkspace: { id: 'ws-apex', name: 'Apex Workspace' },
    })
  })

  describe('1. Immediate User Message Rendering & Lifecycle', () => {
    it('immediately renders user message and loading indicator before API response finishes', async () => {
      copilotService.getConversations.mockResolvedValue({ conversations: [], total: 0 })

      let resolveSendMessage
      const sendMessagePromise = new Promise((resolve) => {
        resolveSendMessage = resolve
      })
      copilotService.sendMessage.mockReturnValue(sendMessagePromise)

      render(
        <MemoryRouter>
          <CopilotPage />
        </MemoryRouter>
      )

      await waitFor(() => expect(copilotService.getConversations).toHaveBeenCalled())

      const input = screen.getByPlaceholderText(/Ask anything about feedback/i)
      fireEvent.change(input, { target: { value: 'What features are high priority?' } })
      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      // Question MUST appear immediately in the message stream while API call is still pending
      expect(screen.getByText('What features are high priority?')).toBeInTheDocument()
      // Loading indicator must be present
      expect(screen.getByText(/Analyzing workspace data & synthesizing response.../i)).toBeInTheDocument()
      // Input text should be cleared
      expect(input.value).toBe('')

      // Now resolve the backend call
      resolveSendMessage({
        conversation: { id: 'c-1', title: 'Feature Prioritization', lastMessageAt: new Date().toISOString() },
        userMessage: { id: 'msg-u1', role: 'user', content: 'What features are high priority?', status: 'completed' },
        assistantMessage: {
          id: 'msg-a1',
          role: 'assistant',
          content: '**Direct Answer:** CSV Export is our highest priority item.',
          status: 'completed',
          evidence: [],
        },
      })

      // After resolution, assistant response appears, loading indicator disappears, and no duplicate user message exists
      await waitFor(() => expect(screen.getByText(/CSV Export is our highest priority item/i)).toBeInTheDocument())
      expect(screen.queryByText(/Analyzing workspace data & synthesizing response.../i)).not.toBeInTheDocument()
      const userQuestions = screen.getAllByText('What features are high priority?')
      expect(userQuestions.length).toBe(1)
    })

    it('preserves user question in message stream when API call fails', async () => {
      copilotService.getConversations.mockResolvedValue({ conversations: [], total: 0 })
      copilotService.sendMessage.mockRejectedValue(new Error('Network gateway timeout'))

      render(
        <MemoryRouter>
          <CopilotPage />
        </MemoryRouter>
      )

      await waitFor(() => expect(copilotService.getConversations).toHaveBeenCalled())

      const input = screen.getByPlaceholderText(/Ask anything about feedback/i)
      fireEvent.change(input, { target: { value: 'Why did conversion drop?' } })
      fireEvent.click(screen.getByRole('button', { name: /send/i }))

      // User question must remain in the stream even after failure
      await waitFor(() => expect(screen.getByText('Network gateway timeout')).toBeInTheDocument())
      expect(screen.getByText('Why did conversion drop?')).toBeInTheDocument()
      expect(screen.getByText('Message not delivered')).toBeInTheDocument()
    })
  })

  describe('2. MarkdownRenderer Formatting & Readability', () => {
    it('renders structured semantic sections (Direct Answer, Key Findings, Limitations, Next Action)', () => {
      const markdown = `**Direct Answer:**
CSV Export has the highest customer demand with 14 requests.

**Key Findings:**
* **CSV Export**: 14 requests, High priority (Score: 78.5)
* **Mobile Support**: 8 requests, Medium priority

**Limitations:**
Usage impact telemetry is missing for this feature.

**Suggested Next Action:**
Review the scenario in Module 6 Prioritization.`

      render(<MarkdownRenderer content={markdown} />)

      // Section badges
      expect(screen.getByText('Direct Answer')).toBeInTheDocument()
      expect(screen.getByText('Key Findings')).toBeInTheDocument()
      expect(screen.getByText('Limitations')).toBeInTheDocument()
      expect(screen.getByText('Suggested Next Action')).toBeInTheDocument()

      // Section body texts
      expect(screen.getByText(/CSV Export has the highest customer demand/i)).toBeInTheDocument()
      expect(screen.getByText(/Usage impact telemetry is missing/i)).toBeInTheDocument()
      expect(screen.getByText(/Review the scenario in Module 6/i)).toBeInTheDocument()

      // Bold elements
      expect(screen.getByText('CSV Export')).toBeInTheDocument()
      expect(screen.getByText('Mobile Support')).toBeInTheDocument()
    })

    it('renders generic markdown without semantic headings (headings, lists, inline code, code blocks)', () => {
      const markdown = `# Architecture Overview
This is a standard paragraph with \`inline_code\` and **bold text** and *italic text*.

### Data Breakdown
1. First point with [docs](https://example.com/docs)
2. Second point

\`\`\`json
{"status": "ok"}
\`\`\``

      const { container } = render(<MarkdownRenderer content={markdown} />)

      // Heading
      expect(screen.getByText('Architecture Overview')).toBeInTheDocument()
      expect(screen.getByText('Data Breakdown')).toBeInTheDocument()

      // Inline code
      expect(screen.getByText('inline_code')).toBeInTheDocument()

      // Bold & Italic
      expect(screen.getByText('bold text')).toBeInTheDocument()
      expect(screen.getByText('italic text')).toBeInTheDocument()

      // Safe Link
      const link = screen.getByRole('link', { name: 'docs' })
      expect(link).toHaveAttribute('href', 'https://example.com/docs')

      // Numbered list items
      expect(screen.getByText(/First point with/i)).toBeInTheDocument()
      expect(screen.getByText(/Second point/i)).toBeInTheDocument()

      // Code block
      expect(container.querySelector('pre')).toHaveTextContent('{"status": "ok"}')
    })

    it('sanitizes unsafe javascript: links to prevent XSS', () => {
      const markdown = `Click [here](javascript:alert(1)) to view.`
      render(<MarkdownRenderer content={markdown} />)

      const link = screen.getByRole('link', { name: 'here' })
      expect(link).toHaveAttribute('href', '#')
    })
  })
})
