import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import { makeStorageFileName, prepareFileForUpload, validateUploadFile } from '@/utils/file-upload'
import { getCachedValue, setCachedValue } from '@/utils/local-cache'

export type ServiceType = Database['public']['Tables']['service_types']['Row']
export type ServiceTypeInsert = Database['public']['Tables']['service_types']['Insert']
export type ServiceTypeUpdate = Database['public']['Tables']['service_types']['Update']

const ACTIVE_SERVICE_TYPES_CACHE_KEY = 'cache:service-types:active'
const ACTIVE_SERVICE_TYPES_TTL = 5 * 60 * 1000

export const ServiceTypesService = {
    async getAll() {
        const { data, error } = await supabase
            .from('service_types')
            .select('*')

        if (error) throw error
        return data as ServiceType[]
    },

    async getActive() {
        const cached = getCachedValue<ServiceType[]>(ACTIVE_SERVICE_TYPES_CACHE_KEY)
        if (cached) return cached

        const { data, error } = await supabase
            .from('service_types')
            .select('*')
            .eq('is_active', true)

        if (error) throw error
        const result = data as ServiceType[]
        setCachedValue(ACTIVE_SERVICE_TYPES_CACHE_KEY, result, ACTIVE_SERVICE_TYPES_TTL)
        return result
    },

    async create(payload: ServiceTypeInsert) {
        const { data, error } = await supabase
            .from('service_types')
            .insert(payload)
            .select()
            .single()

        if (error) throw error
        return data as ServiceType
    },

    async update(id: string, payload: ServiceTypeUpdate) {
        const { data, error } = await supabase
            .from('service_types')
            .update(payload)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as ServiceType
    },

    async toggleActive(id: string, isActive: boolean) {
        const { data, error } = await supabase
            .from('service_types')
            .update({ is_active: isActive })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as ServiceType
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('service_types')
            .delete()
            .eq('id', id)

        if (error) throw error
    },

    async getUsageCount(id: string): Promise<{ requests: number; projects: number }> {
        const [{ count: requests }, { count: projects }] = await Promise.all([
            supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('service_type_id', id),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('service_type_id', id),
        ])
        return { requests: requests ?? 0, projects: projects ?? 0 }
    },

    async uploadImage(file: File) {
        const validation = validateUploadFile(file)
        if (!validation.ok) {
            throw new Error(validation.reason)
        }

        const uploadFile = await prepareFileForUpload(file)
        const fileName = makeStorageFileName(uploadFile)
        const filePath = `service-icons/${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('service-types')
            .upload(filePath, uploadFile, {
                contentType: uploadFile.type || file.type,
                upsert: false,
            })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
            .from('service-types')
            .getPublicUrl(filePath)

        return publicUrl
    }
}
