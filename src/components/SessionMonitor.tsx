'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SessionMonitor() {
    const router = useRouter();
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [warningDismissed, setWarningDismissed] = useState(false);

    useEffect(() => {
        const checkSession = () => {
            const getCookie = (name: string) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift();
            };

            const expiryStr = getCookie('session-expiry');
            if (!expiryStr) return;

            const expiryTime = parseInt(expiryStr);
            if (isNaN(expiryTime)) return;

            const now = Date.now();
            const diff = expiryTime - now;

            // If expired or close to expiring
            if (diff <= 0) {
                // Expired - Trigger Save and Redirect
                console.log('[SESSION] Expired. Triggering auto-save before logout...');
                window.dispatchEvent(new Event('save-request'));

                // Show "Saving..." feedback (optional but good UI)
                const toast = document.createElement('div');
                toast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-xl z-[100] animate-fadeIn';
                toast.innerHTML = '<div class="flex items-center gap-2"><svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Guardando sesión...</div>';
                document.body.appendChild(toast);

                setTimeout(() => {
                    router.push('/login');
                }, 2000); // Wait 2s for save to complete
            } else if (diff < 120 * 1000) { // Less than 2 minutes
                setTimeLeft(Math.floor(diff / 1000));
                if (!warningDismissed) {
                    setShowWarning(true);
                }
            } else {
                setShowWarning(false);
                setWarningDismissed(false); // Reset if session extended/refreshed
            }
        };

        // Check every second
        const timer = setInterval(checkSession, 1000);
        checkSession(); // Initial check

        return () => clearInterval(timer);
    }, [router, warningDismissed]);

    if (!showWarning || timeLeft === null) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl border-l-4 border-yellow-500">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-yellow-100 rounded-full text-yellow-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Cierre de sesión inminente</h3>
                        <p className="text-slate-600 text-sm mb-4">
                            Tu sesión de seguridad finalizará en <span className="font-bold text-slate-900">{timeLeft} segundos</span>.
                            Guardá tus cambios.
                        </p>
                        <button
                            onClick={() => {
                                setShowWarning(false);
                                setWarningDismissed(true);
                            }}
                            className="w-full btn btn-secondary text-sm"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
