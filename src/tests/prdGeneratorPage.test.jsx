import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PRDGeneratorPage } from '../pages/PRDGeneratorPage'
import { prdService } from '../services/api/prdService'
import { useWorkspace } from '../context/WorkspaceContext'
import { useApp } from '../context/AppContext'

vi.mock('../services/api/prdService', () => ({
  prdService: {
    listProductPlans: vi.fn(),
    getProductPlan: vi.fn(),
    generateProductPlan: vi.fn(),
    generateUserStories: vi.fn(),
    updatePRDSections: vi.fn(),
    regenerateSection: vi.fn(),
    reviewProductPlan: vi.fn(),
  },
  normalizePlanSections: vi.fn((s) => s || {}),
}))

vi.mock('../context/WorkspaceContext', () => ({
  useWorkspace: vi.fn(),
}))

vi.mock('../context/AppContext', () => ({
  useApp: vi.fn(),
}))

describe('PRDGeneratorPage — Phase 5.3 Atlas Integration & Human Review', () => {
  const addToast = vi.fn()
  const mockFeatures = [
    { id: 'feat-1', name: 'Automated CSV Export', score: 85.5 },
    { id: 'feat-2', name: 'Dark Mode Theme', score: 72.0 },
  ]

  const mockPlan1 = {
    id: 'plan-1',
    planning_id: 'plan-1',
    featureId: 'feat-1',
    title: 'Automated CSV Export Engine',
    version: '1.0.0',
    status: 'draft',
    author: 'Lead PM',
    updatedAt: '2026-11-14T10:00:00Z',
    sections: {
      overview: 'Initial overview description',
      problemStatement: 'Manual copy pasting takes 2 hours',
      targetUsers: 'Financial Analysts',
      customerPainPoints: 'Slow export latency',
      proposedSolution: 'Async CSV streaming',
      goalsAndSuccessMetrics: 'Adoption 30%',
      functionalRequirements: 'Stream CSV 100k rows',
      nonFunctionalRequirements: 'Latency under 2s',
      userStories: 'As an analyst, I want CSV export',
      acceptanceCriteria: 'Given data table, When click export, Then downloads',
      dependenciesAndConstraints: 'FastAPI, MongoDB',
      risksAndMitigations: 'Worker queue mitigates memory spikes',
      releasePlan: 'Phase 1: Foundation',
    },
  }

  const mockPlan2 = {
    id: 'plan-2',
    planning_id: 'plan-2',
    featureId: 'feat-2',
    title: 'Dark Mode Architecture Spec',
    version: '1.0.0',
    status: 'pending_review',
    author: 'Design Lead',
    updatedAt: '2026-11-14T11:00:00Z',
    sections: {
      overview: 'Enterprise dark mode design token spec',
      problemStatement: 'Night shift users experience eye strain',
      userStories: 'As a nocturnal user, I want a dark theme',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    useApp.mockReturnValue({
      features: mockFeatures,
      feedback: [],
      addToast,
    })
    useWorkspace.mockReturnValue({
      currentWorkspace: { id: 'ws-1', name: 'Apex Workspace' },
    })
  })

  // 1. PRD list loading from API
  it('loads and displays PRD list from Atlas API', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan1, mockPlan2])

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(prdService.listProductPlans).toHaveBeenCalledWith('ws-1')
      expect(screen.getAllByText('Automated CSV Export Engine').length).toBeGreaterThan(0)
      expect(screen.getByText('Dark Mode Architecture Spec')).toBeInTheDocument()
    })
  })

  // 2. Workspace switching
  it('refetches and updates PRDs when active workspace changes', async () => {
    prdService.listProductPlans.mockResolvedValueOnce([mockPlan1])

    const { rerender } = render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Automated CSV Export Engine').length).toBeGreaterThan(0)
    })

    // Switch workspace to ws-2
    useWorkspace.mockReturnValue({
      currentWorkspace: { id: 'ws-2', name: 'Secondary Workspace' },
    })
    const ws2Plan = { ...mockPlan2, id: 'plan-ws2', title: 'Workspace 2 Exclusive PRD' }
    prdService.listProductPlans.mockResolvedValueOnce([ws2Plan])

    rerender(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(prdService.listProductPlans).toHaveBeenCalledWith('ws-2')
      expect(screen.getAllByText('Workspace 2 Exclusive PRD').length).toBeGreaterThan(0)
      expect(screen.queryByText('Automated CSV Export Engine')).not.toBeInTheDocument()
    })
  })

  // 3. PRD detail loading
  it('loads full PRD details when selecting another PRD card', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan1, mockPlan2])
    prdService.getProductPlan.mockResolvedValue({
      ...mockPlan2,
      sections: {
        ...mockPlan2.sections,
        overview: 'Full detail overview for Dark Mode Spec',
      },
    })

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Dark Mode Architecture Spec')).toBeInTheDocument()
    })

    // Click on the second PRD
    fireEvent.click(screen.getByText('Dark Mode Architecture Spec'))

    await waitFor(() => {
      expect(prdService.getProductPlan).toHaveBeenCalledWith('plan-2', 'ws-1')
      expect(screen.getByText('Full detail overview for Dark Mode Spec')).toBeInTheDocument()
    })
  })

  // 4. Section editing and saving
  it('enables editing, persists revised sections to Atlas, and updates version', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan1])
    prdService.updatePRDSections.mockResolvedValue({
      ...mockPlan1,
      version: '1.0.1',
      sections: {
        ...mockPlan1.sections,
        overview: 'Updated overview saved to MongoDB Atlas',
      },
    })

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Initial overview description')).toBeInTheDocument()
    })

    // Click "Edit Sections"
    fireEvent.click(screen.getByRole('button', { name: /Edit Sections/i }))

    // Locate the textarea for overview
    const textareas = screen.getAllByRole('textbox')
    expect(textareas.length).toBeGreaterThan(0)
    fireEvent.change(textareas[0], { target: { value: 'Updated overview saved to MongoDB Atlas' } })

    // Click "Save Revisions"
    fireEvent.click(screen.getByRole('button', { name: /Save Revisions/i }))

    await waitFor(() => {
      expect(prdService.updatePRDSections).toHaveBeenCalledWith('plan-1', expect.objectContaining({
        expectedVersion: '1.0.0',
        versionBump: 'patch',
      }))
      expect(addToast).toHaveBeenCalledWith(expect.stringContaining('v1.0.1'), 'success')
      expect(screen.getByText('Updated overview saved to MongoDB Atlas')).toBeInTheDocument()
    })
  })

  // 5. Version conflict handling (HTTP 409 Conflict)
  it('handles HTTP 409 Conflict without discarding user edits', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan1])
    const conflictErr = new Error('Concurrent modification detected')
    conflictErr.status = 409
    prdService.updatePRDSections.mockRejectedValue(conflictErr)

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Initial overview description')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Edit Sections/i }))
    const textareas = screen.getAllByRole('textbox')
    fireEvent.change(textareas[0], { target: { value: 'My conflicting edits' } })

    fireEvent.click(screen.getByRole('button', { name: /Save Revisions/i }))

    await waitFor(() => {
      expect(screen.getByText(/Optimistic Concurrency Conflict/i)).toBeInTheDocument()
      expect(screen.getByText(/Reload from Atlas/i)).toBeInTheDocument()
      // Ensure the user's edits are NOT lost
      expect(textareas[0].value).toBe('My conflicting edits')
    })
  })

  // 6. Section regeneration
  it('opens modal, triggers single-section regeneration, and updates only that section', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan1])
    prdService.regenerateSection.mockResolvedValue({
      ...mockPlan1,
      sections: {
        ...mockPlan1.sections,
        userStories: '### US-999: AI-Regenerated Stories with Bounded Tokens',
      },
    })

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/9\. User Stories/i)).toBeInTheDocument()
    })

    // Find all regenerate buttons
    const regenButtons = screen.getAllByRole('button', { name: /Regenerate/i })
    expect(regenButtons.length).toBeGreaterThan(0)
    // Click on User Stories regenerate button (index 8)
    fireEvent.click(regenButtons[8])

    // Regeneration modal appears
    await waitFor(() => {
      expect(screen.getByText(/Regenerate 9\. User Stories/i)).toBeInTheDocument()
    })

    // Enter custom instructions
    const instructionInput = screen.getByPlaceholderText(/Focus on enterprise RBAC/i)
    fireEvent.change(instructionInput, { target: { value: 'Emphasize GDPR compliance' } })

    // Click confirm "Regenerate Section"
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Section' }))

    await waitFor(() => {
      expect(prdService.regenerateSection).toHaveBeenCalledWith('plan-1', expect.objectContaining({
        sectionKey: 'userStories',
        customInstructions: 'Emphasize GDPR compliance',
      }))
      expect(screen.getAllByText(/AI-Regenerated Stories with Bounded Tokens/i).length).toBeGreaterThan(0)
      // Other sections remain intact
      expect(screen.getByText('Initial overview description')).toBeInTheDocument()
    })
  })

  // 7. Submit for review
  it('submits a draft PRD for human review and updates status to pending_review', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan1]) // status: 'draft'
    prdService.reviewProductPlan.mockResolvedValue({
      ...mockPlan1,
      status: 'pending_review',
    })

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Submit for Review/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit for Review/i }))

    await waitFor(() => {
      expect(prdService.reviewProductPlan).toHaveBeenCalledWith('plan-1', 'pending_review')
      expect(addToast).toHaveBeenCalledWith(expect.stringContaining('submitted for PM human review'), 'success')
    })
  })

  // 8. Approve PRD
  it('shows confirmation modal, approves PRD, and locks editing and regeneration', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan2]) // status: 'pending_review'
    prdService.reviewProductPlan.mockResolvedValue({
      ...mockPlan2,
      status: 'approved',
    })

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Approve Plan/i })).toBeInTheDocument()
    })

    // Click "Approve Plan"
    fireEvent.click(screen.getByRole('button', { name: /Approve Plan/i }))

    // Confirmation modal opens
    await waitFor(() => {
      expect(screen.getByText(/Confirm Plan Approval/i)).toBeInTheDocument()
    })

    // Click confirm approve
    const modalButtons = screen.getAllByRole('button', { name: /Approve Plan/i })
    fireEvent.click(modalButtons[modalButtons.length - 1])

    await waitFor(() => {
      expect(prdService.reviewProductPlan).toHaveBeenCalledWith('plan-2', 'approved')
      expect(addToast).toHaveBeenCalledWith(expect.stringContaining('modifications are now protected'), 'success')
      // Edit button should be disabled
      const editButton = screen.getByRole('button', { name: /Edit Sections/i })
      expect(editButton).toBeDisabled()
    })
  })

  // 9. Reject PRD with review notes
  it('requests changes with review notes and updates status to changes requested', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan2]) // status: 'pending_review'
    prdService.reviewProductPlan.mockResolvedValue({
      ...mockPlan2,
      status: 'rejected',
      reviewNotes: 'Requires benchmark data before approval',
      reviewedAt: '2026-11-14T12:00:00Z',
    })

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Request Changes/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Request Changes/i }))

    await waitFor(() => {
      expect(screen.getByText(/Request Changes on PRD/i)).toBeInTheDocument()
    })

    // Enter review notes
    const notesInput = screen.getByPlaceholderText(/Non-functional latency threshold/i)
    fireEvent.change(notesInput, { target: { value: 'Requires benchmark data before approval' } })

    fireEvent.click(screen.getByRole('button', { name: /Submit Changes Requested/i }))

    await waitFor(() => {
      expect(prdService.reviewProductPlan).toHaveBeenCalledWith('plan-2', 'rejected', 'Requires benchmark data before approval')
      expect(screen.getByText('Requires benchmark data before approval')).toBeInTheDocument()
    })
  })

  // 10. API failure handling
  it('renders error state with retry button when API list call fails', async () => {
    prdService.listProductPlans.mockRejectedValueOnce(new Error('Atlas connection failed'))

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Atlas connection failed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
    })

    // Clicking retry refetches
    prdService.listProductPlans.mockResolvedValueOnce([mockPlan1])
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Automated CSV Export Engine').length).toBeGreaterThan(0)
    })
  })

  // 11. Empty and loading states
  it('renders loading indicator while loading, and empty state when 0 plans exist', async () => {
    prdService.listProductPlans.mockResolvedValueOnce([])

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No PRDs Found')).toBeInTheDocument()
      expect(screen.getByText('No PRD Selected')).toBeInTheDocument()
    })
  })

  // 12. No localStorage fallback on API failure
  it('does NOT fall back to localStorage when updatePRDSections fails', async () => {
    prdService.listProductPlans.mockResolvedValue([mockPlan1])
    prdService.updatePRDSections.mockRejectedValue(new Error('Network error: server 500'))

    render(
      <MemoryRouter>
        <PRDGeneratorPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Initial overview description')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Edit Sections/i }))
    const textareas = screen.getAllByRole('textbox')
    fireEvent.change(textareas[0], { target: { value: 'Attempted edit' } })
    fireEvent.click(screen.getByRole('button', { name: /Save Revisions/i }))

    await waitFor(() => {
      expect(screen.getByText(/Network error: server 500/i)).toBeInTheDocument()
      expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Network error: server 500'), 'error')
      // Edit mode is still open and unconfirmed
      expect(screen.getByRole('button', { name: /Save Revisions/i })).toBeInTheDocument()
    })
  })
})
