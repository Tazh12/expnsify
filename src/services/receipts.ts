import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { uid } from './format';
import { pickReceiptUriToStore, RECEIPT_STORAGE_ENABLED } from './receiptUri';

async function persistLocalCopy(localUri: string, ext: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const base = FileSystem.documentDirectory;
  if (!base) return null;
  try {
    const dir = `${base}receipts/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}${uid()}.${ext}`;
    await FileSystem.copyAsync({ from: localUri, to: dest });
    return dest;
  } catch (e) {
    console.error('persistLocalCopy failed', e);
    return null;
  }
}

async function uriToBlob(uri: string): Promise<Blob> {
  if (Platform.OS !== 'web' && typeof XMLHttpRequest !== 'undefined') {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  }
  const res = await fetch(uri);
  return await res.blob();
}

export async function uploadReceipt(
  localUri: string,
  userId: string | null | undefined,
  mimeType = 'image/jpeg',
): Promise<string | null> {
  if (!RECEIPT_STORAGE_ENABLED) return null;

  const ext = mimeType.includes('pdf') ? 'pdf' : 'jpg';
  const localDurable = await persistLocalCopy(localUri, ext);

  if (!userId) {
    return pickReceiptUriToStore(null, localDurable);
  }

  try {
    const blob = await uriToBlob(localUri);
    const path = `users/${userId}/receipts/${uid()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: mimeType });
    const cloudUrl = await getDownloadURL(storageRef);
    return pickReceiptUriToStore(cloudUrl, localDurable);
  } catch (e) {
    console.error('uploadReceipt failed', e);
    return pickReceiptUriToStore(null, localDurable);
  }
}
