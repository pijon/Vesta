import { useRegisterSW } from 'virtual:pwa-register/react'

export function ReloadPrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r)
        },
        onRegisterError(error) {
            console.log('SW registration error', error)
        },
    })

    const close = () => setNeedRefresh(false)

    return (
        <div className="ReloadPrompt-container">
            {needRefresh && (
                <div className="fixed bottom-4 right-4 p-4 bg-charcoal text-stone rounded-xl shadow-lg z-50 flex flex-col gap-2 border border-hearth/50">
                    <div className="text-sm font-bold">New version available!</div>
                    <div className="text-xs opacity-80">Reload to update Vesta.</div>
                    <div className="flex gap-2 mt-1">
                        <button
                            className="bg-hearth text-white px-3 py-1.5 rounded-lg text-xs font-bold"
                            onClick={() => updateServiceWorker(true)}>
                            Reload
                        </button>
                        <button
                            className="bg-transparent border border-white/20 text-stone px-3 py-1.5 rounded-lg text-xs"
                            onClick={close}>
                            Later
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
