import { supabase } from '@/lib/supabase'
import { prepareFileForUpload, validateUploadFile } from '@/utils/file-upload'
import { getCachedValue, setCachedValue } from '@/utils/local-cache'

export interface SiteSetting {
    id: string
    key: string
    value: string
    description: string | null
    updated_at: string | null
}

const SITE_SETTINGS_CACHE_KEY = 'cache:site-settings:all'
const SITE_SETTINGS_TTL = 10 * 60 * 1000

export const SiteSettingsService = {
    async getAll() {
        const cached = getCachedValue<Record<string, string>>(SITE_SETTINGS_CACHE_KEY)
        if (cached) return cached

        const { data, error } = await supabase
            .from('site_settings')
            .select('*')

        if (error) throw error

        const settings: Record<string, string> = {}
        data.forEach(s => {
            if (s.key && s.value !== null) settings[s.key] = s.value
        })
        setCachedValue(SITE_SETTINGS_CACHE_KEY, settings, SITE_SETTINGS_TTL)
        return settings
    },

    async update(key: string, value: string) {
        const { data, error } = await supabase
            .from('site_settings')
            .upsert({ key, value }, { onConflict: 'key' })
            .select()
            .single()

        if (error) throw error
        const cached = getCachedValue<Record<string, string>>(SITE_SETTINGS_CACHE_KEY) || {}
        setCachedValue(SITE_SETTINGS_CACHE_KEY, { ...cached, [key]: value }, SITE_SETTINGS_TTL)
        return data
    },

    async uploadLogo(file: File): Promise<string> {
        const validation = validateUploadFile(file)
        if (!validation.ok) {
            throw new Error(validation.reason)
        }

        const uploadFile = await prepareFileForUpload(file)
        const ext = uploadFile.name.split('.').pop()
        const path = `logo/logo.${ext}`

        // Upsert: overwrite any existing logo file
        const { error: uploadError } = await supabase.storage
            .from('site-assets')
            .upload(path, uploadFile, { upsert: true, contentType: uploadFile.type || file.type })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
            .from('site-assets')
            .getPublicUrl(path)

        const publicUrl = urlData.publicUrl

        // Persist the URL in site_settings so all clients pick it up
        await SiteSettingsService.update('logo_url', publicUrl)

        return publicUrl
    }
}
