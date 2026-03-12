import { supabase } from '@/lib/supabase';

export interface LegalPage {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  title_fr: string;
  content_en: string;
  content_ar: string;
  content_fr: string;
  created_at: string;
  updated_at: string;
}

export const LegalService = {
  async getPageBySlug(slug: string): Promise<LegalPage | null> {
    const { data, error } = await supabase
      .from('legal_pages')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data as LegalPage | null;
  },

  async getPageById(id: string): Promise<LegalPage | null> {
    const { data, error } = await supabase
      .from('legal_pages')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data as LegalPage | null;
  },

  async getAllPages(): Promise<LegalPage[]> {
    const { data, error } = await supabase
      .from('legal_pages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as LegalPage[];
  },

  async updatePage(id: string, updates: Partial<Omit<LegalPage, 'id' | 'created_at' | 'updated_at'>>): Promise<LegalPage> {
    const { data, error } = await supabase
      .from('legal_pages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error('Legal page was not updated. It may not exist or you may not have permission.');
    }

    return data as LegalPage;
  },

  async createPage(page: Omit<LegalPage, 'id' | 'created_at' | 'updated_at'>): Promise<LegalPage> {
    const { data, error } = await supabase
      .from('legal_pages')
      .insert(page)
      .select()
      .single();

    if (error) throw error;
    return data as LegalPage;
  },

  async deletePage(id: string): Promise<void> {
    const { error } = await supabase
      .from('legal_pages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
