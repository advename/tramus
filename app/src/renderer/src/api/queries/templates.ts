import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getApiClient, unwrap } from '../client'
import { queryKeys } from '../queryKeys'
import type { Template, TemplateInput, VideoSummary } from '../types'

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates.all(),
    queryFn: async (): Promise<Template[]> => unwrap(await getApiClient().GET('/api/templates'))
  })
}

/** Saves the setup of an open video session as a new template. */
export function useCreateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; video_id: string }): Promise<Template> =>
      unwrap(await getApiClient().POST('/api/templates', { body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.templates.all() })
  })
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (template: TemplateInput): Promise<Template> =>
      unwrap(
        await getApiClient().PUT('/api/templates/{template_id}', {
          params: { path: { template_id: template.id } },
          body: template
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.templates.all() })
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (templateId: string): Promise<void> => {
      const { error, response } = await getApiClient().DELETE('/api/templates/{template_id}', {
        params: { path: { template_id: templateId } }
      })
      if (error !== undefined || !response.ok) {
        unwrap({ error: error ?? { detail: 'Could not delete the template.' }, response })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.templates.all() })
  })
}

/** Applies a template to several videos at once (writes their sidecars). */
export function useApplyTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (args: { templateId: string; videoIds: string[] }): Promise<VideoSummary[]> =>
      unwrap(
        await getApiClient().POST('/api/templates/{template_id}/apply', {
          params: { path: { template_id: args.templateId } },
          body: { video_ids: args.videoIds }
        })
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.video.all() })
  })
}
