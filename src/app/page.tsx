'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, MessageSquare, RefreshCw, Settings, Search, Layers, Sparkles, MonitorSmartphone } from 'lucide-react'
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

export default function Dashboard() {
    const [session, setSession] = useState<Session | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'others' | 'mine'>('all')
    const router = useRouter()

    const ownerName = "Kw" // Fixed for now, could be dynamic from session/scraper status

    useEffect(() => {
        const checkUserAndFetchData = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setSession(session)
            if (!session) {
                router.push('/login')
            } else {
                fetchData()
            }
        }
        checkUserAndFetchData()
    }, [])

    useEffect(() => {
        if (!session) return

        const channel = supabase
            .channel('dashboard_messages')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' }, // Listen for ALL events to be safe
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setMessages((prev) => [payload.new as Message, ...prev])
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [session])

    const fetchData = async () => {
        setLoading(true)
        const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(200)

        if (msgs) setMessages(msgs)

        const { data: grps } = await supabase
            .from('groups')
            .select('*')

        if (grps) setGroups(grps)
        setLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const formatSender = (sender: string) => {
        let clean = sender.replace(/@s\.whatsapp\.net|@c\.us|@lid|@g\.us/g, '')
        // User requested removing "WhatsApp User [ID]" mask.
        // Returning raw number/ID if no name is available.
        return clean
    }

    const filteredMessages = messages.filter(msg => {
        const cleanSender = formatSender(msg.sender)
        const content = msg.content || '' // Handle null/undefined content
        const matchesSearch = content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cleanSender.toLowerCase().includes(searchTerm.toLowerCase())

        if (!matchesSearch) return false

        if (filterType === 'mine') return cleanSender === ownerName
        if (filterType === 'others') return cleanSender !== ownerName
        return true
    })

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
                    <Link href="/" className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 bg-[#25D366]/10 text-[#25D366] font-medium">
                        <Layers className="h-4 w-4" />
                        Live Messages
                    </Link>
                    <Link href="/summarizer" className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 text-gray-400 hover:text-white hover:bg-white/5">
                        <Sparkles className="h-4 w-4" />
                        AI Summarizer
                    </Link>

                    <div className="pt-6 pb-2">
                        <h4 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Links</h4>
                    </div>
                    <Link href="/whatsapp" className="flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <MonitorSmartphone className="h-4 w-4" />
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
                {/* Header Actions */}
                <header className="h-16 border-b border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-full max-w-md hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search live feed..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#25D366]/50 focus:ring-1 focus:ring-[#25D366]/20 transition-all placeholder:text-gray-600"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={fetchData}
                            className="flex items-center justify-center h-9 w-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-gray-400 hover:text-white transition-all"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#25D366] to-[#4285F4] p-[1.5px]">
                            <div className="h-full w-full rounded-full bg-black flex items-center justify-center">
                                <span className="text-xs font-bold text-white">
                                    {session.user.email?.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Live Feed Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">

                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h2 className="text-2xl font-bold text-white">Live Feed</h2>
                            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                                <button
                                    onClick={() => setFilterType('all')}
                                    className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'all' ? 'bg-[#25D366] text-black shadow-lg shadow-[#25D366]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilterType('others')}
                                    className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'others' ? 'bg-[#25D366] text-black shadow-lg shadow-[#25D366]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    Others
                                </button>
                                <button
                                    onClick={() => setFilterType('mine')}
                                    className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === 'mine' ? 'bg-[#25D366] text-black shadow-lg shadow-[#25D366]/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    Mine
                                </button>
                            </div>
                            <p className="text-sm text-gray-400">
                                {filteredMessages.length > 0 ? `Showing ${filteredMessages.length} messages` : 'No messages'}
                            </p>
                        </div>

                        {filteredMessages.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center bg-white/5 rounded-2xl border border-white/10 border-dashed">
                                <MessageSquare className="h-10 w-10 text-gray-600 mb-4" />
                                <h3 className="text-lg font-medium text-gray-300">No messages found</h3>
                                <p className="text-gray-500 mt-2">Waiting for new messages...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredMessages.map((msg) => {
                                    // Helper to determine display name
                                    const displayName = formatSender(msg.sender);
                                    const isDm = !msg.group_id;

                                    // Initials (First 2 chars of display name)
                                    const initials = displayName.slice(0, 2).toUpperCase();

                                    return (
                                        <div key={msg.id} className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-2xl p-5 transition-all duration-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    {/* Avatar / Initials */}
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold border border-white/10 shadow-inner
                                                        ${isDm ? 'bg-gradient-to-br from-purple-500/20 to-purple-900/20 text-purple-300' : 'bg-gradient-to-br from-blue-500/20 to-blue-900/20 text-blue-300'}
                                                    `}>
                                                        {initials}
                                                    </div>

                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-white/90  text-sm">
                                                                {/* If displayName is the same as the raw ID (1203...), maybe format it? But user asked to removed "WhatsApp User 897".
                                                                    If we really can't find a name, showing the raw number/ID is better than a generic alias per user request.
                                                                */}
                                                                {displayName}
                                                            </p>
                                                            {msg.group_id ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                                    {groups.find(g => g.id === msg.group_id)?.name || 'Group'}
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                                    DM
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 mt-0.5">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap pl-13 ml-13">
                                                {(() => {
                                                    const content = msg.content || '';

                                                    const imageMatch = content.match(/\(Media: (https?:\/\/[^\s)]+)\)/) || content.match(/\[IMAGE\] (https?:\/\/[^\s]+)/);
                                                    const videoMatch = content.match(/\[VIDEO\] (https?:\/\/[^\s]+)/);
                                                    const audioMatch = content.match(/\[AUDIO\/VOICE MESSAGE\] (https?:\/\/[^\s]+)/);

                                                    const cleanContent = content
                                                        .replace(/\(Media: https?:\/\/[^\s)]+\)/, '')
                                                        .replace(/\[IMAGE\] https?:\/\/[^\s]+/, '')
                                                        .replace(/\[VIDEO\] https?:\/\/[^\s]+/, '')
                                                        .replace(/\[AUDIO\/VOICE MESSAGE\] https?:\/\/[^\s]+/, '')
                                                        .replace(/\[AUDIO\/VOICE MESSAGE\]/, '')
                                                        .trim();

                                                    return (
                                                        <div className="space-y-2">
                                                            {imageMatch && (
                                                                <div className="mb-2 mt-1">
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img
                                                                        src={imageMatch[1]}
                                                                        alt="Image"
                                                                        className="max-w-xs md:max-w-sm rounded-lg border border-white/10 shadow-lg"
                                                                        loading="lazy"
                                                                    />
                                                                </div>
                                                            )}

                                                            {videoMatch && (
                                                                <div className="mb-2 mt-1">
                                                                    <video
                                                                        controls
                                                                        className="max-w-xs md:max-w-sm rounded-lg border border-white/10 shadow-lg"
                                                                        preload="metadata"
                                                                    >
                                                                        <source src={videoMatch[1]} />
                                                                        Your browser does not support the video tag.
                                                                    </video>
                                                                </div>
                                                            )}

                                                            {audioMatch && (
                                                                <div className="mb-2 mt-1">
                                                                    <audio
                                                                        controls
                                                                        className="w-full max-w-xs"
                                                                    >
                                                                        <source src={audioMatch[1]} />
                                                                        Your browser does not support the audio tag.
                                                                    </audio>
                                                                </div>
                                                            )}

                                                            {(cleanContent && cleanContent !== '[STICKER]' && cleanContent !== '[CALL LOG]') ? (
                                                                <p className="text-gray-100 whitespace-pre-wrap break-words leading-relaxed text-[15px]">
                                                                    {cleanContent}
                                                                </p>
                                                            ) : (
                                                                <span className="text-gray-400 italic text-sm">
                                                                    {imageMatch ? "📸 Image attached" :
                                                                        videoMatch ? "🎥 Video attached" :
                                                                            audioMatch ? "🎵 Audio attached" :
                                                                                msg.content?.includes('[STICKER]') ? "✨ Sticker" :
                                                                                    msg.content?.includes('[CALL LOG]') ? "📞 Call Log" :
                                                                                        "Empty message"}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
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
