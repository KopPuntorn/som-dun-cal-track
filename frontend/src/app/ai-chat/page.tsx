"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined")
  ? process.env.NEXT_PUBLIC_API_URL
  : "http://localhost:8080/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <div className="markdown-chat">
      <div className="overflow-x-auto no-scrollbar">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
};

export default function AiChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [mounted, setMounted] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState<{ foodName: string; calories: number; protein?: number; fat?: number } | null>(null);

  const [chatSessions, setChatSessions] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [isDesktop, setIsDesktop] = useState(true);
  const lastFetchedSessionId = useRef<string | null>(null);

  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    scrollToBottom();
    setMounted(true);
  }, [chatMessages, isAiLoading, showQuickAdd]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSessionId = localStorage.getItem('active_chat_session');
      if (savedSessionId && savedSessionId !== 'null' && savedSessionId !== 'undefined' && !savedSessionId.startsWith('000000')) {
        setActiveSessionId(savedSessionId);
      }

      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (activeSessionId && activeSessionId !== 'null' && !activeSessionId.startsWith('000000') && user?.id) {
      fetchSessionHistory(activeSessionId);
    }
  }, [activeSessionId, user?.id]);

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const adjustTextareaHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [chatInput]);

  const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  };

  const getAppLang = () => {
    if (typeof window === 'undefined') return 'th';
    return localStorage.getItem('app_lang') || 'th';
  };

  const fetchChatSessions = async () => {
    if (!user?.id) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChatSessions(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch chat sessions:", error);
    }
  };

  const createNewSession = () => {
    setActiveSessionId(null);
    setChatMessages([]);
    localStorage.removeItem('active_chat_session');
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    } else {
      inputRef.current?.focus();
    }
  };

  const fetchSessionHistory = async (sessionId: string) => {
    if (!sessionId || sessionId === 'null' || sessionId === lastFetchedSessionId.current) return;
    lastFetchedSessionId.current = sessionId;
    if (!user?.id || sessionId.startsWith('000000')) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const history: ChatMessage[] = (data.messages || []).map((msg: any) => ({
          id: msg.id || (Date.now() + Math.random()).toString(),
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.role === 'assistant' ? msg.content.replace(/\[(ADD|FOOD_DATA):[^\]]*?\]/gi, '').trim() : msg.content
        }));
        setChatMessages(history);
        setActiveSessionId(sessionId);
        localStorage.setItem('active_chat_session', sessionId);
        if (window.innerWidth < 1024) {
          setIsSidebarOpen(false);
        }
      }
    } catch (error) {
      console.error("Failed to fetch session history:", error);
    }
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete || !user?.id) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/chat/sessions/${sessionToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setChatSessions(prev => prev.filter(s => s.id !== sessionToDelete));
        if (activeSessionId === sessionToDelete) {
          setActiveSessionId(null);
          setChatMessages([]);
          localStorage.removeItem('active_chat_session');
        }
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    } finally {
      setSessionToDelete(null);
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim() || !user?.id) {
      setRenamingSessionId(null);
      return;
    }
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (res.ok) {
        setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle.trim() } : s));
      }
    } catch (error) {
      console.error("Failed to rename session:", error);
    } finally {
      setRenamingSessionId(null);
    }
  };

  const startRenaming = (e: React.MouseEvent, session: { id: string, title: string }) => {
    e.stopPropagation();
    setRenamingSessionId(session.id);
    setRenamingTitle(session.title);
  };

  useEffect(() => {
    if (user?.id) { fetchChatSessions(); }
  }, [user]);

  const groupChatByDate = () => {
    const groups: { [key: string]: typeof chatSessions } = {
      today: [],
      yesterday: [],
      previous7Days: [],
      older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    chatSessions.forEach(session => {
      const date = new Date(session.updatedAt);
      if (date >= today) {
        groups.today.push(session);
      } else if (date >= yesterday) {
        groups.yesterday.push(session);
      } else if (date >= sevenDaysAgo) {
        groups.previous7Days.push(session);
      } else {
        groups.older.push(session);
      }
    });

    return groups;
  };

  const handleQuickAdd = async () => {
    if (!showQuickAdd || !user?.id) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/foods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          uid: user.id,
          name: showQuickAdd.foodName,
          calories: showQuickAdd.calories,
          protein: showQuickAdd.protein || 0,
          fat: showQuickAdd.fat || 0,
          mealCategory: 'Snack',
          date: new Date().toISOString()
        })
      });
      if (res.ok) {
        setShowQuickAdd(null);
        window.dispatchEvent(new Event('foodAdded'));
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: `✅ ${language === 'th' ? 'บันทึกสำเร็จ' : 'Logged successfully'}: **${showQuickAdd.foodName}** (${showQuickAdd.calories} kcal).`
        }]);
      }
    } catch (error) {
      console.error("Error Quick Adding food:", error);
    }
  };

  const handleSendMessage = async () => {
    const messageToSend = chatInput.trim();
    if (!messageToSend || !user?.id) return;

    if (window.innerWidth < 1024) {
      inputRef.current?.blur();
    }

    const newMessage: ChatMessage = { id: Date.now().toString(), role: "user", content: messageToSend };
    setChatMessages((prev) => [...prev, newMessage]);
    setChatInput("");
    setIsAiLoading(true);
    setShowQuickAdd(null);
    try {
      const token = getAuthToken();
      const lang = getAppLang();
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          sessionId: activeSessionId && !activeSessionId.startsWith('000000') ? activeSessionId : "",
          messages: [{ role: "user", content: messageToSend }],
          language: lang
        })
      });
      if (res.ok) {
        const data = await res.json();
        let assistantContent = data.response;
        const simpleAddRegex = /\[ADD:\s*([^|\]]+?)\s*[|｜]\s*(\d+)(?:\s*kcal)?(?:\s*[|｜]\s*([\d.]+))?(?:\s*[|｜]\s*([\d.]+))?\s*\]/gi;
        const foodDataRegex = /\[FOOD_DATA:\s*(\{[\s\S]*?\})\s*\]/gi;

        const simpleMatches = [...assistantContent.matchAll(simpleAddRegex)];
        const jsonDataMatches = [...assistantContent.matchAll(foodDataRegex)];

        if (simpleMatches.length > 0) {
          const m = simpleMatches[0];
          setShowQuickAdd({
            foodName: m[1].trim(),
            calories: parseInt(m[2], 10),
            protein: m[3] ? parseFloat(m[3]) : undefined,
            fat: m[4] ? parseFloat(m[4]) : undefined
          });
        } else if (jsonDataMatches.length > 0) {
          try {
            const foodObj = JSON.parse(jsonDataMatches[0][1]);
            setShowQuickAdd({
              foodName: foodObj.name,
              calories: foodObj.calories,
              protein: foodObj.protein,
              fat: foodObj.fat
            });
          } catch (e) { }
        }

        // Robust cleaning using non-greedy regex that stops at each closing bracket
        const finalAssistantContent = assistantContent.replace(/\[(ADD|FOOD_DATA):[^\]]*?\]/gi, '').trim();

        let displayContent = finalAssistantContent;
        if (!displayContent && (simpleMatches.length > 0 || jsonDataMatches.length > 0)) {
          displayContent = language === 'th' ? 'นี่คือข้อมูลโภชนาการที่ฉันพบค่ะ:' : 'Here is the nutrition information I found:';
        }

        if (displayContent) {
          setChatMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: displayContent }]);
        }
        if (data.sessionId && data.sessionId !== activeSessionId) {
          lastFetchedSessionId.current = data.sessionId;
          setActiveSessionId(data.sessionId);
          localStorage.setItem('active_chat_session', data.sessionId);
          fetchChatSessions();
        }
      }
    } catch (error) {
      setChatMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const suggestionChips = [
    { 
      icon: '📊', 
      label: language === 'th' ? 'สรุปโภชนาการวันนี้' : 'Daily Summary', 
      prompt: language === 'th' ? 'ช่วยสรุปโภชนาการที่ฉันกินไปวันนี้หน่อย' : 'Summarize my nutrition for today' 
    },
    { 
      icon: '🍽️', 
      label: language === 'th' ? 'เมนูเย็นแคลต่ำ' : 'Low-Cal Dinner', 
      prompt: language === 'th' ? 'แนะนำเมนูมื้อเย็นสุขภาพดี ไม่เกิน 500 แคลอรี่' : 'Suggest a healthy dinner under 500 kcal' 
    },
    { 
      icon: '💧', 
      label: language === 'th' ? 'เช็คการดื่มน้ำ' : 'Water Intake', 
      prompt: language === 'th' ? 'วันนี้ฉันดื่มน้ำไปเท่าไหร่ และเพียงพอต่อเป้าหมายไหม?' : 'How much water have I had today, and is it enough?' 
    },
    { 
      icon: '🎯', 
      label: language === 'th' ? 'วิเคราะห์เป้าหมาย' : 'Goal Analysis', 
      prompt: language === 'th' ? 'วิเคราะห์น้ำหนักปัจจุบันของฉันกับเป้าหมายที่ตั้งไว้หน่อย' : 'Analyze my current weight vs my goal' 
    },
  ];

  const handleSuggestionClick = (prompt: string) => {
    setChatInput(prompt);
    setTimeout(() => {
      setChatInput('');
      const newMessage: ChatMessage = { id: Date.now().toString(), role: 'user', content: prompt };
      setChatMessages(prev => [...prev, newMessage]);
      setIsAiLoading(true);
      setShowQuickAdd(null);
      (async () => {
        try {
          const token = getAuthToken();
          const lang = getAppLang();
          const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ sessionId: activeSessionId && !activeSessionId.startsWith('000000') ? activeSessionId : "", messages: [{ role: "user", content: prompt }], language: lang })
          });
          if (res.ok) {
            const data = await res.json();
            let assistantContent = data.response;
            const simpleAddRegex = /\[ADD:\s*([^|\]]+?)\s*[|｜]\s*(\d+)(?:\s*kcal)?(?:\s*[|｜]\s*([\d.]+))?(?:\s*[|｜]\s*([\d.]+))?\s*\]/gi;
            const foodDataRegex = /\[FOOD_DATA:\s*(\{[\s\S]*?\})\s*\]/gi;

            const simpleMatches = [...assistantContent.matchAll(simpleAddRegex)];
            const jsonDataMatches = [...assistantContent.matchAll(foodDataRegex)];

            if (simpleMatches.length > 0) {
              const m = simpleMatches[0];
              setShowQuickAdd({ foodName: m[1].trim(), calories: parseInt(m[2], 10), protein: m[3] ? parseFloat(m[3]) : undefined, fat: m[4] ? parseFloat(m[4]) : undefined });
            } else if (jsonDataMatches.length > 0) {
              try {
                const foodObj = JSON.parse(jsonDataMatches[0][1]);
                setShowQuickAdd({ foodName: foodObj.name, calories: foodObj.calories, protein: foodObj.protein, fat: foodObj.fat });
              } catch (e) { }
            }

            // Robust cleaning
            const finalAssistantContent = assistantContent.replace(/\[(ADD|FOOD_DATA):[^\]]*?\]/gi, '').trim();

            let displayContent = finalAssistantContent;
            if (!displayContent && (simpleMatches.length > 0 || jsonDataMatches.length > 0)) {
              displayContent = language === 'th' ? 'นี่คือข้อมูลโภชนาการที่ฉันพบค่ะ:' : 'Here is the nutrition information I found:';
            }
            if (displayContent) {
              setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: displayContent }]);
            }
            if (data.sessionId && data.sessionId !== activeSessionId) {
              lastFetchedSessionId.current = data.sessionId;
              setActiveSessionId(data.sessionId);
              localStorage.setItem('active_chat_session', data.sessionId);
              fetchChatSessions();
            }
          }
        } catch (e) {
          setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Connection error.' }]);
        } finally {
          setIsAiLoading(false);
        }
      })();
    }, 100);
  };

  const SidebarContent = () => (
    <>
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ background: 'var(--accent-cal-gradient)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1715" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            </div>
            <span className="font-bold text-[16px] tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Somdun AI</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        </div>

        <button
          onClick={createNewSession}
          className="flex items-center gap-3 w-full h-11 px-4 rounded-xl transition-all font-semibold text-[14px] shadow-sm glass-btn hover:brightness-110 active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          {language === 'th' ? 'เริ่มแชทใหม่' : 'New Chat'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-6 no-scrollbar pb-6 scroll-smooth">
        {(() => {
          const grouped = groupChatByDate();
          const sections = [
            { key: 'today', label: language === 'th' ? 'วันนี้' : 'Today' },
            { key: 'yesterday', label: language === 'th' ? 'เมื่อวาน' : 'Yesterday' },
            { key: 'previous7Days', label: language === 'th' ? '7 วันที่ผ่านมา' : 'Previous 7 Days' },
            { key: 'older', label: language === 'th' ? 'เก่ากว่านั้น' : 'Older' }
          ];

          return sections.map(section => {
            const sessions = grouped[section.key];
            if (sessions.length === 0) return null;

            return (
              <div key={section.key} className="space-y-1">
                <p className="px-3 text-[11px] font-bold uppercase tracking-widest mb-2 opacity-40" style={{ color: 'var(--text-secondary)' }}>
                  {section.label}
                </p>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => {
                        if (renamingSessionId !== session.id) {
                            fetchSessionHistory(session.id);
                            if (!isDesktop) setIsSidebarOpen(false);
                        }
                    }}
                    className={`group relative flex items-center rounded-xl transition-all cursor-pointer h-10 px-3 border border-transparent hover:bg-white/5`}
                    style={{
                      backgroundColor: activeSessionId === session.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      borderColor: activeSessionId === session.id ? 'var(--panel-border)' : 'transparent'
                    }}
                  >
                    {renamingSessionId === session.id ? (
                      <input
                        autoFocus
                        className="bg-transparent border-none outline-none text-[13px] w-full pr-12 font-medium"
                        style={{ color: 'var(--text-primary)' }}
                        value={renamingTitle}
                        onChange={(e) => setRenamingTitle(e.target.value)}
                        onBlur={() => handleRenameSession(session.id, renamingTitle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSession(session.id, renamingTitle);
                          if (e.key === 'Escape') setRenamingSessionId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-[13px] truncate flex-1 pr-12 font-medium" style={{ color: activeSessionId === session.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {session.title}
                      </span>
                    )}
                    
                    <div className={`absolute right-2 flex items-center gap-0.5 transition-all ${activeSessionId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button
                        onClick={(e) => startRenaming(e, session)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-all outline-none"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-all outline-none"
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          });
        })()}
        {chatSessions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 opacity-30 text-center px-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <p className="text-[12px] font-medium leading-relaxed">{language === 'th' ? 'ยังไม่มีรายการสนทนา' : 'No conversations yet'}</p>
          </div>
        )}
      </div>

      {/* <div className="mt-auto border-t p-3" style={{ borderColor: 'var(--panel-border)' }}>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-3 transition-all w-full px-4 h-11 rounded-xl text-secondary hover:bg-white/5 active:scale-[0.98]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span className="font-semibold text-[13px] whitespace-nowrap">{language === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}</span>
        </button>
      </div> */}
    </>
  );

  if (!mounted) return null;

  return (
    <div className="ai-chat-layout">

      {/* Sidebar (Desktop) */}
      <aside className={`hidden lg:flex ai-chat-sidebar ${!isSidebarOpen ? "collapsed" : ""}`}>
        {isSidebarOpen && <SidebarContent />}
      </aside>

      {/* Main Content Area */}
      <main className="ai-chat-main">

        {/* Header */}
        <header className="ai-chat-header">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="hidden lg:flex w-10 h-10 -ml-2 rounded-xl items-center justify-center bg-transparent transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                title="Open Sidebar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              </button>
            )}

            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden w-10 h-10 -ml-1 rounded-full flex items-center justify-center bg-transparent transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/')}
              className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all text-[13px] font-bold glass-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              {language === 'th' ? 'กลับหน้าหลัก' : 'Home'}
            </button>
          </div>
        </header>

        {/* Chat Content */}
        <div className="ai-chat-messages-area no-scrollbar">
          <div className="ai-chat-messages-container">
            <AnimatePresence mode="popLayout">
              {chatMessages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center w-full mt-auto mb-auto py-10"
                >
                  <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl relative border" style={{ background: 'rgba(130, 166, 125, 0.1)', borderColor: 'rgba(130, 166, 125, 0.2)' }}>
                    <div className="absolute inset-0 blur-xl opacity-20 rounded-[2rem]" style={{ background: 'var(--accent-cal-gradient)' }} />
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cal)" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                  </div>
                  <h1 className="text-3xl font-bold mb-3 tracking-tight text-center">
                    {language === 'th' ? `สวัสดี, ${user?.name || 'User'}` : `Hello, ${user?.name || 'User'}`}
                  </h1>
                  <p className="text-base mb-12 text-center font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {language === 'th' ? 'ให้ฉันช่วยจัดการมื้ออาหารและโภชนาการของคุณ' : 'How can I help you manage your meals today?'}
                  </p>

                  <div className="suggestion-chips-container no-scrollbar">
                    {suggestionChips.map((chip, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(chip.prompt)}
                        className="suggestion-chip"
                      >
                        <div className="suggestion-icon">
                          {chip.icon}
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{chip.label}</p>
                          <p className="text-[12px] line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{chip.prompt}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-8 w-full mt-auto">
                  {chatMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`ai-message-row ${msg.role === "user" ? "user-row" : "assistant-row"}`}
                    >
                      <div className="flex-shrink-0 pt-1">
                        {msg.role === "user" ? (
                          <div className="ai-avatar user">
                            {user?.name?.charAt(0) || "U"}
                          </div>
                        ) : (
                          <div className="ai-avatar assistant">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1715" strokeWidth="2.5">
                              <path d="M12 2L2 7l10 5 10-5-10-5z" />
                              <path d="M2 17l10 5 10-5" />
                              <path d="M2 12l10 5 10-5" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="ai-message-content">
                        <div className="ai-bubble">
                          {msg.role === "user" ? (
                            <p className="text-[15px] whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <MarkdownRenderer content={msg.content} />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Quick Add Card */}
                  {showQuickAdd && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 w-full">
                      <div className="w-8 h-8 flex-shrink-0 pt-1">
                        <div className="ai-avatar assistant">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1715" strokeWidth="2.5">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 flex justify-start max-w-[90%] lg:max-w-[80%]">
                        <div className="quick-add-card">
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-cal)' }} />
                                <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--accent-cal)' }}>{language === 'th' ? 'ข้อมูลโภชนาการ' : 'Nutrition Info'}</span>
                              </div>
                            </div>
                            <h3 className="text-xl font-bold mb-2 leading-tight" style={{ color: 'var(--text-primary)' }}>{showQuickAdd.foodName}</h3>
                            <div className="flex items-baseline gap-1.5 mb-6">
                              <span className="text-4xl font-black bg-clip-text text-transparent" style={{ backgroundImage: 'var(--accent-cal-gradient)' }}>{showQuickAdd.calories}</span>
                              <span className="text-sm font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>kcal</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3.5 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'var(--panel-border)' }}>
                                <p className="text-[11px] font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Protein</p>
                                <div className="flex items-baseline gap-1">
                                  <p className="text-lg font-bold" style={{ color: 'var(--accent-pro)' }}>{showQuickAdd.protein || 0}</p>
                                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>g</span>
                                </div>
                              </div>
                              <div className="p-3.5 rounded-xl border" style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'var(--panel-border)' }}>
                                <p className="text-[11px] font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Fat</p>
                                <div className="flex items-baseline gap-1">
                                  <p className="text-lg font-bold" style={{ color: 'var(--accent-fat)' }}>{showQuickAdd.fat || 0}</p>
                                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>g</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <button onClick={handleQuickAdd} className="quick-add-footer">
                            {language === "th" ? "บันทึกรายการนี้" : "Log Food"}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {isAiLoading && (
                    <div className="flex gap-4 w-full">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md animate-pulse" style={{ background: 'var(--accent-cal-gradient)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1715" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                      </div>
                      <div className="flex items-center gap-1.5 py-3">
                        <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ backgroundColor: 'var(--text-secondary)' }} />
                        <div className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ backgroundColor: 'var(--text-secondary)' }} />
                        <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-secondary)' }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} className="h-4" />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Input Bar Fixed Bottom */}
        <div className="ai-chat-input-container">
          <div className="ai-chat-input-pill-wrapper">
            <div className="ai-chat-input-pill">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder={language === "th" ? "ถามเรื่องอาหาร แคลอรี่ หรือสุขภาพ..." : "Ask about food, calories, or health..."}
                className="ai-chat-textarea"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                disabled={isAiLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isAiLoading || !chatInput.trim()}
                className="ai-chat-send-btn"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
              </button>
            </div>
            <div className="mt-3 text-center h-4">
              <p className="text-[11px] font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>Somdun can make mistakes. Verify important information.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && !isDesktop && (
          <div className="lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ai-chat-mobile-overlay"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="ai-chat-mobile-sidebar"
            >
              <SidebarContent />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {sessionToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-[320px] rounded-3xl p-6 text-center shadow-2xl glass-panel">
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{language === 'th' ? 'ลบแชทนี้?' : 'Delete Chat?'}</h3>
              <p className="text-[14px] mb-6 font-medium" style={{ color: 'var(--text-secondary)' }}>{language === 'th' ? 'ประวัติแชทนี้จะไม่สามารถกู้คืนได้' : 'This conversation cannot be recovered.'}</p>
              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl text-[14px] font-semibold active:scale-95 transition-all glass-btn" onClick={() => setSessionToDelete(null)}>{language === 'th' ? 'ยกเลิก' : 'Cancel'}</button>
                <button className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white active:scale-95 transition-all" style={{ backgroundColor: 'var(--danger)' }} onClick={confirmDeleteSession}>{language === 'th' ? 'ลบ' : 'Delete'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
