import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ValidationSummary from '../components/planning/validation/ValidationSummary'
import ValidationIssueCard from '../components/planning/validation/ValidationIssueCard'
import { PRDValidationPanel } from '../components/planning/validation/PRDValidationPanel'
import { prdService } from '../services/api/prdService'
import { apiClient } from '../services/api/apiClient'

vi.mock('../services/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
  getActiveWorkspaceId: vi.fn(() => 'ws-test-123'),
}))

describe('Phase 5.5 — PRD Quality & Validation System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleSummary = {
    quality_score: 85,
    quality_score_calculation: '100 - (0 critical * 25 + 1 high * 15 + 0 med * 5 + 0 low * 2)',
    total_checks: 18,
    passed_checks: 17,
    failed_checks: 1,
    critical_issues: 0,
    high_severity_issues: 1,
    medium_severity_issues: 0,
    low_severity_issues: 0,
    is_valid_for_review: false,
    has_blocking_issues: true,
  }

  const sampleIssues = [
    {
      issue_id: 'V-001',
      category: 'requirement_quality',
      severity: 'high',
      title: 'Contradictory Requirements Detected',
      description: 'Requirement REQ-001 (synchronous processing) conflicts with REQ-002 (offline batching).',
      section_key: 'functional_requirements',
      related_id: 'REQ-002',
      recommendation: 'Reconcile processing paradigm across requirements.',
    },
    {
      issue_id: 'V-002',
      category: 'acceptance_criteria',
      severity: 'medium',
      title: 'Missing Given-When-Then Clause',
      description: 'Acceptance criterion AC-001 is missing the "When" clause.',
      section_key: 'acceptance_criteria',
      related_id: 'AC-001',
      recommendation: 'Format description using standard Gherkin syntax.',
    },
    {
      issue_id: 'V-003',
      category: 'evidence_traceability',
      severity: 'low',
      title: 'Feedback Reference Lacks Quote',
      description: 'Feedback item FB-100 referenced without supporting transcript quote.',
      section_key: 'customer_pain_points',
      related_id: 'FB-100',
      recommendation: 'Include exact user quotation for verifiable evidence.',
    },
  ]

  const sampleValidationResult = {
    planning_id: 'prd-999',
    workspace_id: 'ws-test-123',
    version: 3,
    summary: sampleSummary,
    issues: sampleIssues,
    validated_at: '2026-11-14T20:00:00Z',
  }

  describe('ValidationSummary Component', () => {
    it('renders quality score, calculation, and verification ratio correctly', () => {
      render(<ValidationSummary summary={sampleSummary} />)

      expect(screen.getByText('85')).toBeInTheDocument()
      expect(screen.getByText('Score')).toBeInTheDocument()
      expect(screen.getByText(/17 \/ 18 Checks Passed/i)).toBeInTheDocument()
      expect(
        screen.getByText(/100 - \(0 critical \* 25 \+ 1 high \* 15 \+ 0 med \* 5 \+ 0 low \* 2\)/i)
      ).toBeInTheDocument()
    })

    it('renders blocking issues badge when has_blocking_issues is true', () => {
      render(<ValidationSummary summary={sampleSummary} />)

      expect(screen.getByText(/Blocking Issues \(1\)/i)).toBeInTheDocument()
    })

    it('renders Review Ready badge when is_valid_for_review is true and no blocking issues', () => {
      const readySummary = {
        ...sampleSummary,
        quality_score: 100,
        critical_issues: 0,
        high_severity_issues: 0,
        has_blocking_issues: false,
        is_valid_for_review: true,
      }
      render(<ValidationSummary summary={readySummary} />)

      expect(screen.getByText(/Review Ready/i)).toBeInTheDocument()
    })

    it('renders severity breakdown tiles with accurate counts', () => {
      render(<ValidationSummary summary={sampleSummary} />)

      expect(screen.getByText('Critical')).toBeInTheDocument()
      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Medium')).toBeInTheDocument()
      expect(screen.getByText('Low')).toBeInTheDocument()
    })
  })

  describe('ValidationIssueCard Component', () => {
    it('renders issue details, severity pill, and category badge', () => {
      const issue = sampleIssues[0]
      render(<ValidationIssueCard issue={issue} />)

      expect(screen.getByText('V-001')).toBeInTheDocument()
      expect(screen.getByText('High')).toBeInTheDocument()
      expect(screen.getByText('Requirement Quality')).toBeInTheDocument()
      expect(screen.getByText('REQ-002')).toBeInTheDocument()
      expect(screen.getByText('Contradictory Requirements Detected')).toBeInTheDocument()
      expect(screen.getByText(/Requirement REQ-001/i)).toBeInTheDocument()
      expect(screen.getByText(/Reconcile processing paradigm/i)).toBeInTheDocument()
    })

    it('triggers onNavigate callback when Navigate to Section is clicked', () => {
      const onNavigate = vi.fn()
      const issue = sampleIssues[0]
      render(<ValidationIssueCard issue={issue} onNavigate={onNavigate} />)

      const navBtn = screen.getByText('Navigate to Section')
      fireEvent.click(navBtn)

      expect(onNavigate).toHaveBeenCalledTimes(1)
      expect(onNavigate).toHaveBeenCalledWith('functional_requirements', 'REQ-002')
    })
  })

  describe('PRDValidationPanel Component', () => {
    it('renders panel header and findings count', () => {
      render(
        <PRDValidationPanel
          validationResult={sampleValidationResult}
          isValidating={false}
          onRunValidation={() => {}}
        />
      )

      expect(screen.getByText('PRD Quality & Verification Audit')).toBeInTheDocument()
      expect(screen.getByText('3 Findings')).toBeInTheDocument()
      expect(screen.getByText('Re-run Quality Audit')).toBeInTheDocument()
    })

    it('filters issues by severity pill', () => {
      render(
        <PRDValidationPanel
          validationResult={sampleValidationResult}
          isValidating={false}
          onRunValidation={() => {}}
        />
      )

      expect(screen.getByText('Contradictory Requirements Detected')).toBeInTheDocument()
      expect(screen.getByText('Missing Given-When-Then Clause')).toBeInTheDocument()
      expect(screen.getByText('Feedback Reference Lacks Quote')).toBeInTheDocument()

      // Click 'High' filter
      const highFilterBtn = screen.getByRole('button', { name: /High \(1\)/i })
      fireEvent.click(highFilterBtn)

      expect(screen.getByText('Contradictory Requirements Detected')).toBeInTheDocument()
      expect(screen.queryByText('Missing Given-When-Then Clause')).not.toBeInTheDocument()
      expect(screen.queryByText('Feedback Reference Lacks Quote')).not.toBeInTheDocument()
    })

    it('filters issues by search input query', () => {
      render(
        <PRDValidationPanel
          validationResult={sampleValidationResult}
          isValidating={false}
          onRunValidation={() => {}}
        />
      )

      const searchInput = screen.getByPlaceholderText(/Search issues/i)
      fireEvent.change(searchInput, { target: { value: 'Gherkin' } })

      expect(screen.queryByText('Contradictory Requirements Detected')).not.toBeInTheDocument()
      expect(screen.getByText('Missing Given-When-Then Clause')).toBeInTheDocument()
      expect(screen.queryByText('Feedback Reference Lacks Quote')).not.toBeInTheDocument()
    })

    it('renders empty unvalidated state when validationResult is null', () => {
      const onRunValidation = vi.fn()
      render(
        <PRDValidationPanel
          validationResult={null}
          isValidating={false}
          onRunValidation={onRunValidation}
        />
      )

      expect(screen.getByText('Audit Specification Quality Before Human Review')).toBeInTheDocument()
      const runBtn = screen.getByRole('button', { name: /Run PRD Quality Audit/i })
      fireEvent.click(runBtn)
      expect(onRunValidation).toHaveBeenCalledTimes(1)
    })

    it('renders perfect score state when issues list is empty', () => {
      const perfectResult = {
        ...sampleValidationResult,
        issues: [],
        summary: {
          ...sampleSummary,
          quality_score: 100,
          critical_issues: 0,
          high_severity_issues: 0,
          has_blocking_issues: false,
          is_valid_for_review: true,
        },
      }
      render(
        <PRDValidationPanel
          validationResult={perfectResult}
          isValidating={false}
          onRunValidation={() => {}}
        />
      )

      expect(screen.getByText('All Validation Checks Passed!')).toBeInTheDocument()
      expect(
        screen.getByText(
          /The specification adheres to all 13 canonical sections, zero-fabrication metrics, Given-When-Then acceptance criteria, and traceability rules/i
        )
      ).toBeInTheDocument()
    })
  })

  describe('prdService.validateProductPlan API integration', () => {
    it('calls post with proper validate endpoint and returns data', async () => {
      apiClient.post.mockResolvedValueOnce({
        success: true,
        data: sampleValidationResult,
      })

      const res = await prdService.validateProductPlan('prd-999', 'ws-test-123')

      expect(apiClient.post).toHaveBeenCalledTimes(1)
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/ai/planning/prd-999/validate',
        {},
        { params: { workspace_id: 'ws-test-123' } }
      )
      expect(res.summary.quality_score).toBe(85)
      expect(res.issues).toHaveLength(3)
    })

    it('throws error when validation endpoint fails', async () => {
      apiClient.post.mockResolvedValueOnce({
        success: false,
        error: 'Workspace validation failed',
        status: 403,
      })

      await expect(prdService.validateProductPlan('prd-999')).rejects.toThrow(
        'Workspace validation failed'
      )
    })
  })
})
