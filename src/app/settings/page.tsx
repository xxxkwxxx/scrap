'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Save, Key, RefreshCw, Clock, Bell, Sparkles,
    Check, AlertCircle, Trash2, Plus, Users, User, Hash, Timer,
    Search, ChevronDown
} from 'lucide-react'
import Link from 'next/link'

interface Group {
    id: string
    name: string
}

interface ScheduledSummary {
    id: string
    summary_time: string
    target_type: 'me' | 'number' | 'group'
    target_id: string
    target_name?: string
    is_active: boolean
}

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('')
    const [saveMedia, setSaveMedia] = useState(false)
    const [schedules, setSchedules] = useState<ScheduledSummary[]>([])
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [countdown, setCountdown] = useState<string>('No active schedules')

    // New Schedule Form
    const [showAddForm, setShowAddForm] = useState(false)
    const [newTime, setNewTime] = useState('09:00')
    const [newTargetType, setNewTargetType] = useState<'me' | 'group'>('me')
    const [newTargetId, setNewTargetId] = useState('')
    const [newTargetName, setNewTargetName] = useState('')

    // Group Sync & Search
    const [groupSearch, setGroupSearch] = useState('')
    const [isSyncing, setIsSyncing] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)

    const router = useRouter()

    const calculateCountdown = useCallback(() => {
        if (schedules.length === 0) {
            setCountdown('No active schedules')
            return
        }

        const now = new Date()
        const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes()

        let minDiff = Infinity
        let nextSchedule = null

        schedules.forEach(s => {
            if (!s.is_active) return
            const [hours, minutes] = s.summary_time.split(':').map(Number)
            const scheduleMinutes = hours * 60 + minutes

            let diff = scheduleMinutes - currentTimeInMinutes
            if (diff <= 0) diff += 1440 // Tomorrow

            if (diff < minDiff) {
                minDiff = diff
                nextSchedule = s
            }
        })

        if (nextSchedule) {
            const h = Math.floor(minDiff / 60)
            const m = minDiff % 60
            setCountdown(`${h}h ${m}m remaining`)
        } else {
            setCountdown('No active schedules')
        }
    }, [schedules])

    useEffect(() => {
        fetchSettings()
        const interval = setInterval(calculateCountdown, 30000)
        return () => clearInterval(interval)
    }, [calculateCountdown])

    useEffect(() => {
        calculateCountdown()
    }, [schedules, calculateCountdown])

    const fetchSettings = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            router.push('/login')
            return
        }

        // Fetch User settings (API Key)
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle()

        if (userSettings) {
            setApiKey(userSettings.gemini_api_key || '')
            setSaveMedia(userSettings.save_media || false)
        }

        // Fetch Scheduled Summaries
        const { data: schedData } = await supabase
            .from('scheduled_summaries')
            .select('*')
            .eq('user_id', session.user.id)
            .order('summary_time', { ascending: true })

        if (schedData) setSchedules(schedData)

        // Fetch Groups for Picker
        const { data: groupData } = await supabase
            .from('groups')
            .select('id, name')
            .order('name', { ascending: true })

        if (groupData) setGroups(groupData)

        setLoading(false)
    }

    const handleSyncGroups = async () => {
        setIsSyncing(true)
        try {
            const { error } = await supabase.from('scraper_commands').insert({
                command: 'SYNC_GROUPS',
                payload: {}
            })

            if (error) throw error

            setMessage({ type: 'success', text: 'Group sync requested. Refreshing in 3s...' })
            setTimeout(() => {
                fetchSettings()
                setIsSyncing(false)
            }, 3000)
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Sync failed: ' + err.message })
            setIsSyncing(false)
        }
    }

    const handleAddSchedule = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        let targetId = newTargetId
        let targetName = newTargetName

        if (newTargetType === 'me') {
            targetId = 'me'
            targetName = 'Own Chat'
        } else if (newTargetType === 'group') {
            const group = groups.find(g => g.id === targetId)
            targetName = group?.name || targetId
        }

        const { error } = await supabase
            .from('scheduled_summaries')
            .insert({
                user_id: session.user.id,
                summary_time: newTime,
                target_type: newTargetType,
                target_id: targetId,
                target_name: targetName
            })

        if (error) {
            setMessage({ type: 'error', text: 'Error adding schedule: ' + error.message })
        } else {
            setMessage({ type: 'success', text: 'Schedule added successfully!' })
            setShowAddForm(false)
            fetchSettings()
        }
        setSaving(false)
    }

    const handleDeleteSchedule = async (id: string) => {
        const { error } = await supabase
            .from('scheduled_summaries')
            .delete()
            .eq('id', id)

        if (error) {
            setMessage({ type: 'error', text: 'Error deleting: ' + error.message })
        } else {
            fetchSettings()
        }
    }

    const handleSaveGeneral = async () => {
        setSaving(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: session.user.id,
                gemini_api_key: apiKey,
                save_media: saveMedia
            })

        if (error) {
            setMessage({ type: 'error', text: 'Error saving settings: ' + error.message })
        } else {
            setMessage({ type: 'success', text: 'Settings saved!' })
        }
        setSaving(false)
    }

    const handleMediaToggle = async () => {
        const newState = !saveMedia
        setSaveMedia(newState) // Optimistic update

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        // Auto-save the specific field
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: session.user.id,
                save_media: newState,
                // We must preserve other fields if we use upsert, or use update if row exists.
                // Safest is to upsert with all current state to avoid overwriting with nulls if partial upsert isn't handled well by potential triggers/defaults, 
                // BUT better to just update the specific column if we confirm the row exists. 
                // Since we fetched settings, we assume row exists or we create it.
                // Let's pass API key too just in case.
                gemini_api_key: apiKey
            })

        if (error) {
            console.error('Toggle save error:', error)
            setSaveMedia(!newState) // Revert on error
            setMessage({ type: 'error', text: 'Failed to save setting: ' + error.message })
        } else {
            setMessage({ type: 'success', text: 'Media setting saved!' })
            setTimeout(() => setMessage(null), 2000)
        }
    }

    const filteredGroups = groups.filter(g =>
        g.name && g.name.trim() !== '' &&
        g.name.toLowerCase().includes(groupSearch.toLowerCase())
    )

    if (loading) return (
        <div className="min-h-screen bg-[#050508] flex items-center justify-center">
            <RefreshCw className="h-8 w-8 text-[#4285F4] animate-spin" />
        </div>
    )

    return (
        <div className="min-h-screen bg-[#050508] text-white font-sans relative pb-20">
            {/* Animated Background */}
            <div className="fixed inset-0 z-0 select-none pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#4285F4] rounded-full blur-[120px] opacity-10 animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#25D366] rounded-full blur-[100px] opacity-10 animate-pulse delay-1000"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto p-6 md:p-12">
                <div className="mb-8 flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors group">
                        <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboard
                    </Link>

                    <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-3">
                        <Timer className="h-4 w-4 text-[#4285F4]" />
                        <span className="text-xs font-bold tracking-widest text-[#4285F4] uppercase">Next Summary</span>
                        <span className="text-sm font-mono font-bold text-white transition-all">{countdown}</span>
                    </div>
                </div>

                <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-10 border-b border-white/10 pb-8">
                        <div className="bg-gradient-to-br from-[#25D366] to-[#4285F4] p-3 rounded-2xl shadow-lg shadow-blue-500/20">
                            <Clock className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Automation Engine</h1>
                            <p className="text-gray-400 mt-1">Configure automated reporting schedules and AI targets</p>
                        </div>
                    </div>

                    <div className="space-y-12">
                        {/* Summary Header with Sync Button */}
                        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-[#25D366]" />
                                <div>
                                    <div className="text-sm font-bold text-white">WhatsApp Groups</div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">{groups.length} groups synced</div>
                                </div>
                            </div>
                            <button
                                onClick={handleSyncGroups}
                                disabled={isSyncing}
                                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                                {isSyncing ? 'SYNCING...' : 'SYNC FROM WA'}
                            </button>
                        </div>

                        {/* Schedules Management */}
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Bell className="h-5 w-5 text-purple-400" />
                                    Reporting Schedules
                                </h2>
                                <button
                                    onClick={() => setShowAddForm(!showAddForm)}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 rounded-xl text-xs font-bold text-[#25D366] transition-all"
                                >
                                    <Plus className="h-4 w-4" />
                                    ADD SCHEDULE
                                </button>
                            </div>

                            {/* Add Form */}
                            {showAddForm && (
                                <div className="mb-8 bg-white/5 border border-white/10 rounded-2xl p-6 animate-slide-up">
                                    <form onSubmit={handleAddSchedule} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">TIME</label>
                                            <input
                                                type="time"
                                                value={newTime}
                                                onChange={e => setNewTime(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-[#4285F4] [color-scheme:dark]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">TARGET</label>
                                            <select
                                                value={newTargetType}
                                                onChange={e => setNewTargetType(e.target.value as any)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4285F4]"
                                            >
                                                <option value="me">Me (Self Chat)</option>
                                                <option value="group">WhatsApp Group</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">DESTINATION</label>
                                            {newTargetType === 'me' ? (
                                                <div className="px-4 py-3 bg-white/5 border border-dashed border-white/10 rounded-xl text-sm text-gray-500">
                                                    Your own chat
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    {/* Custom Picker Trigger */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setPickerOpen(!pickerOpen)}
                                                        className="w-full flex items-center justify-between bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4285F4] transition-all hover:bg-black/60"
                                                    >
                                                        <span className="truncate">
                                                            {newTargetId ? (groups.find(g => g.id === newTargetId)?.name || 'Select Group') : 'Select Group...'}
                                                        </span>
                                                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {/* Custom Picker Dropdown */}
                                                    {pickerOpen && (
                                                        <div className="absolute top-full left-0 md:left-auto md:right-0 mt-2 z-50 min-w-[320px] max-w-[400px] bg-[#0A0A0F]/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl shadow-blue-500/10 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                                                            <div className="p-3 border-b border-white/5 bg-white/5">
                                                                <div className="relative">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Search groups..."
                                                                        autoFocus
                                                                        value={groupSearch}
                                                                        onChange={e => setGroupSearch(e.target.value)}
                                                                        onKeyDown={e => e.stopPropagation()}
                                                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#4285F4] transition-all"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="max-h-72 overflow-y-auto p-1.5 custom-scrollbar">
                                                                {filteredGroups.length === 0 ? (
                                                                    <div className="py-8 px-4 text-center">
                                                                        <Users className="h-8 w-8 text-gray-600 mx-auto mb-2 opacity-20" />
                                                                        <div className="text-xs text-gray-500">No groups found</div>
                                                                    </div>
                                                                ) : (
                                                                    filteredGroups.map(g => (
                                                                        <button
                                                                            key={g.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setNewTargetId(g.id);
                                                                                setPickerOpen(false);
                                                                            }}
                                                                            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group/item ${newTargetId === g.id ? 'bg-[#4285F4]/10 text-[#4285F4]' : 'text-gray-300 hover:bg-white/5'}`}
                                                                        >
                                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                                <div className={`p-2 rounded-lg transition-colors ${newTargetId === g.id ? 'bg-[#4285F4]/20 text-[#4285F4]' : 'bg-white/5 text-gray-500 group-hover/item:text-gray-300'}`}>
                                                                                    <Users className="h-4 w-4" />
                                                                                </div>
                                                                                <span className="truncate text-sm font-medium">{g.name}</span>
                                                                            </div>
                                                                            {newTargetId === g.id && (
                                                                                <Check className="h-4 w-4 shrink-0 animate-in zoom-in-50 duration-300" />
                                                                            )}
                                                                        </button>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                type="submit"
                                                disabled={saving || (newTargetType === 'group' && !newTargetId)}
                                                className="w-full bg-white text-black font-bold text-xs py-3 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
                                            >
                                                SAVE
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* List */}
                            <div className="space-y-3">
                                {schedules.length === 0 ? (
                                    <div className="text-center py-12 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                                        <p className="text-gray-500 text-sm">No automated schedules configured yet.</p>
                                    </div>
                                ) : (
                                    schedules.map(s => (
                                        <div key={s.id} className="group bg-white/5 hover:bg-white/[0.08] border border-white/5 rounded-2xl p-5 flex items-center justify-between transition-all">
                                            <div className="flex items-center gap-6">
                                                <div className="text-2xl font-mono font-bold text-white tracking-widest">{s.summary_time}</div>
                                                <div className="h-8 w-[1px] bg-white/10"></div>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${s.target_type === 'me' ? 'bg-blue-500/20 text-blue-400' :
                                                        s.target_type === 'group' ? 'bg-green-500/20 text-green-400' :
                                                            'bg-orange-500/20 text-orange-400'
                                                        }`}>
                                                        {s.target_type === 'me' ? <User className="h-4 w-4" /> :
                                                            s.target_type === 'group' ? <Users className="h-4 w-4" /> :
                                                                <Hash className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-white">{s.target_name || s.target_id}</div>
                                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">{s.target_type}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSchedule(s.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* General Settings */}
                        <section className="pt-8 border-t border-white/10">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-orange-400" />
                                General Settings
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-300">Gemini API Key</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={e => setApiKey(e.target.value)}
                                            placeholder="System default key in use..."
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-10 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4285F4]"
                                        />
                                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    </div>
                                    <p className="text-[10px] text-gray-500">Leave blank to use the centralized server-side API key configuration.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-300">Media Storage</label>
                                    <div className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-xl">
                                        <span className="text-sm text-gray-400">Save incoming media</span>
                                        <button
                                            onClick={handleMediaToggle}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4285F4] focus:ring-offset-2 focus:ring-offset-black ${saveMedia ? 'bg-[#25D366]' : 'bg-gray-700'}`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${saveMedia ? 'translate-x-6' : 'translate-x-1'}`}
                                            />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500">
                                        Automatically upload images/videos to 'media' bucket. <br />
                                        <span className="text-orange-400 font-bold">⚠️ Requires 'media' bucket in Supabase.</span>
                                    </p>
                                </div>
                            </div>

                            <div className="mt-10 flex items-center justify-between">
                                {message && (
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                        }`}>
                                        {message.type === 'success' ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                        {message.text}
                                    </div>
                                )}
                                <div className="flex-1"></div>
                                <button
                                    onClick={handleSaveGeneral}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#4285F4] to-[#25D366] rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    SAVE SETTINGS
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
