import { supabase } from '@/lib/supabase';

export type DeletionRequestStatus = 'pending' | 'done';

export interface DeletionRequest {
  id: string;
  email: string;
  message: string | null;
  status: string;
  created_at: string;
}

export const DeletionRequestService = {
  async getAll(): Promise<DeletionRequest[]> {
    const { data, error } = await supabase
      .from('deletion_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as DeletionRequest[];
  },

  async updateStatus(id: string, status: DeletionRequestStatus): Promise<void> {
    const { error } = await supabase
      .from('deletion_requests')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('deletion_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
