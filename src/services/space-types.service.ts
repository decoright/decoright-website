import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import { makeStorageFileName, prepareFileForUpload, validateUploadFile } from '@/utils/file-upload'
import { getCachedValue, setCachedValue } from '@/utils/local-cache'

export type SpaceType = Database['public']['Tables']['space_types']['Row']
export type SpaceTypeInsert = Database['public']['Tables']['space_types']['Insert']
export type SpaceTypeUpdate = Database['public']['Tables']['space_types']['Update']
export type SpaceTypeImage = Database['public']['Tables']['space_type_images']['Row']

export type SpaceTypeWithImages = SpaceType & {
    space_type_images: SpaceTypeImage[]
}

const ACTIVE_SPACE_TYPES_CACHE_KEY = 'cache:space-types:active'
const ACTIVE_SPACE_TYPES_TTL = 5 * 60 * 1000

export const SpaceTypesService = {
    async getAll() {
        const { data, error } = await supabase
            .from('space_types')
            .select('*, space_type_images(id, image_url, sort_order, uploaded_at)')
            .order('name', { ascending: true })

        if (error) throw error
        return (data ?? []) as SpaceTypeWithImages[]
    },

    async getActive() {
        const cached = getCachedValue<SpaceTypeWithImages[]>(ACTIVE_SPACE_TYPES_CACHE_KEY)
        if (cached) return cached

        const { data, error } = await supabase
            .from('space_types')
            .select('*, space_type_images(id, image_url, sort_order, uploaded_at)')
            .eq('is_active', true)
            .order('name', { ascending: true })

        if (error) throw error
        const result = (data ?? []) as SpaceTypeWithImages[]
        setCachedValue(ACTIVE_SPACE_TYPES_CACHE_KEY, result, ACTIVE_SPACE_TYPES_TTL)
        return result
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('space_types')
            .select('*, space_type_images(id, image_url, sort_order, uploaded_at)')
            .eq('id', id)
            .single()

        if (error) throw error
        return data as SpaceTypeWithImages
    },

    async create(spaceType: SpaceTypeInsert) {
        const { data, error } = await supabase
            .from('space_types')
            .insert(spaceType)
            .select()
            .single()

        if (error) throw error
        return data as SpaceType
    },

    async update(id: string, spaceType: SpaceTypeUpdate) {
        const { data, error } = await supabase
            .from('space_types')
            .update(spaceType)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as SpaceType
    },

    async toggleActive(id: string, isActive: boolean) {
        const { data, error } = await supabase
            .from('space_types')
            .update({ is_active: isActive })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data as SpaceType
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('space_types')
            .delete()
            .eq('id', id)

        if (error) throw error
    },

    async uploadImage(file: File): Promise<string> {
        const validation = validateUploadFile(file)
        if (!validation.ok) {
            throw new Error(validation.reason)
        }

        const uploadFile = await prepareFileForUpload(file)
        const filePath = `space-type-images/${makeStorageFileName(uploadFile)}`

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('projects')
            .upload(filePath, uploadFile, {
                contentType: uploadFile.type || file.type,
                upsert: false,
            })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
            .from('projects')
            .getPublicUrl(uploadData.path)

        return publicUrl
    },

    async setImages(spaceTypeId: string, imageUrls: string[]): Promise<void> {
        // Delete all existing images for this space type
        const { error: deleteError } = await supabase
            .from('space_type_images')
            .delete()
            .eq('space_type_id', spaceTypeId)

        if (deleteError) throw deleteError

        if (imageUrls.length === 0) return

        const rows = imageUrls.map((url, index) => ({
            space_type_id: spaceTypeId,
            image_url: url,
            sort_order: index,
        }))

        const { error: insertError } = await supabase
            .from('space_type_images')
            .insert(rows)

        if (insertError) throw insertError
    },
}
