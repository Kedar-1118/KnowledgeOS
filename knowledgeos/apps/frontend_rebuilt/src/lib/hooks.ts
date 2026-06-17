import { useQuery } from '@tanstack/react-query'
import { api } from './api'

export function useRecommendations() {
  return useQuery(['recommendations'], async () => {
    const res = await api.get('/api/recommendations')
    return res.data
  })
}
