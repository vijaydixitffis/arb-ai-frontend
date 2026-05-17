import { create } from 'zustand'
import { metadataService, Domain, ArtefactType, ArtefactTemplate, ChecklistSubsection, EAPrinciple, FormField, QuestionOption } from '../services/backendConfig'

interface MetadataState {
  domains: Domain[]
  artefactTypes: ArtefactType[]
  artefactTemplatesByDomain: Record<string, ArtefactTemplate[]>
  checklistSubsectionsByDomain: Record<string, ChecklistSubsection[]>
  ptxGates: { value: string; label: string }[]
  architectureDispositions: { value: string; label: string }[]
  eaPrinciples: EAPrinciple[]
  eaPrinciplesByDomain: Record<string, EAPrinciple[]>
  formFieldsByStep: Record<string, FormField[]>
  questionOptionsByQuestion: Record<string, QuestionOption[]>
  questionOptions: QuestionOption[]
  loading: boolean
  error: string | null
  
  loadMetadata: () => Promise<void>
  loadDomainMetadata: (domainSlug: string) => Promise<void>
  loadStepMetadata: (stepId: string) => Promise<void>
  loadEAPrinciplesForDomain: (domainSlug: string) => Promise<void>
  getDomainBySeqNumber: (seqNumber: number) => Domain | undefined
  getDomainBySlug: (slug: string) => Domain | undefined
}

export const useMetadataStore = create<MetadataState>((set, get) => ({
  domains: [],
  artefactTypes: [],
  artefactTemplatesByDomain: {},
  checklistSubsectionsByDomain: {},
  ptxGates: [],
  architectureDispositions: [],
  eaPrinciples: [],
  eaPrinciplesByDomain: {},
  formFieldsByStep: {},
  questionOptionsByQuestion: {},
  questionOptions: [],
  loading: false,
  error: null,

  loadMetadata: async () => {
    set({ loading: true, error: null })
    try {
      const metadata = await metadataService.getAllMetadata()
      set({ 
        ...metadata, 
        loading: false 
      })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  },

  loadDomainMetadata: async (domainSlug: string) => {
    set({ loading: true, error: null })
    try {
      const [artefactTemplates, checklistSubsections] = await Promise.all([
        metadataService.getArtefactTemplates(domainSlug),
        metadataService.getChecklistSubsections(domainSlug)
      ])
      
      set(state => ({
        artefactTemplatesByDomain: {
          ...state.artefactTemplatesByDomain,
          [domainSlug]: artefactTemplates
        },
        checklistSubsectionsByDomain: {
          ...state.checklistSubsectionsByDomain,
          [domainSlug]: checklistSubsections
        },
        loading: false
      }))
    } catch (error) {
      set({ error: 'Failed to load domain metadata', loading: false })
    }
  },

  loadStepMetadata: async (stepId: string) => {
    set({ loading: true, error: null })
    try {
      const formFields = await metadataService.getFormFields(stepId)
      
      set(state => ({
        formFieldsByStep: {
          ...state.formFieldsByStep,
          [stepId]: formFields
        },
        loading: false
      }))
    } catch (error) {
      set({ error: 'Failed to load step metadata', loading: false })
    }
  },

  loadEAPrinciplesForDomain: async (domainSlug: string) => {
    set({ loading: true, error: null })
    try {
      const eaPrinciples = await metadataService.getEAPrinciplesForDomain(domainSlug)
      
      set(state => ({
        eaPrinciplesByDomain: {
          ...state.eaPrinciplesByDomain,
          [domainSlug]: eaPrinciples
        },
        loading: false
      }))
    } catch (error) {
      set({ error: 'Failed to load EA principles for domain', loading: false })
    }
  },

  getDomainBySeqNumber: (seqNumber: number) => {
    return get().domains.find(domain => domain.seq_number === seqNumber)
  },

  getDomainBySlug: (slug: string) => {
    return get().domains.find(domain => domain.slug === slug)
  }
}))
