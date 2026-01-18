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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);

            if (user) {
                // Get the ID token result which contains custom claims
                try {
                    const tokenResult = await user.getIdTokenResult();
                    setIsDeveloper(tokenResult.claims.isDeveloper === true);
                } catch (e) {
                    console.warn('Failed to get ID token claims:', e);
                    setIsDeveloper(false);
                }
            } else {
                setIsDeveloper(false);
            }

            setLoading(false);
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
            {!loading && children}
        </AuthContext.Provider>
    );
};
