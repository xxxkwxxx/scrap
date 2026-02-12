'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Key, RefreshCw, Clock, Bell, Sparkles, Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('')
    const [summaryTime, setSummaryTime] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const router = useRouter()

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/login')
            return
        }

        const { data } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle()

        if (data) {
            setApiKey(data.gemini_api_key || '')
            setSummaryTime(data.summary_time || '')
        }
        setLoading(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: session.user.id,
                gemini_api_key: apiKey,
                summary_time: summaryTime,
            })

        if (error) {
            setMessage({ type: 'error', text: 'Error saving settings: ' + error.message })
        } else {
            setMessage({ type: 'success', text: 'Settings saved successfully!' })
        }
        setSaving(false)
    }

    if (loading) return null

    return (
        <div className="min-h-screen bg-[#050508] text-white font-sans overflow-hidden relative">
            {/* Animated Background */}
            <div className="fixed inset-0 z-0 select-none pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#4285F4] rounded-full blur-[120px] opacity-20 animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#25D366] rounded-full blur-[100px] opacity-20 animate-pulse delay-1000"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto p-6 md:p-12">
                <div className="mb-8">
                    <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors group">
                        <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboard
                    </Link>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl">
                    <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
                        <div className="bg-gradient-to-br from-[#25D366] to-[#4285F4] p-3 rounded-2xl shadow-lg shadow-blue-500/20">
                            <Key className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">System Configuration</h1>
                            <p className="text-gray-400 mt-1">Manage your AI preferences and automation settings</p>
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="space-y-8">
                        {/* Daily Summary Section */}
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className="bg-purple-500/20 p-2 rounded-lg">
                                    <Clock className="h-5 w-5 text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="summaryTime" className="block text-lg font-semibold text-white mb-2">
                                        Daily Summary Schedule
                                    </label>
                                    <p className="text-sm text-gray-400 mb-4">
                                        Select a time to receive an automatic AI summary of your day&apos;s conversations directly in your own chat (Note to Self).
                                    </p>
                                    <div className="relative max-w-xs">
                                        <input
                                            type="time"
                                            name="summaryTime"
                                            id="summaryTime"
                                            value={summaryTime}
                                            onChange={(e) => setSummaryTime(e.target.value)}
                                            className="block w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#4285F4]/50 focus:border-transparent transition-all [color-scheme:dark]"
                                        />
                                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                            <Bell className="h-4 w-4 text-gray-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* API Key Section */}
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors opacity-75 grayscale hover:grayscale-0 hover:opacity-100 duration-300">
                            <div className="flex items-start gap-4">
                                <div className="bg-orange-500/20 p-2 rounded-lg">
                                    <Sparkles className="h-5 w-5 text-orange-400" />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="apiKey" className="block text-lg font-semibold text-white mb-2">
                                        Custom Gemini API Key (Optional)
                                    </label>
                                    <p className="text-sm text-gray-400 mb-4">
                                        Override the system default API key. Leave blank to use the default configuration.
                                    </p>
                                    <input
                                        type="password"
                                        name="apiKey"
                                        id="apiKey"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="AIzaSy..."
                                        className="block w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Messages & Actions */}
                        <div className="flex items-center justify-between pt-6 border-t border-white/10">
                            <div className="flex-1 mr-4">
                                {message && (
                                    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in ${message.type === 'success'
                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                        {message.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                        {message.text}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-[#25D366] to-[#4285F4] hover:shadow-lg hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {saving ? (
                                    <>
                                        <RefreshCw className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="-ml-1 mr-2 h-5 w-5" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
