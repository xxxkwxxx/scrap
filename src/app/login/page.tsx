'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { MessageSquare, ArrowRight, Lock, Mail } from 'lucide-react'
import Link from 'next/link'

export default function Login() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const router = useRouter()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })

        if (error) {
            setMessage(error.message)
        } else {
            setMessage('Magic link sent! Check your email.')
        }
        setLoading(false)
    }

    return (
        <div className="flex min-h-screen w-full">
            {/* Left Side - Visual */}
            <div className="hidden lg:flex w-1/2 bg-gray-900 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-gray-900 to-black z-0" />
                <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-green-500/20 blur-3xl animate-pulse-slow" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-3xl" />

                <div className="relative z-10 p-12 text-white max-w-lg">
                    <div className="mb-6 inline-flex items-center justify-center p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                        <MessageSquare className="h-8 w-8 text-green-400" />
                    </div>
                    <h1 className="text-5xl font-bold mb-6 leading-tight">
                        Turn Chaos into <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Clarity</span>
                    </h1>
                    <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                        AI-powered summaries for your busy WhatsApp groups. never miss a beat, no matter how fast the conversation flows.
                    </p>
                    <div className="flex space-x-4">
                        <div className="h-2 w-12 rounded-full bg-green-500" />
                        <div className="h-2 w-2 rounded-full bg-gray-600" />
                        <div className="h-2 w-2 rounded-full bg-gray-600" />
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-950 relative">
                <div className="absolute inset-0 bg-hero-pattern opacity-5 pointer-events-none" />

                <div className="w-full max-w-md space-y-8 animate-fade-in relative z-10">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                            Welcome back
                        </h2>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            Sign in to access your dashboard
                        </p>
                    </div>

                    <div className="glass-card p-8 rounded-2xl shadow-xl">
                        <form className="space-y-6" onSubmit={handleLogin}>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Email address
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl leading-5 bg-white/50 dark:bg-gray-900/50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-all duration-200"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg shadow-green-500/30 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Sign in with Magic Link
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </button>

                            {message && (
                                <div className={`p-4 rounded-xl text-sm text-center font-medium animate-slide-up ${message.includes('Check')
                                    ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
                                    : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
                                    }`}>
                                    {message}
                                </div>
                            )}
                        </form>

                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700/50 text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Don&apos;t have an account?{' '}
                                <Link href="/signup" className="font-medium text-green-600 hover:text-green-500 transition-colors">
                                    Create one for free
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
