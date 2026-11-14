/**
 * ProductMind AI — User Story & Acceptance Criteria Utility Helpers
 * Formats, parses, and validates structured agile stories and Given-When-Then criteria.
 */

/**
 * Parses Given-When-Then components from a description string.
 */
export function parseGivenWhenThen(text) {
  if (!text || typeof text !== 'string') {
    return { given: '', when: '', then: '' }
  }
  const match = text.match(/Given\s*(.*?)[,\s]+When\s*(.*?)[,\s]+Then\s*(.*)/i)
  if (match) {
    return {
      given: match[1].trim(),
      when: match[2].trim(),
      then: match[3].trim(),
    }
  }
  return {
    given: text.trim(),
    when: '',
    then: '',
  }
}

/**
 * Formats given, when, then components into canonical Given-When-Then text.
 */
export function formatGivenWhenThen({ given, when, then }) {
  const g = (given || '').trim()
  const w = (when || '').trim()
  const t = (then || '').trim()
  if (g && w && t) {
    return `Given ${g}, When ${w}, Then ${t}`
  }
  return g || w || t || ''
}

/**
 * Extracts capability text from "As a [persona], I want [capability], so that [benefit]".
 */
export function extractCapability(description, persona = '', businessValue = '') {
  if (!description || typeof description !== 'string') return ''
  let text = description.trim()
  text = text.replace(/^As a\s+[^,]+,\s*/i, '')
  text = text.replace(/^I want\s+/i, '')
  text = text.replace(/,\s*so that[\s\S]*$/i, '')
  return text.trim() || description
}

/**
 * Parses flattened text into structured UserStory array if raw text was loaded.
 */
export function parseTextToStories(userStoriesText, acceptanceCriteriaText = '') {
  if (!userStoriesText || typeof userStoriesText !== 'string') return []

  const blocks = userStoriesText.split(/(?=(?:\[|###\s*)US-\d+)/i).filter(b => b.trim())
  if (blocks.length === 0) return []

  return blocks.map((block, idx) => {
    const idMatch = block.match(/(?:\[|###\s*)(US-\d+)[\]:]?\s*([^\n]+)?/i)
    const storyId = idMatch ? idMatch[1].toUpperCase() : `US-${String(idx + 1).padStart(3, '0')}`
    const title = idMatch && idMatch[2] ? idMatch[2].trim() : `User Story ${idx + 1}`

    const lines = block.split('\n').filter(l => l.trim())
    const descLines = lines.filter(l => !l.match(/^(?:\[|###\s*)US-\d+/i))
    const description = descLines.join(' ').trim() || `As a user, I want ${title}, so that operational efficiency is achieved.`

    const personaMatch = description.match(/As an?\s+([^,]+)/i)
    const persona = personaMatch ? personaMatch[1].trim() : 'Product User'

    const benefitMatch = description.match(/so that\s+([^.]+)/i)
    const businessValue = benefitMatch ? benefitMatch[1].trim() : 'Operational workflow efficiency'

    // Parse matching criteria from acceptance criteria text if present
    const criteria = []
    if (acceptanceCriteriaText && typeof acceptanceCriteriaText === 'string') {
      const acRegex = /\[(AC-\d+)\]\s*(?:\(([^)]+)\))?\s*([^\n]+)/gi
      let match
      while ((match = acRegex.exec(acceptanceCriteriaText)) !== null) {
        criteria.push({
          criterion_id: match[1].toUpperCase(),
          scenario_type: match[2]?.toLowerCase() || 'positive',
          description: match[3].trim(),
          testable: true,
          origin: 'source_supported',
          is_confirmed: true,
          requires_confirmation: false,
          related_story_id: storyId,
        })
      }
    }

    return {
      story_id: storyId,
      title,
      description,
      persona,
      business_value: businessValue,
      priority: 'High',
      origin: 'source_supported',
      is_confirmed: true,
      requires_confirmation: false,
      related_requirements: [],
      acceptance_criteria: criteria.length > 0 ? criteria : [
        {
          criterion_id: `AC-${String(idx + 1).padStart(3, '0')}`,
          description: `Given authenticated product user, When ${title} action is executed, Then system completes successfully.`,
          scenario_type: 'positive',
          testable: true,
          origin: 'source_supported',
          is_confirmed: true,
          requires_confirmation: false,
          related_story_id: storyId,
        },
      ],
      dependencies: [],
    }
  })
}

/**
 * Formats structured user stories array into canonical markdown section text.
 */
export function formatStoriesToText(stories = []) {
  if (!Array.isArray(stories) || stories.length === 0) return ''
  return stories
    .map(s => `[${s.story_id || 'US'}] ${s.title || ''}\n${s.description || ''}`)
    .join('\n\n')
}

/**
 * Formats structured acceptance criteria into canonical markdown section text.
 */
export function formatCriteriaToText(stories = []) {
  if (!Array.isArray(stories) || stories.length === 0) return ''
  return stories
    .filter(s => Array.isArray(s.acceptance_criteria) && s.acceptance_criteria.length > 0)
    .map(s => `${s.story_id || 'US'} Acceptance Criteria:\n` + s.acceptance_criteria.map(ac =>
      `  - [${ac.criterion_id || 'AC'}] (${ac.scenario_type || 'positive'}) ${ac.description || ''}`
    ).join('\n'))
    .join('\n\n')
}

/**
 * Validates a user story against mandatory fields and duplicate IDs.
 */
export function validateUserStory(story, existingStoryIds = [], currentStoryId = null) {
  if (!story.story_id || !story.story_id.trim()) {
    return 'Story ID is required.'
  }
  const id = story.story_id.trim().toUpperCase()
  if (existingStoryIds.some(existing => existing === id && existing !== currentStoryId)) {
    return `Story ID '${id}' is already used in this specification.`
  }
  if (!story.title || !story.title.trim()) {
    return 'Story title cannot be empty.'
  }
  if (!story.persona || !story.persona.trim()) {
    return 'Persona is required.'
  }
  if (!story.description || !story.description.trim()) {
    return 'Story description cannot be empty.'
  }
  if (!story.business_value || !story.business_value.trim()) {
    return 'Business value is required.'
  }
  return null
}

/**
 * Validates an acceptance criterion against mandatory fields and duplicate IDs.
 */
export function validateAcceptanceCriterion(criterion, existingCriterionIds = [], currentCriterionId = null) {
  if (!criterion.criterion_id || !criterion.criterion_id.trim()) {
    return 'Criterion ID is required.'
  }
  const id = criterion.criterion_id.trim().toUpperCase()
  if (existingCriterionIds.some(existing => existing === id && existing !== currentCriterionId)) {
    return `Criterion ID '${id}' is already used in this specification.`
  }
  if (!criterion.description || !criterion.description.trim()) {
    return 'Acceptance criterion description cannot be empty.'
  }
  const validScenarios = ['positive', 'negative', 'edge_case']
  if (criterion.scenario_type && !validScenarios.includes(criterion.scenario_type.toLowerCase())) {
    return `Scenario type must be one of: ${validScenarios.join(', ')}.`
  }
  return null
}

