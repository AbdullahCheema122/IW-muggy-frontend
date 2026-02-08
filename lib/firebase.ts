import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAGRdrlLCgOe17Be6ZZ-n4gj_YtQ8LQnO8",
  authDomain: "iw-debatecoach.firebaseapp.com",
  projectId: "iw-debatecoach",
  storageBucket: "iw-debatecoach.firebasestorage.app",
  messagingSenderId: "262219636762",
  appId: "1:262219636762:web:31eeedcd5d4927f425b1a3",
  measurementId: "G-0JPRJ435TS",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
