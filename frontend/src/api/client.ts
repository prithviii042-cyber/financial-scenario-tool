import axios from 'axios'
import type {
  UploadResponse,
  FinancialAnalysis,
  ScenarioRequest,
  ScenarioResult,
  ExternalIndicator,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min for AI analysis
})

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<UploadResponse>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const analyzeFile = async (fileId: string): Promise<FinancialAnalysis> => {
  const { data } = await api.post<FinancialAnalysis>('/analysis', { file_id: fileId })
  return data
}

export const computeScenario = async (request: ScenarioRequest): Promise<ScenarioResult> => {
  const { data } = await api.post<ScenarioResult>('/scenarios/compute', request)
  return data
}

export const fetchExternalIndicators = async (): Promise<ExternalIndicator[]> => {
  const { data } = await api.get<ExternalIndicator[]>('/external/indicators')
  return data
}
