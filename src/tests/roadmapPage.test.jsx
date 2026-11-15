import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RoadmapPage } from '../pages/RoadmapPage'
import { roadmapService } from '../services/api/roadmapService'
import { useApp } from '../context/AppContext'

vi.mock('../services/api/roadmapService', () => ({
  roadmapService: {
    listRoadmaps: vi.fn(),
    getRoadmap: vi.fn(),
    createRoadmap: vi.fn(),
    updateRoadmap: vi.fn(),
    archiveRoadmap: vi.fn(),
    listRoadmapItems: vi.fn(),
    getRoadmapItem: vi.fn(),
    createRoadmapItem: vi.fn(),
    updateRoadmapItem: vi.fn(),
    deleteRoadmapItem: vi.fn(),
    getCandidates: vi.fn(),
    promoteApprovedPRD: vi.fn(),
  },
}))

vi.mock('../context/AppContext', () => ({
  useApp: vi.fn(),
}))

describe('RoadmapPage — Phase 6.4 Interactive Visualization & Atlas Integration', () => {
  const addToast = vi.fn()
  const mockWorkspace = { id: 'ws-101', name: 'ProductMind Core' }

  const sampleRoadmap = {
    id: 'rm-001',
    workspaceId: 'ws-101',
    title: '2026 Core Delivery Roadmap',
    description: 'Quarterly strategic execution plan',
    roadmapType: 'Product',
    timeHorizon: 'Quarterly',
    status: 'Active',
    isDefault: true,
    version: '1.0.0',
    itemCount: 2,
  }

  const sampleItems = [
    {
      id: 'item-1',
      workspaceId: 'ws-101',
      roadmapId: 'rm-001',
      title: 'Kafka Webhook Pipeline',
      description: 'Zero-loss webhook dispatch',
      status: 'In Progress',
      priority: 'High',
      priorityScore: 92.0,
      isCommitted: true,
      owner: 'Lead PM',
      startDate: '2026-10-01',
      targetDate: '2026-11-15',
      milestone: 'Phase 1',
      progress: 50,
      notes: 'Ingress verified',
      version: '1.0.0',
    },
    {
      id: 'item-2',
      workspaceId: 'ws-101',
      roadmapId: 'rm-001',
      title: 'PostgreSQL Merkle Audit Log',
      description: 'Immutable ledger of transactions',
      status: 'Planned',
      priority: 'Urgent',
      priorityScore: 96.0,
      isCommitted: true,
      owner: 'Lead PM',
      startDate: '2026-11-16',
      targetDate: '2026-12-31',
      milestone: 'Phase 2',
      progress: 0,
      notes: 'Pending cryptographic schema signoff',
      version: '1.0.0',
    },
  ]

  const sampleCandidates = [
    {
      featureGroupId: 'fg-1',
      title: 'High-Volume Webhook Gateway',
      description: 'Cluster ingress',
      feedbackCount: 52,
      priorityScore: 94.0,
      priorityLevel: 'Urgent',
      prdId: 'prd-101',
      prdTitle: 'Webhook Gateway PRD',
      prdStatus: 'Approved',
      prdVersion: '1.0.0',
      isApprovedForRoadmap: true,
      roadmapRecommendations: [{ phase: 'Phase 1' }, { phase: 'Phase 2' }],
      existingRoadmapItemIds: [],
      isFullyCommitted: false,
    },
    {
      featureGroupId: 'fg-2',
      title: 'Dark Mode Settings',
      description: 'CSS variables migration',
      feedbackCount: 10,
      priorityScore: 65.0,
      priorityLevel: 'Low',
      prdId: 'prd-102',
      prdTitle: 'Dark Mode PRD',
      prdStatus: 'Draft',
      prdVersion: '0.1.0',
      isApprovedForRoadmap: false,
      roadmapRecommendations: [],
      existingRoadmapItemIds: [],
      isFullyCommitted: false,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useApp.mockReturnValue({
      activeWorkspace: mockWorkspace,
      currentWorkspace: mockWorkspace,
      features: [{ id: 'feat-1', name: 'Webhook Ingress' }],
      addToast,
    })

    roadmapService.listRoadmaps.mockResolvedValue({ total: 1, items: [sampleRoadmap] })
    roadmapService.listRoadmapItems.mockResolvedValue({ total: 2, items: sampleItems })
    roadmapService.getCandidates.mockResolvedValue({ total: 2, items: sampleCandidates })
  })

  it('loads and renders active roadmap and deliverables from Atlas', async () => {
    render(
      <MemoryRouter>
        <RoadmapPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(roadmapService.listRoadmaps).toHaveBeenCalledWith('ws-101')
      expect(roadmapService.listRoadmapItems).toHaveBeenCalledWith('ws-101', {
        roadmapId: 'rm-001',
      })
    })

    expect(screen.getByText('Product Delivery Roadmap')).toBeInTheDocument()
    expect(screen.getByText('Kafka Webhook Pipeline')).toBeInTheDocument()
    expect(screen.getByText('PostgreSQL Merkle Audit Log')).toBeInTheDocument()
  })

  it('switches between Timeline, Kanban, and List view modes', async () => {
    render(
      <MemoryRouter>
        <RoadmapPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Kafka Webhook Pipeline')).toBeInTheDocument()
    })

    // Click Kanban view
    const kanbanBtn = screen.getByTitle('Kanban Board View')
    fireEvent.click(kanbanBtn)
    expect(screen.getByText('Planned')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()

    // Click List view
    const listBtn = screen.getByTitle('List View')
    fireEvent.click(listBtn)
    expect(screen.getAllByText('Edit').length).toBeGreaterThan(0)
  })

  it('opens Promote Approved PRD modal and commits approved PRD to roadmap', async () => {
    roadmapService.promoteApprovedPRD.mockResolvedValue({
      success: true,
      promotedCount: 2,
      createdItemIds: ['i-3', 'i-4'],
      message: 'Successfully committed 2 items from approved PRD.',
    })

    render(
      <MemoryRouter>
        <RoadmapPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Promote Approved PRD')).toBeInTheDocument()
    })

    // Click Promote button
    const promoteBtn = screen.getByText('Promote Approved PRD')
    fireEvent.click(promoteBtn)

    await waitFor(() => {
      expect(screen.getByText('Webhook Gateway PRD')).toBeInTheDocument()
      expect(screen.getByText('Dark Mode PRD')).toBeInTheDocument()
    })

    // Verified: Approved PRD has Commit to Roadmap button
    const commitBtn = screen.getByText('Commit to Roadmap')
    expect(commitBtn).toBeInTheDocument()

    // Non-approved PRD has Approval Required lock badge
    expect(screen.getByText('Approval Required')).toBeInTheDocument()

    // Click Commit to Roadmap
    fireEvent.click(commitBtn)

    await waitFor(() => {
      expect(roadmapService.promoteApprovedPRD).toHaveBeenCalledWith('ws-101', {
        prdId: 'prd-101',
        roadmapId: 'rm-001',
      })
      expect(addToast).toHaveBeenCalledWith(
        'Successfully committed 2 items from approved PRD.',
        'success'
      )
    })
  })

  it('creates a new deliverable item via modal and Atlas API', async () => {
    const newItem = {
      id: 'item-3',
      workspaceId: 'ws-101',
      roadmapId: 'rm-001',
      title: 'Automated Dead-Letter Queue',
      description: 'DLQ retry consumer',
      status: 'Planned',
      priority: 'High',
      startDate: '2026-10-01',
      targetDate: '2026-11-01',
      milestone: 'Phase 1',
      progress: 0,
      isCommitted: false,
    }
    roadmapService.createRoadmapItem.mockResolvedValue(newItem)

    render(
      <MemoryRouter>
        <RoadmapPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Add Item')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Add Item'))

    // Fill form
    const titleInput = screen.getByPlaceholderText('e.g. Webhook Delivery Service Architecture')
    fireEvent.change(titleInput, { target: { value: 'Automated Dead-Letter Queue' } })

    const saveBtn = screen.getByText('Save Item')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(roadmapService.createRoadmapItem).toHaveBeenCalledWith(
        'ws-101',
        expect.objectContaining({ title: 'Automated Dead-Letter Queue' })
      )
      expect(addToast).toHaveBeenCalledWith(
        "Created roadmap item 'Automated Dead-Letter Queue'",
        'success'
      )
    })
  })
})
