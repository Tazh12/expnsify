import { deleteUser } from 'firebase/auth';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { deleteObject, listAll, ref } from 'firebase/storage';
import { auth, db, storage } from './firebase';

async function deleteCollection(path: [string, string, string]) {
  const snap = await getDocs(collection(db, path[0], path[1], path[2]));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    if (snap.docs.slice(i, i + 400).length > 0) await batch.commit();
  }
}

export async function deleteAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('You are not signed in.');
  const uid = user.uid;

  await deleteCollection(['users', uid, 'expenses']);
  await deleteCollection(['users', uid, 'categories']);
  await deleteCollection(['users', uid, 'budgetLines']);
  await deleteCollection(['users', uid, 'budgetGroups']);

  try {
    const folder = await listAll(ref(storage, `users/${uid}/receipts`));
    await Promise.all(folder.items.map(item => deleteObject(item)));
  } catch {
    // Storage may be off. The account still gets deleted.
  }

  await deleteUser(user);
}
