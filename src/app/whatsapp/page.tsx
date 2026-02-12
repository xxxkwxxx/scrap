'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCodeComponent from '@/components/QRCode'
import { ArrowLeft, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function WhatsAppPage() {
    const [status, setStatus] = useState<string>('INIT')
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
            } else {
                fetchStatus()
            }
        }
        checkAuth()
    }, [])

    useEffect(() => {
        const checkSessionAndSubscribe = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            // Subscribe to changes
            const channel = supabase
                .channel('system_status_changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*', // Listen to all events
                        schema: 'public',
                        table: 'system_status',
                    },
                    (payload) => {
                        console.log('RT-System: 🔔 Received system status update:', payload)
                        const newData = payload.new as any
                        if (newData && newData.id === 'whatsapp_scraper') {
                            console.log('RT-System: ✅ Updating status to:', newData.status)
                            setStatus(newData.status)
                            setQrCode(newData.qr_code)
                            setLastUpdated(newData.updated_at)
                            setLoading(false) // Ensure UI is not stuck
                        }
                    }
                )
                .subscribe((status, err) => {
                    console.log('RT-System: Subscription status:', status)
                    if (err) console.error('RT-System: Subscription error:', err)
                })

            return () => {
                supabase.removeChannel(channel)
            }
        }
        checkSessionAndSubscribe()
    }, [])

    useEffect(() => {
        // Polling fallback (every 3 seconds)
        const interval = setInterval(() => fetchStatus(true), 3000)

        return () => {
            clearInterval(interval)
        }
    }, [])

    const fetchStatus = async (isPolling = false) => {
        if (!isPolling) setLoading(true)
        const { data } = await supabase
            .from('system_status')
            .select('*')
            .eq('id', 'whatsapp_scraper')
            .single()

        if (data) {
            setStatus(data.status)
            setQrCode(data.qr_code)
            setLastUpdated(data.updated_at)
        }
        if (!isPolling) setLoading(false)
    }

    return (
        <div className="min-h-screen bg-[#050508] text-white font-sans overflow-hidden relative">
            {/* Animated Background */}
            <div className="fixed inset-0 z-0 select-none pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#25D366] rounded-full blur-[120px] opacity-20 animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#4285F4] rounded-full blur-[100px] opacity-20 animate-pulse delay-1000"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto p-8 flex flex-col items-center justify-center min-h-screen">
                <div className="mb-8 w-full flex justify-between items-center">
                    <Link href="/" className="flex items-center text-gray-400 hover:text-white transition-colors duration-200">
                        <ArrowLeft className="h-5 w-5 mr-2" />
                        Back to Dashboard
                    </Link>
                    <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-gray-400">
                        WhatsApp Scraper v1.2
                    </div>
                </div>

                <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-10 flex flex-col items-center relative overflow-hidden group">
                    {/* Hover Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#25D366]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                    <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#25D366] to-[#4285F4] mb-2 tracking-tight">
                        Connect WhatsApp
                    </h1>
                    <p className="text-gray-400 mb-8 text-center max-w-md">
                        Link your device to enable AI-powered summaries and insights.
                    </p>

                    <div className="flex flex-col items-center justify-center space-y-8 w-full">

                        {/* Status Pill */}
                        <div className={`
                            px-4 py-2 rounded-full text-sm font-semibold flex items-center shadow-lg transition-all duration-300
                            ${status === 'READY' ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30' :
                                status === 'QR_READY' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                    'bg-red-500/20 text-red-400 border border-red-500/30'}
                        `}>
                            {status === 'READY' ? <CheckCircle className="h-4 w-4 mr-2" /> :
                                status === 'QR_READY' ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> :
                                    <AlertCircle className="h-4 w-4 mr-2" />}
                            Status: <span className="ml-1 uppercase tracking-wider">{status}</span>
                        </div>

                        {/* Content Area */}
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#25D366]"></div>
                                <p className="mt-4 text-gray-500 text-sm animate-pulse">Checking connection...</p>
                            </div>
                        ) : status === 'READY' ? (
                            <div className="text-center space-y-6 py-8 animate-fade-in-up">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-[#25D366] blur-[40px] opacity-20 rounded-full"></div>
                                    <div className="h-24 w-24 bg-[#25D366]/10 border border-[#25D366]/20 rounded-full flex items-center justify-center mx-auto text-[#25D366] relative z-10 shadow-[0_0_30px_rgba(37,211,102,0.3)]">
                                        <CheckCircle className="h-12 w-12" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xl font-medium text-white">System Operational</p>
                                    <p className="text-gray-400 text-sm mt-1">Ready to process messages</p>
                                </div>
                                <div className="bg-black/20 rounded-lg p-3 border border-white/5 inline-block">
                                    <p className="text-xs text-gray-500 font-mono">
                                        Last Sync: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
                                    </p>
                                </div>

                                <div className="pt-2">
                                    <button
                                        onClick={() => fetchStatus(false)}
                                        className="group relative inline-flex items-center px-6 py-2.5 overflow-hidden rounded-full bg-[#25D366] text-black font-bold text-sm hover:bg-[#20bd5a] transition-all duration-300 shadow-[0_0_20px_rgba(37,211,102,0.4)] hover:shadow-[0_0_30px_rgba(37,211,102,0.6)]"
                                    >
                                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh Status
                                    </button>
                                </div>

                                <div className="pt-4">
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Are you sure you want to disconnect WhatsApp?')) return
                                            setLoading(true)
                                            try {
                                                const res = await fetch('/api/disconnect', { method: 'POST' })
                                                if (!res.ok) throw new Error('Failed to disconnect')
                                                // Status update will come via Realtime, but let's reset loading after a delay
                                                setTimeout(() => setLoading(false), 2000)
                                            } catch (err) {
                                                console.error('Disconnect failed', err)
                                                alert('Failed to disconnect. Please try again.')
                                                setLoading(false)
                                            }
                                        }}
                                        className="text-red-400 hover:text-red-300 text-xs underline transition-colors"
                                    >
                                        Disconnect WhatsApp
                                    </button>
                                </div>
                            </div>
                        ) : status === 'QR_READY' && qrCode ? (
                            <div className="text-center space-y-6 w-full animate-fade-in-up">
                                <div className="bg-white p-4 rounded-2xl shadow-2xl inline-block relative group/qr">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-[#25D366] to-[#4285F4] rounded-2xl blur opacity-25 group-hover/qr:opacity-50 transition duration-500"></div>
                                    <div className="relative bg-white p-2 rounded-xl">
                                        <QRCodeComponent value={qrCode} size={250} />
                                    </div>
                                </div>
                                <div className="max-w-xs mx-auto text-center space-y-2">
                                    <p className="text-white font-medium">Link with WhatsApp</p>
                                    <p className="text-xs text-gray-500">
                                        Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 space-y-4">
                                <div className="inline-block p-4 rounded-full bg-white/5 mb-2">
                                    <RefreshCw className="h-8 w-8 text-gray-500 animate-spin" />
                                </div>
                                <div>
                                    <p className="text-gray-300">Initializing Scraper...</p>
                                    <p className="text-xs text-gray-500 mt-1">Please ensure <code>npm run scraper</code> is running</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-600">
                        &copy; 2026 WhatsApp Summarizer. All rights reserved.
                    </p>
                    <p className="text-[10px] text-red-900/50 mt-2 font-mono">Debug: {status}</p>
                </div>
            </div>
        </div>
    )
}
