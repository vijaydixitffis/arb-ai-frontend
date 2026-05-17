import { useEffect } from 'react'
import { useMetadataStore } from '../../stores/metadataStore'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

export default function MetadataManagement() {
  const { domains, artefactTypes, loadMetadata } = useMetadataStore()

  useEffect(() => {
    loadMetadata()
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Metadata Management</h1>
        <p className="text-gray-600">Manage submission steps, domains, artefacts, and checklists</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {domains.map(domain => (
                <div key={domain.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{domain.icon}</span>
                    <div>
                      <p className="font-medium">{domain.name}</p>
                      <p className="text-sm text-gray-500">{domain.description}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Manage</Button>
                </div>
              ))}
              <Button className="mt-4">Add Domain</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Artefact Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {artefactTypes.map(type => (
                <div key={type.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div>
                      <p className="font-medium">{type.label}</p>
                      <p className="text-sm text-gray-500">{type.description}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
              ))}
              <Button className="mt-4">Add Artefact Type</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
