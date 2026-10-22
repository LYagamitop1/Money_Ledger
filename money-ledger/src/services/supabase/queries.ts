import { supabase } from './client';
import type { Person, Transaction } from '../../shared/types';

export const peopleQueries = {
  getAll: async (userId: string): Promise<Person[]> => {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string): Promise<Person | null> => {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  create: async (person: Omit<Person, 'id' | 'created_at'>): Promise<Person> => {
    const { data, error } = await supabase
      .from('people')
      .insert(person)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('people')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const transactionQueries = {
  getByPerson: async (personId: string): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('person_id', personId)
      .order('transaction_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getByUser: async (userId: string): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('transaction_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  create: async (tx: Omit<Transaction, 'id' | 'transaction_at'>): Promise<Transaction> => {
    const { data, error } = await supabase
      .from('transactions')
      .insert(tx)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export async function getUserData(userId: string) {
  const [people, transactions] = await Promise.all([
    peopleQueries.getAll(userId),
    transactionQueries.getByUser(userId),
  ]);
  return { people, transactions };
}