import React, { useState } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { AlertCircle, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react';
import { auth } from '../services/firebase';

/** Plain-language messages for the sign-in errors people actually hit. */
const messageFor = (err: unknown) => {
    const code = err instanceof FirebaseError ? err.code : '';
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
        case 'auth/invalid-email':
            return "That email and password don't match. Check them and try again.";
        case 'auth/too-many-requests':
            return 'Too many attempts. Wait a few minutes, or reset your password.';
        case 'auth/network-request-failed':
            return "You're offline. Connect to the internet and try again.";
        case 'auth/user-disabled':
            return 'This account has been turned off.';
        default:
            return "Couldn't sign in. Try again.";
    }
};

export const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [resetSentTo, setResetSentTo] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (err) {
            console.error(err);
            setError(messageFor(err));
            setLoading(false);
        }
    };

    const handleReset = async () => {
        setError('');
        setResetSentTo(null);
        if (!email.trim()) {
            setError('Enter your email first, then tap "Forgot password?" again.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setResetSentTo(email.trim());
        } catch (err) {
            console.error(err);
            // Don't reveal whether an account exists
            if (err instanceof FirebaseError && err.code === 'auth/user-not-found') setResetSentTo(email.trim());
            else setError(err instanceof FirebaseError && err.code === 'auth/invalid-email' ? 'Enter a valid email address.' : messageFor(err));
        }
    };

    return (
        <main className="min-h-dvh bg-background flex flex-col items-center justify-center px-4 py-10">
            <div className="w-full max-w-sm animate-fade-in">
                <div className="text-center mb-8">
                    <img src="/resources/logo_light.png" alt="" className="size-16 mx-auto mb-4 dark:hidden" />
                    <img src="/resources/logo_dark.png" alt="" className="size-16 mx-auto mb-4 hidden dark:block" />
                    <h1 className="heading-1">Welcome back</h1>
                    <p className="text-muted mt-1">Sign in to Vesta to plan, cook and track together.</p>
                </div>

                <form onSubmit={handleLogin} className="card p-5 md:p-6 space-y-4" noValidate>
                    {error && (
                        <p role="alert" className="rounded-[14px] bg-error-bg text-error text-sm p-3 flex items-start gap-2">
                            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> {error}
                        </p>
                    )}
                    {resetSentTo && (
                        <p role="status" className="rounded-[14px] tile-weight text-sm p-3 flex items-start gap-2">
                            <MailCheck size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                            If {resetSentTo} has an account, a reset link is on its way.
                        </p>
                    )}

                    <label className="block">
                        <span className="block text-sm font-semibold mb-1.5">Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            inputMode="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            className="input w-full"
                            placeholder="you@example.com"
                            required
                        />
                    </label>

                    <div>
                        <div className="flex items-baseline justify-between mb-1.5">
                            <label htmlFor="password" className="text-sm font-semibold">Password</label>
                            <button type="button" onClick={handleReset} className="text-sm font-semibold text-muted hover:text-main underline-offset-2 hover:underline rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
                                Forgot password?
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                className="input w-full !pr-12"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(s => !s)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                aria-pressed={showPassword}
                                className="absolute right-1 top-1/2 -translate-y-1/2 size-10 inline-flex items-center justify-center rounded-full text-muted hover:text-main hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={loading || !email.trim() || !password} className="btn-primary btn-block !mt-6">
                        {loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

            </div>
        </main>
    );
};
