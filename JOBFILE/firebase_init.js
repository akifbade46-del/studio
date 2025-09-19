// Firebase initialization module. Imports Firebase SDKs and attaches them to the global window.
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp, getDocs, writeBatch, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyAAulR2nJQm-4QtNyEqKTnnDPw-iKW92Mc",
            authDomain: "my-job-file-system.firebaseapp.com",
            projectId: "my-job-file-system",
            storageBucket: "my-job-file-system.appspot.com",
            messagingSenderId: "145307873304",
            appId: "1:145307873304:web:d661ea6ec118801b4a136d",
            measurementId: "G-8EHX5K7YHL"
        };

        async function initializeFirebase() {
            try {
                const app = initializeApp(firebaseConfig);
                db = getFirestore(app);
                auth = getAuth(app);
                
                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        const userDocRef = doc(db, 'users', user.uid);
                        let userDoc = await getDoc(userDocRef);
                        
                        if (!userDoc.exists()) {
                            const usersCollectionRef = collection(db, 'users');
                            const userQuerySnapshot = await getDocs(usersCollectionRef);
                            const isFirstUser = userQuerySnapshot.size === 0;

                            const newUser = {
                                email: user.email,
                                displayName: user.displayName || user.email.split('@')[0],
                                role: isFirstUser ? 'admin' : 'user',
                                status: isFirstUser ? 'active' : 'inactive',
                                createdAt: serverTimestamp()
                            };
                            await setDoc(userDocRef, newUser);
                            userDoc = await getDoc(userDocRef);
                        }
                        
                        currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
                        
                        if (currentUser.status === 'inactive') {
                            showLogin();
                            document.getElementById('approval-message').style.display = 'block';
                            document.getElementById('blocked-message').style.display = 'none';
                            signOut(auth);
                            return;
                        }

                        if (currentUser.status === 'blocked') {
                            showLogin();
                            document.getElementById('approval-message').style.display = 'none';
                            document.getElementById('blocked-message').style.display = 'block';
                            signOut(auth);
                            return;
                        }
                        
                        console.log("User logged in:", currentUser);
                        showApp();
                        loadJobFiles();
                        loadClients();
                    } else {
                        currentUser = null;
                        console.log("User logged out");
                        showLogin();
                    }
                });

            } catch (error) {
                console.error("Firebase initialization failed:", error);
                showNotification("Could not connect to the database.", true);
            }
        }

        async function initializeFirebaseAndShowPublicView(jobId) {
            try {
                const app = initializeApp(firebaseConfig);
                db = getFirestore(app);
                await showPublicJobView(jobId);
            } catch (error)
            {
                console.error("Error initializing Firebase for public view:", error);
                document.body.innerHTML = `<div class="p-4 text-center text-red-700 bg-red-100">Could not load job file. Database connection failed.</div>`;
            } finally {
                hideLoader();
            }
        }

        async function showPublicJobView(jobId) {
            try {
                const docId = jobId.replace(/\//g, '_');
                const docRef = doc(db, 'jobfiles', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const publicViewHtml = getPrintViewHtml(data, true); 
                    
                    const publicViewContainer = document.getElementById('public-view-container');
                    publicViewContainer.innerHTML = publicViewHtml;
                } else {
                    document.body.innerHTML = `<div class="p-4 text-center text-yellow-700 bg-yellow-100">Job File with ID "${jobId}" not found.</div>`;
                }
            } catch (error) {
                console.error("Error fetching public job file:", error);
                document.body.innerHTML = `<div class="p-4 text-center text-red-700 bg-red-100">Error loading job file.</div>`;
            }
        }



// Attach Firebase-related functions and variables to window
window.initializeFirebase = initializeFirebase;
window.initializeFirebaseAndShowPublicView = initializeFirebaseAndShowPublicView;
window.showPublicJobView = showPublicJobView;
