import { useEffect, useState } from 'react'
import { Settings, Save, RotateCcw } from 'lucide-react'
import { useAdminStore } from '../../stores/adminStore'
import type { SystemConfigItem } from '../../types/admin'

const CATEGORY_LABELS: Record<string, string> = {
  llm: 'LLM / AI Provider',
  agent: 'Agent Behaviour',
  workflow: 'Workflow & Sessions',
  general: 'General',
}

const CATEGORY_ORDER = ['llm', 'agent', 'workflow', 'general']

interface ConfigFieldProps {
  item: SystemConfigItem
  onSave: (key: string, value: any, reason: string) => Promise<void>
}

function ConfigField({ item, onSave }: ConfigFieldProps) {
  const [localValue, setLocalValue] = useState<any>(item.config_value)
  const [reason, setReason] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleChange = (raw: any) => {
    setLocalValue(raw)
    setDirty(JSON.stringify(raw) !== JSON.stringify(item.config_value))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(item.config_key, localValue, reason)
      setDirty(false)
      setReason('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setLocalValue(item.config_value)
    setDirty(false)
    setReason('')
  }

  const renderInput = () => {
    if (item.data_type === 'boolean') {
      return (
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => handleChange(!localValue)}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${localValue ? 'bg-teal-500' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${localValue ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-slate-600">{localValue ? 'Enabled' : 'Disabled'}</span>
        </label>
      )
    }
    if (item.data_type === 'number') {
      return (
        <input
          type="number"
          value={localValue}
          step="any"
          onChange={e => handleChange(parseFloat(e.target.value) || 0)}
          className="w-40 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      )
    }
    if (item.data_type === 'select') {
      const options = item.config_key === 'llm.provider'
        ? ['gemini', 'openai', 'openrouter']
        : [localValue]
      return (
        <select value={localValue} onChange={e => handleChange(e.target.value)}
          className="w-48 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <input
        type="text"
        value={typeof localValue === 'string' ? localValue : JSON.stringify(localValue)}
        onChange={e => handleChange(e.target.value)}
        className="w-72 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
    )
  }

  return (
    <div className={`py-4 border-b border-slate-50 last:border-0 ${dirty ? 'bg-amber-50/40 -mx-4 px-4 rounded-lg' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{item.label}</p>
          {item.description && <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>}
          <p className="text-xs text-slate-300 mt-0.5 font-mono">{item.config_key}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {renderInput()}
          {dirty && (
            <>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-36 h-9 px-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 px-3 h-9 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 disabled:opacity-50">
                <Save className="w-3 h-3" />
                {saving ? '…' : 'Save'}
              </button>
              <button onClick={handleReset} title="Reset"
                className="p-2 h-9 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {saved && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
        </div>
      </div>
    </div>
  )
}

export default function ConfigSettings() {
  const { config, configLoading, loadConfig, updateConfig } = useAdminStore()
  const [activeTab, setActiveTab] = useState('llm')

  useEffect(() => { loadConfig() }, [])

  const tabs = CATEGORY_ORDER.filter(c => config[c]?.length > 0)
  const items = config[activeTab] ?? []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">System Configuration</h1>
      </div>
      <p className="text-slate-500 text-sm mb-6 ml-12">
        Tune LLM parameters, agent behaviour, and workflow settings. All changes are audit-logged.
      </p>

      {configLoading ? (
        <div className="flex items-center gap-2 text-slate-400 py-8">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
          Loading config…
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 mb-6">
            {tabs.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg -mb-px transition-colors ${
                  activeTab === cat
                    ? 'border border-b-white border-slate-200 bg-white text-teal-700'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="bg-white border border-slate-200 rounded-xl px-6 py-2">
            {items.map(item => (
              <ConfigField key={item.config_key} item={item} onSave={updateConfig} />
            ))}
            {items.length === 0 && (
              <p className="py-8 text-center text-slate-400 text-sm">No config items in this category.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
