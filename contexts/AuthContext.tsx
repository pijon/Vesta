import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isDeveloper: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isDeveloper: false,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeveloper, setIsDeveloper] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setIsDeveloper(false);
            setLoading(false);

            // The developer claim only gates dev-mode flags, so don't hold up start-up for it:
            // getIdTokenResult() goes to the network whenever the cached token has expired.
            if (user) {
                user.getIdTokenResult()
                    .then(tokenResult => {
                        if (auth.currentUser?.uid === user.uid) {
                            setIsDeveloper(tokenResult.claims.isDeveloper === true);
                        }
                    })
                    .catch(e => console.warn('Failed to get ID token claims:', e));
            }
        });

        return unsubscribe;
    }, []);

    const logout = () => signOut(auth);

    const value = {
        user,
        loading,
        isDeveloper,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
