import Constants from 'expo-constants';
import type { Category } from '../store/useCategories';

const proxyUrl = (Constants.expoConfig?.extra?.proxyUrl as string | undefined) ?? '';

export interface ScannedExpense {
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category: {
    id: string;
    name: string;
    isNew: boolean;
    suggestedColor?: string;
  };
  note: string | null;
  confidence: number;
}

export async function scanImage(
  imageBase64: string,
  categories: Category[]
): Promise<ScannedExpense | null> {
  try {
    const res = await fetch(`${proxyUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        categories: categories.map(c => ({ id: c.id, name: c.name })),
      }),
    });
    if (!res.ok) return null;
    const json = await res.json() as ScannedExpense;
    return json;
  } catch {
    return null;
  }
}

export async function scanText(
  text: string,
  categories: Category[]
): Promise<ScannedExpense | null> {
  try {
    const res = await fetch(`${proxyUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        categories: categories.map(c => ({ id: c.id, name: c.name })),
      }),
    });
    if (!res.ok) return null;
    return await res.json() as ScannedExpense;
  } catch {
    return null;
  }
}

export async function transcribeAudio(uri: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('audio', {
      uri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as unknown as Blob);

    const res = await fetch(`${proxyUrl}/transcribe`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) return null;
    const json = await res.json() as { text: string };
    return json.text ?? null;
  } catch {
    return null;
  }
}
