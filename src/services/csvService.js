import { analyzeSentiment, predictCategory, generateSmartTags } from './aiSimulationService'

/**
 * Robust CSV line parser handling quotes, escaped quotes, and commas
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export function parseFeedbackCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length < 2) {
    return {
      success: false,
      error: 'CSV file must contain a header row and at least one data row.',
      records: [],
      errors: [],
      totalParsed: 0,
    }
  }

  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  
  // Find column indices
  const titleIdx = headers.findIndex(h => h.includes('title'))
  const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('content') || h.includes('feedback') || h.includes('detail'))
  const customerIdx = headers.findIndex(h => h.includes('cust') || h.includes('user') || h.includes('name') || h.includes('author'))
  const companyIdx = headers.findIndex(h => h.includes('comp') || h.includes('org') || h.includes('account'))
  const catIdx = headers.findIndex(h => h.includes('cat') || h.includes('type'))
  const sentIdx = headers.findIndex(h => h.includes('sent'))
  const prioIdx = headers.findIndex(h => h.includes('prio') || h.includes('urg'))
  const tagsIdx = headers.findIndex(h => h.includes('tag'))

  if (titleIdx === -1 && descIdx === -1) {
    return {
      success: false,
      error: 'CSV must contain at least a "title" or "description" column.',
      records: [],
      errors: [],
      totalParsed: 0,
    }
  }

  const records = []
  const rowErrors = []

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i]
    const cols = parseCSVLine(rawLine)

    const rawTitle = titleIdx !== -1 ? cols[titleIdx] : ''
    const rawDesc = descIdx !== -1 ? cols[descIdx] : ''
    const customer = (customerIdx !== -1 && cols[customerIdx]) || 'Anonymous Customer'
    const company = (companyIdx !== -1 && cols[companyIdx]) || 'Independent Account'

    const title = rawTitle || (rawDesc ? rawDesc.slice(0, 60) + '...' : '')
    const description = rawDesc || rawTitle

    if (!title && !description) {
      rowErrors.push(`Row ${i + 1}: Skipped empty record (missing title and description).`)
      continue
    }

    const category = (catIdx !== -1 && cols[catIdx]) || predictCategory(`${title} ${description}`)
    const sentiment = (sentIdx !== -1 && cols[sentIdx]) || analyzeSentiment(`${title} ${description}`)
    const priority = (prioIdx !== -1 && cols[prioIdx]) || (sentiment === 'Negative' ? 'High' : 'Medium')
    
    let tags = []
    if (tagsIdx !== -1 && cols[tagsIdx]) {
      tags = cols[tagsIdx].split(/[,;|]/).map(t => t.trim()).filter(Boolean)
    }
    if (tags.length === 0) {
      tags = generateSmartTags(title, description)
    }

    records.push({
      id: `fb-import-${Date.now()}-${i}`,
      title,
      description,
      customer,
      company,
      category,
      sentiment: ['Positive', 'Negative', 'Neutral'].includes(sentiment) ? sentiment : 'Neutral',
      priority: ['Urgent', 'High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
      tags,
      date: new Date().toISOString().split('T')[0],
      linkedFeatureId: null,
    })
  }

  return {
    success: records.length > 0,
    records,
    errors: rowErrors,
    totalParsed: records.length,
  }
}

export function generateSampleCSV() {
  return `Title,Description,Customer,Company,Category,Sentiment,Priority,Tags
"Mobile app crashes on checkout","When paying with credit card on iOS 18 the app crashes instantly","Carlos Mendez","Retail Plus","Reliability","Negative","Urgent","mobile,ios,checkout,crash"
"Would love dark mode support","The bright white interface is exhausting during night triage shifts","Sarah Connor","Cyberdyne","Usability","Neutral","Medium","dark-mode,ui,contrast"
"Great automated smart tagging","The AI tag suggestions categorized 50 tickets in seconds. Huge time saver!","John Doe","TechCorp","Satisfaction","Positive","Low","ai,tagging,productivity"
"Add bi-directional Jira sync","Need our user stories to push directly to Jira sprint backlog","Amira Patel","FinScale","Integrations","Neutral","High","jira,sync,engineering"`
}

export function exportFeedbackToCSV(feedbackList = []) {
  const headers = ['ID', 'Title', 'Description', 'Customer', 'Company', 'Category', 'Sentiment', 'Priority', 'Tags', 'Date', 'Linked Feature']
  
  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""'
    const clean = String(str).replace(/"/g, '""')
    return `"${clean}"`
  }

  const rows = feedbackList.map(item => [
    escapeCSV(item.id),
    escapeCSV(item.title),
    escapeCSV(item.description),
    escapeCSV(item.customer),
    escapeCSV(item.company),
    escapeCSV(item.category),
    escapeCSV(item.sentiment),
    escapeCSV(item.priority),
    escapeCSV(Array.isArray(item.tags) ? item.tags.join(', ') : item.tags),
    escapeCSV(item.date),
    escapeCSV(item.linkedFeatureId || 'Unlinked'),
  ].join(','))

  return [headers.join(','), ...rows].join('\n')
}

export function exportFeaturesToCSV(featuresList = []) {
  const headers = [
    'ID', 'Name', 'Description', 'Priority Score', 
    'Customer Impact (35%)', 'Urgency (30%)', 'Demand (20%)', 'Business Value (15%)',
    'Status', 'Owner', 'Target Release', 'Related Feedback Count'
  ]

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""'
    const clean = String(str).replace(/"/g, '""')
    return `"${clean}"`
  }

  const rows = featuresList.map(item => [
    escapeCSV(item.id),
    escapeCSV(item.name),
    escapeCSV(item.description),
    escapeCSV(item.score?.toFixed(2) || '0.00'),
    escapeCSV(item.customerImpact),
    escapeCSV(item.urgency),
    escapeCSV(item.demand),
    escapeCSV(item.businessValue),
    escapeCSV(item.status),
    escapeCSV(item.owner),
    escapeCSV(item.targetRelease),
    escapeCSV(item.relatedFeedbackIds?.length || 0),
  ].join(','))

  return [headers.join(','), ...rows].join('\n')
}
