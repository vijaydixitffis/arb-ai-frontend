import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Plus, Trash2 } from 'lucide-react'

interface NFRCriterion {
  id: string
  category: string
  criteria: string
  target_value: string
  actual_value: string
  score: number
  evidence?: string
}

interface NFRCriteriaSectionProps {
  nfr_criteria: NFRCriterion[]
  onChange: (criteria: NFRCriterion[]) => void
}

const predefinedCategories = [
  'Performance',
  'Scalability', 
  'Availability',
  'Security',
  'Reliability',
  'Maintainability',
  'Usability',
  'Compliance'
]

const predefinedCriteria = {
  'Performance': ['Response Time', 'Throughput', 'Resource Utilization', 'Latency'],
  'Scalability': ['Concurrent Users', 'Transactions per Second', 'Data Volume', 'Peak Load'],
  'Availability': ['Uptime', 'Downtime', 'Mean Time Between Failures', 'Mean Time To Recovery'],
  'Security': ['Authentication', 'Authorization', 'Data Encryption', 'Vulnerability Assessment'],
  'Reliability': ['Error Rate', 'Failure Rate', 'Recovery Time', 'Data Integrity'],
  'Maintainability': ['Code Coverage', 'Technical Debt', 'Documentation Coverage', 'Bug Fix Time'],
  'Usability': ['User Satisfaction', 'Task Completion Rate', 'Error Rate', 'Learnability'],
  'Compliance': ['Regulatory Compliance', 'Audit Pass Rate', 'Policy Adherence', 'Risk Assessment']
}

export default function NFRCriteriaSection({ nfr_criteria, onChange }: NFRCriteriaSectionProps) {
  const [newCriterion, setNewCriterion] = useState<Partial<NFRCriterion>>({
    category: '',
    criteria: '',
    target_value: '',
    actual_value: '',
    score: 5,
    evidence: ''
  })

  const addCriterion = () => {
    if (!newCriterion.category || !newCriterion.criteria || !newCriterion.target_value) {
      alert('Please fill in Category, Criteria, and Target Value')
      return
    }

    const criterion: NFRCriterion = {
      id: Date.now().toString(),
      category: newCriterion.category!,
      criteria: newCriterion.criteria!,
      target_value: newCriterion.target_value!,
      actual_value: newCriterion.actual_value || 'Not measured',
      score: newCriterion.score || 5,
      evidence: newCriterion.evidence || ''
    }

    onChange([...nfr_criteria, criterion])
    setNewCriterion({
      category: '',
      criteria: '',
      target_value: '',
      actual_value: '',
      score: 5,
      evidence: ''
    })
  }

  const updateCriterion = (id: string, field: keyof NFRCriterion, value: any) => {
    onChange(nfr_criteria.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ))
  }

  const removeCriterion = (id: string) => {
    onChange(nfr_criteria.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quantitative NFR Criteria</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define measurable non-functional requirements with targets and actual values
          </p>
        </CardHeader>
        <CardContent>
          {/* Add New Criterion Form */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="font-medium mb-4">Add New Criterion</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={newCriterion.category}
                  onChange={(e) => {
                    setNewCriterion({ ...newCriterion, category: e.target.value, criteria: '' })
                  }}
                >
                  <option value="">Select category</option>
                  {predefinedCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Criteria</label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={newCriterion.criteria}
                  onChange={(e) => setNewCriterion({ ...newCriterion, criteria: e.target.value })}
                  disabled={!newCriterion.category}
                >
                  <option value="">Select criteria</option>
                  {newCriterion.category && predefinedCriteria[newCriterion.category as keyof typeof predefinedCriteria]?.map(criteria => (
                    <option key={criteria} value={criteria}>{criteria}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Value</label>
                <Input
                  placeholder="e.g., < 200ms, 99.9%, 1000"
                  value={newCriterion.target_value}
                  onChange={(e) => setNewCriterion({ ...newCriterion, target_value: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Actual Value</label>
                <Input
                  placeholder="e.g., 150ms, 99.5%, 800"
                  value={newCriterion.actual_value}
                  onChange={(e) => setNewCriterion({ ...newCriterion, actual_value: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Score (0-10)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={newCriterion.score}
                    onChange={(e) => setNewCriterion({ ...newCriterion, score: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-medium w-8 text-center">{newCriterion.score}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Evidence (optional)</label>
                <Input
                  placeholder="Test results or documentation link"
                  value={newCriterion.evidence}
                  onChange={(e) => setNewCriterion({ ...newCriterion, evidence: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
            <Button
              onClick={addCriterion}
              className="mt-4"
              size="sm"
              disabled={!newCriterion.category || !newCriterion.criteria || !newCriterion.target_value}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Criterion
            </Button>
          </div>

          {/* Existing Criteria List */}
          {nfr_criteria.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">Defined Criteria ({nfr_criteria.length})</h4>
              {nfr_criteria.map((criterion) => (
                <div key={criterion.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {criterion.category}
                        </span>
                        <h5 className="font-medium">{criterion.criteria}</h5>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Target:</span>
                          <span className="ml-2">{criterion.target_value}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Actual:</span>
                          <span className="ml-2">{criterion.actual_value}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Score:</span>
                          <span className={`ml-2 font-bold ${
                            criterion.score >= 8 ? 'text-green-600' :
                            criterion.score >= 6 ? 'text-yellow-600' :
                            criterion.score >= 4 ? 'text-orange-600' : 'text-red-600'
                          }`}>
                            {criterion.score}/10
                          </span>
                        </div>
                      </div>
                      {criterion.evidence && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium text-gray-600">Evidence:</span>
                          <span className="ml-2 text-gray-800">{criterion.evidence}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCriterion(criterion.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Edit Mode */}
                  <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Actual Value</label>
                      <Input
                        value={criterion.actual_value}
                        onChange={(e) => updateCriterion(criterion.id, 'actual_value', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Score (0-10)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={criterion.score}
                          onChange={(e) => updateCriterion(criterion.id, 'score', parseInt(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-sm font-medium w-8 text-center">{criterion.score}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Evidence</label>
                      <Input
                        value={criterion.evidence || ''}
                        onChange={(e) => updateCriterion(criterion.id, 'evidence', e.target.value)}
                        className="text-sm"
                        placeholder="Add evidence..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {nfr_criteria.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No NFR criteria defined yet. Add your first criterion above.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
