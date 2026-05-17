import React from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useMetadataStore } from '../../stores/metadataStore'

interface ArtefactUploadProps {
  domain: string
  newArtefact: { domain: string; name: string; type: string; fileName: string; file: File | null }
  setNewArtefact: React.Dispatch<React.SetStateAction<{ domain: string; name: string; type: string; fileName: string; file: File | null }>>
  onAddArtefact: () => void
  uploadedArtefacts: Array<{ name: string; type: string; fileName: string; file: File | null }>
}

const getArtefactIcon = (type: string, artefactTypes: any[]) => {
  const artefactType = artefactTypes.find((t: any) => t.value === type)
  return artefactType?.icon || '📎'
}

const getArtefactTypeLabel = (type: string, artefactTypes: any[]) => {
  const artefactType = artefactTypes.find((t: any) => t.value === type)
  return artefactType?.label || type
}

export default function ArtefactUpload({ domain, newArtefact, setNewArtefact, onAddArtefact, uploadedArtefacts }: ArtefactUploadProps) {
  const { artefactTypes, artefactTemplatesByDomain } = useMetadataStore()
  const artefacts = artefactTemplatesByDomain[domain] || []

  return (
    <div>
      <label className="block text-sm font-medium mb-4">Artefacts</label>
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Artefact Name</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={newArtefact.name}
              onChange={(e) => {
                const selectedArtefact = artefacts.find(
                  (a: any) => a.name === e.target.value
                )
                setNewArtefact({
                  ...newArtefact,
                  name: e.target.value,
                  type: selectedArtefact?.artefact_type?.value || '',
                  domain,
                })
              }}
            >
              <option value="">Select artefact</option>
              {artefacts.map((artefact: any) => (
                <option key={artefact.name} value={artefact.name}>
                  {artefact.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Artefact Type</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={newArtefact.type}
              onChange={(e) => setNewArtefact({ ...newArtefact, type: e.target.value })}
            >
              <option value="">Select type</option>
              {artefactTypes.map((type: any) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">File Name</label>
            <Input
              placeholder="Enter file name"
              value={newArtefact.fileName}
              onChange={(e) => setNewArtefact({ ...newArtefact, fileName: e.target.value })}
              className="text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Upload File</label>
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                setNewArtefact({ ...newArtefact, file, fileName: file?.name || newArtefact.fileName })
              }}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
        <Button onClick={onAddArtefact} className="mt-3" size="sm">
          Add Artefact
        </Button>
      </div>

      {/* Uploaded Artefacts List */}
      {uploadedArtefacts.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium">Uploaded Artefacts</label>
          {uploadedArtefacts.map((artefact, index) => (
            <div key={index} className="flex items-center justify-between bg-white border rounded-md p-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">{getArtefactIcon(artefact.type, artefactTypes)}</span>
                <div>
                  <p className="text-sm font-medium">{artefact.name}</p>
                  <p className="text-xs text-muted-foreground">{artefact.fileName}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100">{getArtefactTypeLabel(artefact.type, artefactTypes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
