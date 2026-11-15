import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UserStoryCard from '../components/planning/UserStoryCard'
import AcceptanceCriteriaList from '../components/planning/AcceptanceCriteriaList'
import { UserStoryStudio } from '../components/planning/UserStoryStudio'
import {
  parseGivenWhenThen,
  formatGivenWhenThen,
  validateUserStory,
  validateAcceptanceCriterion,
  parseTextToStories,
  formatStoriesToText,
  formatCriteriaToText,
} from '../components/planning/storyHelpers'

describe('Phase 5.4 — Interactive User Story & Acceptance Criteria Studio', () => {
  const sampleCriteria = [
    {
      criterion_id: 'AC-001',
      description: 'Given an active workspace, When user initiates export, Then a streaming CSV is downloaded within 2 seconds.',
      scenario_type: 'positive',
      testable: true,
      origin: 'source_supported',
      is_confirmed: true,
      requires_confirmation: false,
      related_story_id: 'US-001',
    },
    {
      criterion_id: 'AC-002',
      description: 'Given network drop during export, When streaming fails, Then a resumable error notification is displayed.',
      scenario_type: 'negative',
      testable: true,
      origin: 'user_provided',
      is_confirmed: true,
      requires_confirmation: false,
      related_story_id: 'US-001',
    },
  ]

  const sampleStory = {
    story_id: 'US-001',
    title: 'Automated CSV Export Engine',
    persona: 'Financial Analyst',
    description: 'As a Financial Analyst, I want automated CSV exports, so that manual data copying is eliminated.',
    business_value: 'Reduces quarterly reconciliation time by 4 hours per analyst',
    priority: 'High',
    origin: 'source_supported',
    is_confirmed: true,
    requires_confirmation: false,
    related_requirements: ['FR-01', 'NFR-02'],
    acceptance_criteria: sampleCriteria,
    dependencies: [],
  }

  const sampleStory2 = {
    story_id: 'US-002',
    title: 'Custom Column Filtering',
    persona: 'Risk Officer',
    description: 'As a Risk Officer, I want custom column filters, so that confidential columns are excluded from export.',
    business_value: 'Ensures strict compliance with SOC2 data egress controls',
    priority: 'Critical',
    origin: 'ai_recommendation',
    is_confirmed: false,
    requires_confirmation: true,
    related_requirements: ['FR-03'],
    acceptance_criteria: [
      {
        criterion_id: 'AC-003',
        description: 'Given masked columns, When export runs, Then masked values are redacted with asterisks.',
        scenario_type: 'edge_case',
        testable: true,
        origin: 'ai_recommendation',
        is_confirmed: false,
        requires_confirmation: true,
        related_story_id: 'US-002',
      },
    ],
    dependencies: ['US-001'],
  }

  describe('1. Acceptance Criteria List Component', () => {
    it('renders Given-When-Then behavioral formatted criteria with scenario type and origin badges', () => {
      render(
        <AcceptanceCriteriaList
          criteria={sampleCriteria}
          storyId="US-001"
          isApproved={false}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onChangeCriteria={() => {}}
        />
      )

      expect(screen.getByText(/AC-001/i)).toBeInTheDocument()
      expect(screen.getByText(/Positive Flow/i)).toBeInTheDocument()
      expect(screen.getByText(/Source Supported/i)).toBeInTheDocument()
      expect(screen.getByText(/AC-002/i)).toBeInTheDocument()
      expect(screen.getByText(/Negative Scenario/i)).toBeInTheDocument()
      expect(screen.getByText(/User Provided/i)).toBeInTheDocument()
    })

    it('toggles testable status on a criterion and triggers onChangeCriteria', () => {
      const handleChange = vi.fn()
      render(
        <AcceptanceCriteriaList
          criteria={sampleCriteria}
          storyId="US-001"
          isApproved={false}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onChangeCriteria={handleChange}
        />
      )

      const testableToggle = screen.getAllByTitle(/Mark as non-testable/i)[0]
      fireEvent.click(testableToggle)

      expect(handleChange).toHaveBeenCalledTimes(1)
      const updatedCriteria = handleChange.mock.calls[0][0]
      expect(updatedCriteria[0].testable).toBe(false)
    })

    it('adds a new criterion with Given-When-Then fields and scenario type selection', () => {
      const handleChange = vi.fn()
      render(
        <AcceptanceCriteriaList
          criteria={sampleCriteria}
          storyId="US-001"
          isApproved={false}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onChangeCriteria={handleChange}
        />
      )

      // Click Add Acceptance Criterion button
      fireEvent.click(screen.getByText(/Add Acceptance Criterion/i))

      // Inputs should appear
      expect(screen.getByPlaceholderText(/e\.g\. The user is logged in/i)).toBeInTheDocument()

      // Fill in Given-When-Then
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. The user is logged in/i), {
        target: { value: 'table contains 500,000 rows' },
      })
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. The user clicks Export/i), {
        target: { value: 'export is requested' },
      })
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. A downloadable CSV stream/i), {
        target: { value: 'file is compressed into a zip' },
      })

      // Click Add Criterion button inside form
      fireEvent.click(screen.getByRole('button', { name: /Add Criterion/i }))

      expect(handleChange).toHaveBeenCalledTimes(1)
      const updated = handleChange.mock.calls[0][0]
      expect(updated).toHaveLength(3)
      expect(updated[2].criterion_id).toBe('AC-003')
      expect(updated[2].description).toContain('Given table contains 500,000 rows')
      expect(updated[2].origin).toBe('user_provided')
      expect(updated[2].is_confirmed).toBe(true)
    })

    it('deletes a criterion when clicking the delete button and confirming', () => {
      const handleChange = vi.fn()
      render(
        <AcceptanceCriteriaList
          criteria={sampleCriteria}
          storyId="US-001"
          isApproved={false}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onChangeCriteria={handleChange}
        />
      )

      const deleteButtons = screen.getAllByTitle(/Delete Criterion/i)
      fireEvent.click(deleteButtons[0])

      // Confirm delete banner appears
      expect(screen.getByText(/Delete criterion AC-001\?/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Confirm/i }))

      expect(handleChange).toHaveBeenCalledTimes(1)
      const updated = handleChange.mock.calls[0][0]
      expect(updated).toHaveLength(1)
      expect(updated[0].criterion_id).toBe('AC-002')
    })
  })

  describe('2. User Story Card Component', () => {
    it('renders story ID, title, persona, description, business value, and priority badge', () => {
      render(
        <UserStoryCard
          story={sampleStory}
          isApproved={false}
          allExistingStoryIds={['US-001', 'US-002']}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onUpdateStory={() => {}}
          onDeleteStory={() => {}}
        />
      )

      expect(screen.getByText('US-001')).toBeInTheDocument()
      expect(screen.getByText('Automated CSV Export Engine')).toBeInTheDocument()
      expect(screen.getByText('Financial Analyst')).toBeInTheDocument()
      expect(screen.getByText(/High Priority/i)).toBeInTheDocument()
      expect(screen.getByText(/Reduces quarterly reconciliation time/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Source Supported/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Confirmed/i).length).toBeGreaterThan(0)
    })

    it('displays AI Recommendation badge and Needs PM Review when unconfirmed', () => {
      render(
        <UserStoryCard
          story={sampleStory2}
          isApproved={false}
          allExistingStoryIds={['US-001', 'US-002']}
          allExistingCriterionIds={['AC-001', 'AC-002', 'AC-003']}
          onUpdateStory={() => {}}
          onDeleteStory={() => {}}
        />
      )

      expect(screen.getByText('US-002')).toBeInTheDocument()
      expect(screen.getAllByText(/AI Recommendation/i).length).toBeGreaterThan(0)
      expect(screen.getByText(/Needs PM Review/i)).toBeInTheDocument()
      expect(screen.getByText(/Critical Priority/i)).toBeInTheDocument()
    })

    it('enters edit mode, updates title and priority, and saves changes', () => {
      const handleUpdate = vi.fn()
      render(
        <UserStoryCard
          story={sampleStory}
          isApproved={false}
          allExistingStoryIds={['US-001', 'US-002']}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onUpdateStory={handleUpdate}
          onDeleteStory={() => {}}
        />
      )

      // Enter edit mode
      fireEvent.click(screen.getByLabelText(/Edit/i))

      // Change title
      const titleInput = screen.getByDisplayValue('Automated CSV Export Engine')
      fireEvent.change(titleInput, { target: { value: 'High-Throughput Streaming CSV Engine' } })

      // Change priority to Critical
      const prioritySelect = screen.getByDisplayValue('High')
      fireEvent.change(prioritySelect, { target: { value: 'Critical' } })

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Save Story/i }))

      expect(handleUpdate).toHaveBeenCalledTimes(1)
      const updatedStory = handleUpdate.mock.calls[0][0]
      expect(updatedStory.title).toBe('High-Throughput Streaming CSV Engine')
      expect(updatedStory.priority).toBe('Critical')
    })

    it('cancels editing and restores original values', () => {
      const handleUpdate = vi.fn()
      render(
        <UserStoryCard
          story={sampleStory}
          isApproved={false}
          allExistingStoryIds={['US-001', 'US-002']}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onUpdateStory={handleUpdate}
          onDeleteStory={() => {}}
        />
      )

      fireEvent.click(screen.getByLabelText(/Edit/i))
      const titleInput = screen.getByDisplayValue('Automated CSV Export Engine')
      fireEvent.change(titleInput, { target: { value: 'Something Else' } })

      // Cancel
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))

      expect(handleUpdate).not.toHaveBeenCalled()
      expect(screen.getByText('Automated CSV Export Engine')).toBeInTheDocument()
    })

    it('shows confirmation and deletes story on confirm', () => {
      const handleDelete = vi.fn()
      render(
        <UserStoryCard
          story={sampleStory}
          isApproved={false}
          allExistingStoryIds={['US-001', 'US-002']}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onUpdateStory={() => {}}
          onDeleteStory={handleDelete}
        />
      )

      fireEvent.click(screen.getByLabelText(/Delete/i))
      expect(screen.getByText(/Are you sure you want to delete user story/i)).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Confirm Delete/i }))
      expect(handleDelete).toHaveBeenCalledWith('US-001')
    })

    it('collapses and expands acceptance criteria section', () => {
      render(
        <UserStoryCard
          story={sampleStory}
          isApproved={false}
          allExistingStoryIds={['US-001', 'US-002']}
          allExistingCriterionIds={['AC-001', 'AC-002']}
          onUpdateStory={() => {}}
          onDeleteStory={() => {}}
        />
      )

      // Criteria are initially expanded
      expect(screen.getByText(/AC-001/i)).toBeInTheDocument()

      // Click criteria toggle button
      const toggleBtn = screen.getByTitle(/Collapse/i)
      fireEvent.click(toggleBtn)

      // Criteria list should now be collapsed
      expect(screen.queryByText(/AC-001/i)).not.toBeInTheDocument()

      // Click again to re-expand
      const expandBtn = screen.getByTitle(/Expand/i)
      fireEvent.click(expandBtn)
      expect(screen.getByText(/AC-001/i)).toBeInTheDocument()
    })
  })

  describe('3. User Story Studio Container Component', () => {
    it('renders all stories and toolbar with total story count', () => {
      render(
        <UserStoryStudio
          stories={[sampleStory, sampleStory2]}
          isApproved={false}
          isSaving={false}
          onSaveStories={() => {}}
          onChangeStories={() => {}}
        />
      )

      expect(screen.getByText(/Interactive User Story Studio/i)).toBeInTheDocument()
      expect(screen.getByText(/2 Stories/i)).toBeInTheDocument()
      expect(screen.getByText('US-001')).toBeInTheDocument()
      expect(screen.getByText('US-002')).toBeInTheDocument()
    })

    it('opens Add User Story form and validates mandatory fields', () => {
      render(
        <UserStoryStudio
          stories={[sampleStory]}
          isApproved={false}
          isSaving={false}
          onSaveStories={() => {}}
          onChangeStories={() => {}}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Add User Story/i }))
      expect(screen.getByText(/Create New User Story & Initial Acceptance Criteria/i)).toBeInTheDocument()

      // Try to save with empty fields
      fireEvent.click(screen.getByRole('button', { name: /Create Story/i }))
      expect(screen.getByText(/Story title cannot be empty/i)).toBeInTheDocument()
    })

    it('successfully creates a new story with auto-incremented ID and triggers onChangeStories', () => {
      const handleChangeStories = vi.fn()
      render(
        <UserStoryStudio
          stories={[sampleStory]}
          isApproved={false}
          isSaving={false}
          onSaveStories={() => {}}
          onChangeStories={handleChangeStories}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /Add User Story/i }))

      // Fill in required fields
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Export Search Results to CSV/i), {
        target: { value: 'Export Completion Webhooks' },
      })
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Financial Auditor/i), {
        target: { value: 'Backend Architect' },
      })
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. an Export button that downloads/i), {
        target: { value: 'receive instant webhook alerts upon completion' },
      })
      fireEvent.change(screen.getByPlaceholderText(/e\.g\. quarterly reconciliation takes/i), {
        target: { value: 'downstream ETL pipelines are automatically triggered' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Create Story/i }))

      expect(handleChangeStories).toHaveBeenCalledTimes(1)
      const newStories = handleChangeStories.mock.calls[0][0]
      expect(newStories).toHaveLength(2)
      expect(newStories[1].story_id).toBe('US-002')
      expect(newStories[1].title).toBe('Export Completion Webhooks')
      expect(newStories[1].origin).toBe('user_provided')
      expect(newStories[1].is_confirmed).toBe(true)
    })

    it('disables modification actions and buttons when PRD is approved', () => {
      render(
        <UserStoryStudio
          stories={[sampleStory]}
          isApproved={true}
          isSaving={false}
          onSaveStories={() => {}}
          onChangeStories={() => {}}
        />
      )

      // Add User Story and Save Stories buttons must not be present
      expect(screen.queryByRole('button', { name: /Add User Story/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Save Stories to Atlas/i })).not.toBeInTheDocument()

      // Card edit and delete buttons must be disabled
      const editBtn = screen.getByLabelText(/Edit/i)
      expect(editBtn).toBeDisabled()
      const deleteBtn = screen.getByLabelText(/Delete/i)
      expect(deleteBtn).toBeDisabled()
    })
  })

  describe('4. Story Helpers and Parsing Utilities', () => {
    it('parses Given-When-Then correctly from standard descriptions', () => {
      const gwt = parseGivenWhenThen('Given a valid user session, When the export button is pressed, Then the stream initiates.')
      expect(gwt.given).toBe('a valid user session')
      expect(gwt.when).toBe('the export button is pressed')
      expect(gwt.then).toBe('the stream initiates.')
    })

    it('formats Given-When-Then components into canonical acceptance criteria description', () => {
      const formatted = formatGivenWhenThen('authenticated user', 'requests data export', 'receives CSV stream')
      expect(formatted).toBe('Given authenticated user, When requests data export, Then receives CSV stream.')
    })

    it('validates user stories and flags duplicate IDs and empty fields', () => {
      expect(validateUserStory({ story_id: '', title: 'Test' })).toBe('Story ID is required.')
      expect(validateUserStory({ story_id: 'US-001', title: '' })).toBe('Story title cannot be empty.')
      expect(
        validateUserStory({ story_id: 'US-001', title: 'Test' }, ['US-001'], null)
      ).toBe("Story ID 'US-001' is already used in this specification.")
    })

    it('validates acceptance criteria and flags empty descriptions and duplicate IDs', () => {
      expect(validateAcceptanceCriterion({ criterion_id: '', description: 'test' })).toBe('Criterion ID is required.')
      expect(validateAcceptanceCriterion({ criterion_id: 'AC-001', description: '' })).toBe('Acceptance criterion description cannot be empty.')
      expect(
        validateAcceptanceCriterion({ criterion_id: 'AC-001', description: 'test' }, ['AC-001'], null)
      ).toBe("Criterion ID 'AC-001' is already used in this specification.")
    })

    it('round-trips text parsing to structured stories and back to canonical markdown format', () => {
      const text = '[US-001] Automated Export\nAs a user, I want automated export, so that manual effort is eliminated.'
      const acText = '[AC-001] (positive) Given data table, When click export, Then downloads.'

      const parsed = parseTextToStories(text, acText)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].story_id).toBe('US-001')
      expect(parsed[0].title).toBe('Automated Export')
      expect(parsed[0].acceptance_criteria).toHaveLength(1)
      expect(parsed[0].acceptance_criteria[0].criterion_id).toBe('AC-001')

      const formattedMarkdown = formatStoriesToText(parsed)
      expect(formattedMarkdown).toContain('[US-001] Automated Export')
    })
  })
})
