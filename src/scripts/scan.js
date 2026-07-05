import { initializeApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
}, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  console.log('Signing in anonymously...');
  try {
    await signInAnonymously(auth);
    console.log('Signed in successfully.');
    
    console.log('Fetching active vehicles...');
    const q = query(collection(db, 'vehicles'), where('status', '==', 'inside'));
    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} active vehicles.`);
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Doc ID: ${doc.id} | Plate: "${data.plateNumber}" | Raw: "${data.plateNumberRaw}" | Garage: "${data.garageId}" | Type: "${data.type}"`);
    });
  } catch (err) {
    console.error('Error scanning database:', err);
  }
}

run();
