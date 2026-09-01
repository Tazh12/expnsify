import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { uid } from './format';

export async function uploadReceipt(
  localUri: string,
  userId: string,
  mimeType = 'image/jpeg',
): Promise<string | null> {
  try {
    const res = await fetch(localUri);
    const blob = await res.blob();
    const ext = mimeType.includes('pdf') ? 'pdf' : 'jpg';
    const path = `users/${userId}/receipts/${uid()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: mimeType });
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.error('uploadReceipt failed', e);
    return localUri;
  }
}
