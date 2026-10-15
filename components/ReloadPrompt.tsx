import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect, useRef } from 'react'

export function ReloadPrompt() {
    const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r)
            registration.current = r
        },
        onRegisterError(error) {
            console.log('SW registration error', error)
        },
    })

    useEffect(() => {
        const updateSW = () => {
            if (registration.current) {
                console.log('Checking for SW update...')
                registration.current.update()
            }
        }

        // Check for updates on focus/visibility change
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateSW()
            }
        }

        window.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', updateSW)

        // Check every hour
        const interval = setInterval(updateSW, 60 * 60 * 1000)

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', updateSW)
            clearInterval(interval)
        }
    }, [])

    const close = () => setNeedRefresh(false)

    return (
        <div className="ReloadPrompt-container">
            {needRefresh && (
                <div role="status" className="fixed top-4 right-4 left-4 sm:left-auto sm:w-80 p-4 bg-ink text-on-ink rounded-[20px] shadow-[var(--elev-md)] z-[100] flex flex-col gap-1 animate-fade-in">
                    <p className="font-semibold">A new version of Vesta is ready</p>
                    <p className="text-sm text-on-ink-muted">Reload to get it. It only takes a moment.</p>
                    <div className="flex gap-2 mt-2">
                        <button
                            className="btn-sm rounded-full font-bold px-4 bg-on-ink text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-ink)]"
                            onClick={() => updateServiceWorker(true)}>
                            Reload
                        </button>
                        <button
                            className="btn-sm rounded-full font-semibold px-4 text-on-ink hover:bg-on-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-ink)]"
                            onClick={close}>
                            Later
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
