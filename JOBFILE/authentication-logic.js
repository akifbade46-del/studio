// Module for Authentication Logic
        async function handleSignUp(email, password, displayName) {
            showLoader();
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                showNotification("Account created! Please wait for admin approval.", false);
                await signOut(auth);
                toggleAuthView(true);
            } catch (error) {
                console.error("Sign up error:", error);
                showNotification(error.message, true);
            }
            hideLoader();
        }

        async function handleLogin(email, password) {
            showLoader();
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error("Login error:", error);
                let message = "Login failed. Please check your email and password.";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    message = "Incorrect email or password. Please try again or reset your password.";
                }
                showNotification(message, true);
            }
            hideLoader();
        }
        
        async function handleForgotPassword() {
            const email = document.getElementById('reset-email').value.trim();
            if (!email) {
                showNotification("Please enter your email address.", true);
                return;
            }
            showLoader();
            try {
                await sendPasswordResetEmail(auth, email);
                hideLoader();
                closeModal('forgot-password-modal');
                showNotification("Password reset link sent! Check your email inbox.", false);
            } catch (error) {
                hideLoader();
                console.error("Password reset error:", error);
                let message = "Could not send reset link. Please try again.";
                if(error.code === 'auth/user-not-found'){
                    message = "No account found with this email address.";
                }
                showNotification(message, true);
            }
        }

        function handleLogout() {
            signOut(auth);
        }

