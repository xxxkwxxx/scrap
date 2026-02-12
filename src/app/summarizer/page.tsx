'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, MessageSquare, RefreshCw, Settings, Search, User, Users, Calendar, Sparkles, Layers, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Session } from '@supabase/supabase-js'

type Message = {
    id: number
    group_id: string
    sender: string
    content: string
    timestamp: string
    created_at: string
}

type Group = {
    id: string
    name: string
}

export default function SummarizerPage() {
    const [session, setSession] = useState<Session | null>(null)
    const [groups, setGroups] = useState<Group[]>([])
    const [messages, setMessages] = useState<Message[]>([])
    // We fetch messages just to get unique senders for the filter dropdown

    // Filters
    const [summaryGroup, setSummaryGroup] = useState<string>('all')
    const [summarySender, setSummarySender] = useState<string>('all')
    const [summaryDate, setSummaryDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [generatedSummary, setGeneratedSummary] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [loading, setLoading] = useState(true)

    const router = useRouter()

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setSession(session)
            if (!session) {
                router.push('/login')
            } else {
                fetchData()
            }
        }
        checkAuth()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        const { data: grps } = await supabase
            .from('groups')
            .select('*')

        if (grps) setGroups(grps)

        // Fetch recent messages to populate sender list
        // In a real app with millions of messages, you'd use a robust search/filter API or distinct query
        const { data: msgs } = await supabase
            .from('messages')
            .select('sender')
            .order('timestamp', { ascending: false })
            .limit(500) // Limit to recent 500 for sender suggestions

        if (msgs) setMessages(msgs as any)

        setLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const handleSummarize = async () => {
        setIsGenerating(true)
        setGeneratedSummary(null)
        try {
            const res = await fetch('/api/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId: summaryGroup,
                    sender: summarySender,
                    startDate: summaryDate,
                    endDate: summaryDate
                }),
            })
            const data = await res.json()
            if (data.success) {
                setGeneratedSummary(data.summary)
            } else {
                alert('Summarization failed: ' + (data.message || data.error))
            }
        } catch (error) {
            console.error(error)
            alert('Error connecting to server')
        } finally {
            setIsGenerating(false)
        }
    }

    // Helper to format sender names (reused logic)
    const formatSender = (sender: string) => {
        let clean = sender.replace(/@s\.whatsapp\.net|@c\.us|@lid/g, '')
        const isRawId = /^\d{10,}$/.test(clean);
        if (isRawId) return `User ${clean.slice(-4)}`
        return clean
    }

    const uniqueSenders = useMemo(() => {
        const senders = new Set(messages.map(m => m.sender))
        return Array.from(senders)
    }, [messages])

    if (!session) return null

    return (
        <div className="min-h-screen bg-[#050508] text-white font-sans overflow-hidden relative flex flex-col md:flex-row">
            {/* Animated Background */}
            <div className="fixed inset-0 z-0 select-none pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#4285F4] rounded-full blur-[120px] opacity-10 animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#25D366] rounded-full blur-[100px] opacity-10 animate-pulse delay-1000"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
            </div>

            {/* Sidebar / Navigation */}
            <aside className="w-full md:w-64 bg-black/20 backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/10 z-20 flex flex-col shrink-0">
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-[#25D366] to-[#4285F4] p-2 rounded-xl">
                            <MessageSquare className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            Summarizer
                        </span>
                    </div>
                </div>

                <div className="p-4 space-y-2 flex-1 overflow-y-auto">
                    <Link href="/" className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/5">
                        <Layers className="h-4 w-4" />
                        Live Messages
                    </Link>
                    <Link href="/summarizer" className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 bg-[#4285F4]/10 text-[#4285F4] font-medium">
                        <Sparkles className="h-4 w-4" />
                        AI Summarizer
                    </Link>

                    <div className="pt-6 pb-2">
                        <h4 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Links</h4>
                    </div>
                    <Link href="/whatsapp" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <ActivityIndicator />
                        <span className="font-medium">Connection Status</span>
                    </Link>
                    <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <Settings className="h-4 w-4" />
                        <span className="font-medium">Settings</span>
                    </Link>
                </div>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Log Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 relative z-10 flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden">
                <header className="h-16 border-b border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4 flex-1">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[#4285F4]" />
                            AI Insight Generator
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#25D366] to-[#4285F4] p-[1.5px]">
                            <div className="h-full w-full rounded-full bg-black flex items-center justify-center">
                                <span className="text-xs font-bold text-white">
                                    {session.user.email?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Controls */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 sticky top-4">
                                <h3 className="text-lg font-semibold mb-4 text-white">Filters</h3>

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center gap-2">
                                            <Calendar className="h-4 w-4" /> Date
                                        </label>
                                        <input
                                            type="date"
                                            value={summaryDate}
                                            onChange={(e) => setSummaryDate(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#4285F4]/50 focus:outline-none"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center gap-2">
                                            <Users className="h-4 w-4" /> Group
                                        </label>
                                        <select
                                            value={summaryGroup}
                                            onChange={(e) => setSummaryGroup(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#4285F4]/50 focus:outline-none"
                                        >
                                            <option value="all">All Groups</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-400 flex items-center gap-2">
                                            <User className="h-4 w-4" /> Sender
                                        </label>
                                        <select
                                            value={summarySender}
                                            onChange={(e) => setSummarySender(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-[#4285F4]/50 focus:outline-none"
                                        >
                                            <option value="all">All Senders</option>
                                            {uniqueSenders.map(s => (
                                                <option key={s} value={s}>{formatSender(s).slice(0, 20)}...</option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleSummarize}
                                        disabled={isGenerating}
                                        className="w-full flex justify-center items-center gap-2 bg-[#4285F4] hover:bg-[#3367d6] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <RefreshCw className="animate-spin h-4 w-4" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4" />
                                                Generate Summary
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Results */}
                        <div className="lg:col-span-2">
                            {generatedSummary ? (
                                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 animate-fade-in-up">
                                    <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Sparkles className="h-5 w-5 text-[#4285F4]" />
                                            AI Summary
                                        </h3>
                                        <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-400">
                                            {new Date().toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="prose prose-invert max-w-none">
                                        <div className="whitespace-pre-wrap text-gray-300 leading-relaxed text-sm">
                                            {generatedSummary}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-[400px] flex flex-col items-center justify-center text-center border-2 border-white/5 border-dashed rounded-2xl p-8">
                                    <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                        <Sparkles className="h-8 w-8 text-gray-600" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-300">Ready to Analyze</h3>
                                    <p className="text-gray-500 mt-2 max-w-sm">
                                        Select your filters on the left and click &quot;Generate Summary&quot; to get AI-powered insights from your chats.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

function ActivityIndicator() {
    return (
        <div className="relative">
            <div className="h-2 w-2 min-w-[8px] bg-[#25D366] rounded-full"></div>
            <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-75"></div>
        </div>
    )
}
