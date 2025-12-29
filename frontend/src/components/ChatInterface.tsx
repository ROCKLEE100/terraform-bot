import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bot, User, Sparkles, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { CodePreview } from './CodePreview';
import { ApprovalControls } from './ApprovalControls';
import clsx from 'clsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatState {
    messages: string[];
    terraform_config: string;
    validate_result: string;
    approve_result: string;
    next_action: string;
    waiting_for_approval: boolean;
    waiting_for_missing_info: boolean;
    missing_question: string;
    security_severity: string;
    security_issues: string;
    waiting_for_security_review: boolean;
}

interface ChatInterfaceProps {
    user: any;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ user }) => {
    const [input, setInput] = useState('');
    const [threadId, setThreadId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [chatState, setChatState] = useState<ChatState | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, chatState]);

    useEffect(() => {
        let interval: number;
        if (threadId && (loading || chatState?.waiting_for_approval || chatState?.waiting_for_missing_info || chatState?.waiting_for_security_review)) {
            interval = setInterval(checkStatus, 2000);
        }
        return () => clearInterval(interval);
    }, [threadId, loading, chatState?.waiting_for_approval, chatState?.waiting_for_missing_info, chatState?.waiting_for_security_review]);

    const checkStatus = async () => {
        if (!threadId) return;
        try {
            const res = await axios.get(`${API_URL}/chat/${threadId}`);
            const data = res.data;

            const isInternalJSON = (content: string) => {
                const trimmed = content.trim();
                // Check if it's a JSON object (possibly multi-line)
                if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                    try {
                        JSON.parse(trimmed);
                        return true;
                    } catch (e) {
                        return false;
                    }
                }
                // Check if it's a markdown code block containing JSON
                if (trimmed.startsWith('```') && trimmed.endsWith('```') && trimmed.includes('{') && trimmed.includes('}')) {
                    return true;
                }
                return false;
            };

            const msgs: Message[] = data.messages
                .filter((m: any) => !isInternalJSON(m.content))
                .map((m: any) => ({
                    role: m.role,
                    content: m.content
                }));
            setMessages(msgs);
            setChatState(data);

            if (data.waiting_for_approval || data.waiting_for_missing_info || data.waiting_for_security_review) {
                setLoading(false);
            } else if (data.next_action === 'end') {
                setLoading(false);
            }
        } catch (err) {
            console.error("Error polling status:", err);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        setLoading(true);
        const userMsg = input;
        setInput('');

        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);

        try {
            if (!threadId) {
                const res = await axios.post(`${API_URL}/chat`, { message: userMsg });
                setThreadId(res.data.thread_id);
            } else if (chatState?.waiting_for_missing_info) {
                await axios.post(`${API_URL}/chat/${threadId}/missing_info`, { answer: userMsg });
                await checkStatus();
            } else {
                alert("Please refresh to start a new task.");
                setLoading(false);
            }
        } catch (err) {
            console.error("Error sending message:", err);
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!threadId) return;
        setLoading(true);
        try {
            await axios.post(`${API_URL}/chat/${threadId}/approve`, { approved: true });
            await checkStatus();
        } catch (err) {
            console.error("Error approving:", err);
            setLoading(false);
        }
    };

    const handleRevise = async () => {
        if (!threadId) return;
        setLoading(true);
        try {
            await axios.post(`${API_URL}/chat/${threadId}/approve`, { approved: false });
            await checkStatus();
        } catch (err) {
            console.error("Error requesting revision:", err);
            setLoading(false);
        }
    };

    const handleSecurityDecision = async (action: 'fix' | 'ignore') => {
        if (!threadId) return;
        setLoading(true);
        try {
            await axios.post(`${API_URL}/chat/${threadId}/security`, { action });
            await checkStatus();
        } catch (err) {
            console.error("Error sending security decision:", err);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] glass-panel rounded-3xl overflow-hidden relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative z-10">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-80">
                        <div className="relative">
                            <div className="absolute -inset-4 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-magenta-500/20 flex items-center justify-center border border-white/10 relative backdrop-blur-sm">
                                <Sparkles className="text-cyan-400" size={40} />
                            </div>
                        </div>
                        {user ? (
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                                    Welcome, {user.name}
                                </h2>
                                <p className="text-gray-400 font-light max-w-md">
                                    I'm your AI infrastructure architect. Describe your needs, and I'll generate production-ready Terraform code.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-gray-400 font-light">Please login to start a conversation.</p>
                                <button
                                    onClick={() => window.location.href = `${API_URL}/login`}
                                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium transition-all shadow-lg shadow-cyan-500/20"
                                >
                                    Login with Google
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <AnimatePresence>
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={clsx(
                                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/5",
                                msg.role === 'user'
                                    ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white'
                                    : 'bg-[#1e293b] text-cyan-400'
                            )}>
                                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                            </div>

                            <div className={clsx(
                                "max-w-[80%] rounded-2xl p-5 shadow-lg backdrop-blur-md",
                                msg.role === 'user'
                                    ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-50 rounded-tr-none'
                                    : 'bg-[#1e293b]/80 border border-white/5 text-gray-300 rounded-tl-none'
                            )}>
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <ReactMarkdown>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {chatState?.terraform_config && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="ml-14"
                    >
                        <CodePreview
                            files={chatState.terraform_config as unknown as Record<string, string>}
                            threadId={threadId}
                        />
                    </motion.div>
                )}

                {chatState?.security_issues && (
                    <div className="ml-14">
                        <div className={clsx(
                            "mt-4 p-4 rounded-xl border backdrop-blur-md",
                            chatState.security_severity === 'HIGH' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                        )}>
                            <h4 className="font-bold mb-2 flex items-center gap-2">
                                Security Scan: {chatState.security_severity}
                            </h4>
                            <pre className="text-xs whitespace-pre-wrap font-mono">
                                {chatState.security_issues}
                            </pre>

                            {chatState.waiting_for_security_review && (
                                <div className="flex gap-3 mt-4">
                                    <button
                                        onClick={() => handleSecurityDecision('fix')}
                                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
                                    >
                                        Fix Issues
                                    </button>
                                    <button
                                        onClick={() => handleSecurityDecision('ignore')}
                                        className="px-4 py-2 bg-white/5 text-white rounded-lg text-sm font-medium hover:bg-white/10 transition-colors border border-white/10"
                                    >
                                        Ignore & Proceed
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {chatState?.waiting_for_approval && (
                    <div className="ml-14 mt-6">
                        <ApprovalControls
                            onApprove={handleApprove}
                            onRevise={handleRevise}
                            disabled={loading}
                        />
                    </div>
                )}

                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3 text-gray-400 ml-14"
                    >
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <span className="text-sm font-medium text-cyan-400/80">Processing request...</span>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-[#0f172a]/80 border-t border-white/5 backdrop-blur-xl relative z-20">
                <div className="relative flex gap-3 max-w-4xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={!user ? "Please login to chat..." : chatState?.waiting_for_missing_info ? "Answer the question above..." : "Describe your infrastructure needs..."}
                        className="flex-1 bg-[#1e293b]/50 text-gray-100 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 border border-white/5 placeholder-gray-500 transition-all shadow-inner hover:bg-[#1e293b]/80"
                        disabled={!user || loading || (!!threadId && !chatState?.next_action.includes('end') && !chatState?.waiting_for_approval && !chatState?.waiting_for_missing_info && !chatState?.waiting_for_security_review)}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!user || loading || !input.trim() || (!!threadId && !chatState?.next_action.includes('end') && !chatState?.waiting_for_approval && !chatState?.waiting_for_missing_info && !chatState?.waiting_for_security_review)}
                        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl px-6 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 active:scale-95 flex items-center justify-center"
                    >
                        <ArrowRight size={24} />
                    </button>
                </div>
            </div>
        </div >
    );
};
