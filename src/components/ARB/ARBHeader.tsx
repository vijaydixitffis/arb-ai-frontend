import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { ChevronLeft, Save } from 'lucide-react'
import { useMetadataStore } from '../../stores/metadataStore'

interface ARBHeaderProps {
  currentStep: number
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>
  progress: number
  onSaveDraft: () => void
}

export default function ARBHeader({ currentStep, setCurrentStep, progress, onSaveDraft }: ARBHeaderProps) {
  const navigate = useNavigate()
  const { domains } = useMetadataStore()

  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">New EA Review Request</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Progress: {progress}%
          </div>
          <Button variant="outline" onClick={onSaveDraft}>
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2">
          {/* Project Info Step */}
          <button
            onClick={() => setCurrentStep(1)}
            title="Project Information"
            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all whitespace-nowrap ${
              currentStep === 1
                ? 'bg-primary text-primary-foreground shadow-md'
                : currentStep > 1
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-white text-gray-600 border border-gray-300 hover:border-primary/50'
            }`}
          >
            <span className="mr-1">📋</span>
            Project Info
          </button>
          {/* Domain Steps */}
          {domains
            .sort((a, b) => a.seq_number - b.seq_number)
            .map((domain) => (
              <button
                key={domain.id}
                onClick={() => setCurrentStep(domain.seq_number + 1)}
                title={domain.description}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all whitespace-nowrap ${
                  currentStep === domain.seq_number + 1
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : currentStep > domain.seq_number + 1
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-primary/50'
                }`}
              >
                <span className="mr-1">{domain.icon}</span>
                {domain.name}
              </button>
            ))}
        </div>
      </div>
    </header>
  )
}
