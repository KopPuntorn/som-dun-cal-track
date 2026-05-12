"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined")
  ? process.env.NEXT_PUBLIC_API_URL
  : "http://localhost:8080/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

type QuickAddCandidate = {
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

type SessionMessage = {
  id?: string;
  role?: string;
  content?: string;
};

const MarkdownRenderer = React.memo(({ content }: { content: string }) => {
  return (
    <div className="markdown-chat">
      <div className="overflow-x-auto no-scrollbar">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
});
MarkdownRenderer.displayName = 'MarkdownRenderer';

export default function AiChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { language } = useLanguage();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [mounted, setMounted] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState<QuickAddCandidate | null>(null);

  const [chatSessions, setChatSessions] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");
  const [isDesktop, setIsDesktop] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const lastFetchedSessionId = useRef<string | null>(null);
  const autoPromptHandledRef = useRef<string | null>(null);

  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const shouldReduceMotion = useReducedMotion();

  const scrollToBottom = useCallback(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  const scrollToBottomSmooth = useCallback(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottomSmooth();
    }
    setMounted(true);
  }, [chatMessages, isAiLoading, showQuickAdd, scrollToBottomSmooth]);

  const handleScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 120;
    isAtBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const el = messagesAreaRef.current;
    if (!el) return;
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [mounted, handleScroll]);

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

  const adjustTextareaHeight = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [chatInput, adjustTextareaHeight]);

  const getAuthToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
  }, []);

  const getAppLang = useCallback(() => {
    if (typeof window === 'undefined') return 'th';
    return localStorage.getItem('app_lang') || 'th';
  }, []);

  const fetchChatSessions = useCallback(async () => {
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
  }, [getAuthToken, user?.id]);

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
        const data: { messages?: SessionMessage[] } = await res.json();
        const messages = Array.isArray(data.messages) ? data.messages : [];
        const history: ChatMessage[] = messages.map((msg) => {
          const content = typeof msg.content === 'string' ? msg.content : '';
          const role = msg.role === 'user' ? 'user' : 'assistant';
          return {
            id: msg.id || (Date.now() + Math.random()).toString(),
            role,
            content: role === 'assistant' ? content.replace(/\[(ADD|FOOD_DATA):[^\]]*?\]/gi, '').trim() : content
          };
        });
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
  }, [fetchChatSessions, user?.id]);

  const groupChatByDate = useCallback((sessionsToGroup: typeof chatSessions) => {
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

    sessionsToGroup.forEach(session => {
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
  }, []);

  const formatSessionTime = (updatedAt: string) => {
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const isSameDay = date.toDateString() === now.toDateString();
    return isSameDay ? format(date, 'HH:mm') : format(date, 'MMM d');
  };

  const extractQuickAddFromResponse = useCallback((assistantContent: string) => {
    const simpleAddRegex = /\[ADD:\s*([^|\]]+?)\s*[|｜]\s*(\d+)(?:\s*kcal)?(?:\s*[|｜]\s*([\d.]+))?(?:\s*[|｜]\s*([\d.]+))?(?:\s*[|｜]\s*([\d.]+))?\s*\]/gi;
    const foodDataRegex = /\[FOOD_DATA:\s*(\{[\s\S]*?\})\s*\]/gi;
    const simpleMatches = [...assistantContent.matchAll(simpleAddRegex)];
    const jsonDataMatches = [...assistantContent.matchAll(foodDataRegex)];

    let quickAdd: QuickAddCandidate | null = null;

    if (simpleMatches.length > 0) {
      const match = simpleMatches[0];
      const protein = match[3] ? parseFloat(match[3]) : undefined;
      const hasCarbs = typeof match[5] !== 'undefined';
      const carbs = hasCarbs ? (match[4] ? parseFloat(match[4]) : undefined) : undefined;
      const fat = hasCarbs ? (match[5] ? parseFloat(match[5]) : undefined) : (match[4] ? parseFloat(match[4]) : undefined);
      quickAdd = {
        foodName: match[1].trim(),
        calories: parseInt(match[2], 10),
        protein,
        carbs,
        fat
      };
    } else if (jsonDataMatches.length > 0) {
      try {
        const foodObj = JSON.parse(jsonDataMatches[0][1]);
        quickAdd = {
          foodName: foodObj.name,
          calories: foodObj.calories,
          protein: foodObj.protein,
          carbs: foodObj.carbs,
          fat: foodObj.fat
        };
      } catch {
        quickAdd = null;
      }
    }

    const cleanedContent = assistantContent.replace(/\[(ADD|FOOD_DATA):[^\]]*?\]/gi, '').trim();

    return {
      quickAdd,
      displayContent: cleanedContent || (
        quickAdd
          ? (language === 'th'
              ? 'ฉันเตรียมข้อมูลอาหารไว้ให้แล้ว คุณสามารถบันทึกต่อได้ทันที'
              : 'I prepared the nutrition details so you can log this right away.')
          : ''
      )
    };
  }, [language]);

  const runChatPrompt = useCallback(async (prompt: string) => {
    const messageToSend = prompt.trim();
    if (!messageToSend || !user?.id) return;

    if (window.innerWidth < 1024) {
      inputRef.current?.blur();
    }

    setChatMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: messageToSend }
    ]);
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

      if (!res.ok) {
        let errorCode = '';
        try {
          const errorData = await res.json();
          errorCode = typeof errorData?.code === 'string' ? errorData.code : '';
        } catch {
          errorCode = '';
        }

        if (res.status === 403 && (errorCode === 'LIMIT_REACHED' || errorCode === 'PRO_REQUIRED')) {
          return;
        }

        throw new Error('chat_request_failed');
      }

      const data = await res.json();
      const assistantContent = typeof data.response === 'string' ? data.response : '';
      const { quickAdd, displayContent } = extractQuickAddFromResponse(assistantContent);

      if (quickAdd) {
        setShowQuickAdd(quickAdd);
      }

      if (displayContent) {
        setChatMessages((prev) => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "assistant", content: displayContent }
        ]);
      }

      if (data.sessionId && data.sessionId !== activeSessionId) {
        lastFetchedSessionId.current = data.sessionId;
        setActiveSessionId(data.sessionId);
        localStorage.setItem('active_chat_session', data.sessionId);
        fetchChatSessions();
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: language === 'th'
            ? 'การเชื่อมต่อมีปัญหา ลองใหม่อีกครั้งนะ'
            : 'There was a connection issue. Please try again.'
        }
      ]);
    } finally {
      setIsAiLoading(false);
    }
  }, [activeSessionId, extractQuickAddFromResponse, fetchChatSessions, getAppLang, getAuthToken, language, user?.id]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void runChatPrompt(chatInput);
    }
  }, [chatInput, runChatPrompt]);

  const handleRefineQuickAdd = () => {
    if (!showQuickAdd) return;
    const prompt = language === 'th'
      ? `ช่วยปรับค่าของ ${showQuickAdd.foodName} ให้แม่นขึ้นหน่อย ตอนนี้ฉันมีค่า ${showQuickAdd.calories} kcal, โปรตีน ${showQuickAdd.protein || 0}g, คาร์บ ${showQuickAdd.carbs || 0}g, ไขมัน ${showQuickAdd.fat || 0}g`
      : `Please refine the estimate for ${showQuickAdd.foodName}. I currently have ${showQuickAdd.calories} kcal, ${showQuickAdd.protein || 0}g protein, ${showQuickAdd.carbs || 0}g carbs, and ${showQuickAdd.fat || 0}g fat.`;
    setChatInput(prompt);
    setShowQuickAdd(null);
    setTimeout(() => inputRef.current?.focus(), 0);
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
          carbs: showQuickAdd.carbs || 0,
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
    await runChatPrompt(messageToSend);
  };

  useEffect(() => {
    if (!mounted || !user?.id) return;

    const promptFromQuery = searchParams.get("prompt")?.trim();
    if (!promptFromQuery) {
      autoPromptHandledRef.current = null;
      return;
    }

    if (autoPromptHandledRef.current === promptFromQuery) return;

    autoPromptHandledRef.current = promptFromQuery;
    lastFetchedSessionId.current = null;
    setActiveSessionId(null);
    setChatMessages([]);
    localStorage.removeItem("active_chat_session");

    window.requestAnimationFrame(() => {
      void runChatPrompt(promptFromQuery);
      router.replace("/ai-chat");
    });
  }, [mounted, router, runChatPrompt, searchParams, user?.id]);

  const suggestionChips = useMemo(() => [
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
  ], [language]);

  const handleSuggestionClick = (prompt: string) => {
    void runChatPrompt(prompt);
  };

  const activeSessionTitle = chatSessions.find(session => session.id === activeSessionId)?.title;

  const SidebarContent = () => {
    const filteredSessions = chatSessions.filter(session =>
      session.title.toLowerCase().includes(sessionQuery.trim().toLowerCase())
    );

    return (
    <>
      <div className="ai-sidebar-header">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="ai-sidebar-brand-mark">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1715" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            </div>
            <span className="font-bold text-[16px] tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>Somdun AI</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={language === 'th' ? 'ปิดแถบด้านข้าง' : 'Close sidebar'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        </div>

        <div className="ai-sidebar-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.target.value)}
            placeholder={language === 'th' ? 'ค้นหาแชท' : 'Search chats'}
            aria-label={language === 'th' ? 'ค้นหาแชท' : 'Search chats'}
          />
          {sessionQuery && (
            <button
              className="ai-sidebar-clear"
              onClick={() => setSessionQuery("")}
              aria-label={language === 'th' ? 'ล้างการค้นหา' : 'Clear search'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
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
          const grouped = groupChatByDate(filteredSessions);
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
                <div className="ai-sidebar-section">
                  <p className="ai-sidebar-section-label">{section.label}</p>
                  <span className="ai-sidebar-section-count">{sessions.length}</span>
                </div>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group relative flex items-center rounded-xl transition-all h-11 border border-transparent hover:bg-white/5 ${activeSessionId === session.id ? 'active' : ''}`}
                    style={{
                      backgroundColor: activeSessionId === session.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      borderColor: activeSessionId === session.id ? 'var(--panel-border)' : 'transparent'
                    }}
                  >
                    {renamingSessionId === session.id ? (
                      <input
                        className="bg-transparent border-none text-[13px] w-full pr-12 font-medium px-3 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                        style={{ color: 'var(--text-primary)' }}
                        value={renamingTitle}
                        name="sessionTitle"
                        autoComplete="off"
                        aria-label={language === 'th' ? 'เปลี่ยนชื่อแชท' : 'Rename chat'}
                        onChange={(e) => setRenamingTitle(e.target.value)}
                        onBlur={() => handleRenameSession(session.id, renamingTitle)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSession(session.id, renamingTitle);
                          if (e.key === 'Escape') setRenamingSessionId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (renamingSessionId !== session.id) {
                            fetchSessionHistory(session.id);
                            if (!isDesktop) setIsSidebarOpen(false);
                          }
                        }}
                        className="ai-session-button"
                        aria-label={language === 'th' ? `เปิดแชท: ${session.title}` : `Open chat: ${session.title}`}
                      >
                        <span className="text-[13px] truncate flex-1 pr-12 font-medium" style={{ color: activeSessionId === session.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {session.title}
                        </span>
                        <span className="ai-session-meta">{formatSessionTime(session.updatedAt)}</span>
                      </button>
                    )}
                    
                    <div className={`absolute right-2.5 flex items-center gap-1 transition-all ${activeSessionId === session.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}>
                      <button
                        onClick={(e) => startRenaming(e, session)}
                        className="p-1.5 rounded-lg hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label={language === 'th' ? 'เปลี่ยนชื่อแชท' : 'Rename chat'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="p-1.5 rounded-lg hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-label={language === 'th' ? 'ลบแชท' : 'Delete chat'}
                        onMouseOver={(e) => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          });
        })()}
        {filteredSessions.length === 0 && sessionQuery && (
          <div className="ai-sidebar-empty">
            <p className="text-[12px] font-medium leading-relaxed">
              {language === 'th' ? 'ไม่พบแชทที่ค้นหา' : 'No matching chats found'}
            </p>
          </div>
        )}
        {chatSessions.length === 0 && !sessionQuery && (
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
  };

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
          <div className="ai-header-left">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="hidden lg:flex w-10 h-10 -ml-2 rounded-xl items-center justify-center bg-transparent transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                title="Open Sidebar"
                aria-label={language === 'th' ? 'เปิดแถบด้านข้าง' : 'Open sidebar'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              </button>
            )}

            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden w-10 h-10 -ml-1 rounded-full flex items-center justify-center bg-transparent transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              aria-label={language === 'th' ? 'เปิดแถบด้านข้าง' : 'Open sidebar'}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>

            <div className="ai-header-title">
              <div className="ai-header-avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div className="ai-header-text">
                <span className="ai-header-eyebrow ai-header-eyebrow--coach">
                  {language === 'th' ? 'โค้ชโภชนาการ AI' : 'Nutrition Coach'}
                </span>
                <span className="ai-header-session">
                  {activeSessionTitle || (language === 'th' ? 'แชทใหม่' : 'New Chat')}
                </span>
                <span className="ai-header-context">
                  {language === 'th' ? 'อ่านข้อมูลอาหาร น้ำ และกิจกรรมที่คุณบันทึกไว้' : 'Reads your food, hydration, and activity logs'}
                </span>
              </div>
            </div>
          </div>

          <div className="ai-header-actions">
            <button
              onClick={createNewSession}
              className="ai-header-new-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              <span className="ai-header-new-text">{language === 'th' ? 'แชทใหม่' : 'New Chat'}</span>
            </button>
            <button
              onClick={() => router.push('/')}
              className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all text-[13px] font-bold glass-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              {language === 'th' ? 'หน้าหลัก' : 'Home'}
            </button>
          </div>
        </header>

        {/* Chat Content */}
        <div className="ai-chat-messages-area no-scrollbar" ref={messagesAreaRef}>
          <div className="ai-chat-messages-container">
            <AnimatePresence mode="popLayout">
              {chatMessages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="ai-welcome-state"
                >
                  <div className="ai-welcome-shell">
                    <div className="ai-welcome-hero">
                      <div className="ai-welcome-badge">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      </div>
                      <div className="ai-welcome-copy">
                        <p className="ai-welcome-kicker">SOMDUN AI</p>
                        <h1 className="ai-welcome-title">
                          {language === 'th' ? `สวัสดี ${user?.name || 'คุณ'}` : `Hello, ${user?.name || 'there'}`}
                        </h1>
                        <p className="ai-welcome-description">
                          {language === 'th'
                            ? 'ให้ AI ช่วยวิเคราะห์มื้ออาหาร สรุปสิ่งที่ขาดของวันนี้ และเปลี่ยนคำแนะนำให้กลายเป็นการบันทึกได้ทันที'
                            : 'Use AI to analyze meals, spot what today is missing, and turn good answers into logs instantly.'}
                        </p>
                      </div>
                    </div>

                    <div className="ai-welcome-prompts">
                      <div className="ai-welcome-prompts-header">
                        <p className="ai-welcome-prompts-title">{language === 'th' ? 'เริ่มจากงานที่อยากให้ช่วย' : 'Start with the job you need done'}</p>
                        <p className="ai-welcome-prompts-copy">{language === 'th' ? 'เลือกคำสั่งที่ใกล้กับสิ่งที่คุณต้องการที่สุด แล้วค่อยต่อยอดจากตรงนั้น' : 'Pick the closest task, then keep the conversation moving from there.'}</p>
                      </div>
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
                            <div className="suggestion-copy">
                              <p className="suggestion-title">{chip.label}</p>
                              <p className="suggestion-subtitle">{chip.prompt}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-8 w-full mt-auto">
                  {chatMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className={`ai-message-row ${msg.role === "user" ? "user-row" : "assistant-row"}`}
                    >
                      <div className="flex-shrink-0 pt-1">
                        {msg.role === "user" ? (
                          <div className="ai-avatar user">
                            {user?.name?.charAt(0) || "U"}
                          </div>
                        ) : (
                          <div className="ai-avatar assistant">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M12 6v6l4 2"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="ai-message-content">
                        <div className={`ai-message-meta ${msg.role === "user" ? "user" : "assistant"}`}>
                          {msg.role === "user" ? (language === 'th' ? 'คุณ' : 'You') : 'Somdun AI'}
                        </div>
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
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }} className="ai-quick-add-row">
                      <div className="ai-quick-add-card">
                        <div className="ai-quick-add-head">
                          <div>
                            <p className="ai-quick-add-kicker">{language === 'th' ? 'พร้อมบันทึก' : 'Ready to Log'}</p>
                            <h3 className="ai-quick-add-title">{showQuickAdd.foodName}</h3>
                          </div>
                          <span className="ai-quick-add-calories">{showQuickAdd.calories} kcal</span>
                        </div>
                        <p className="ai-quick-add-copy">
                          {language === 'th'
                            ? 'ฉันเตรียมค่าที่พร้อมบันทึกไว้แล้ว ถ้าต้องการฉันช่วยปรับรายละเอียดก่อนก็ค่อยแก้ต่อจากแชทนี้ได้'
                            : 'I prepared a log-ready estimate. If you want, I can refine the details before you save it.'}
                        </p>
                        <div className="ai-quick-add-macros">
                          <div className="ai-quick-add-macro protein">
                            <span className="ai-quick-add-macro-label">Protein</span>
                            <strong>{showQuickAdd.protein || 0}g</strong>
                          </div>
                          <div className="ai-quick-add-macro carbs">
                            <span className="ai-quick-add-macro-label">Carbs</span>
                            <strong>{showQuickAdd.carbs || 0}g</strong>
                          </div>
                          <div className="ai-quick-add-macro fat">
                            <span className="ai-quick-add-macro-label">Fat</span>
                            <strong>{showQuickAdd.fat || 0}g</strong>
                          </div>
                        </div>
                        <div className="ai-quick-add-actions">
                          <button type="button" onClick={handleRefineQuickAdd} className="ai-quick-add-secondary">
                            {language === 'th' ? 'ปรับค่าก่อน' : 'Refine First'}
                          </button>
                          <button type="button" onClick={handleQuickAdd} className="ai-quick-add-primary">
                            {language === 'th' ? 'บันทึกรายการนี้' : 'Log This Food'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {isAiLoading && (
                    <div className="flex gap-4 w-full">
                      <div className="ai-loading-avatar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      </div>
                      <div className="flex items-center gap-1.5 py-3">
                        <div className="ai-thinking-dot animate-bounce [animation-delay:-0.3s]" />
                        <div className="ai-thinking-dot animate-bounce [animation-delay:-0.15s]" />
                        <div className="ai-thinking-dot animate-bounce" />
                      </div>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} className="h-4" />
                </div>
              )}
            </AnimatePresence>
          </div>
          {showScrollToBottom && (
            <button
              className="ai-scroll-bottom"
              onClick={scrollToBottom}
              aria-label={language === 'th' ? 'เลื่อนลงด้านล่าง' : 'Scroll to bottom'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="7 13 12 18 17 13" />
                <line x1="12" y1="6" x2="12" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Input Bar Fixed Bottom */}
        <div className="ai-chat-input-container">
          <div className="ai-chat-input-pill-wrapper">
            <div className="ai-chat-input-pill">
              <textarea
                ref={inputRef}
                rows={1}
                placeholder={language === "th" ? "ถามเรื่องอาหาร แคลอรี่ หรือสุขภาพ…" : "Ask about food, calories, or health…"}
                className="ai-chat-textarea"
                value={chatInput}
                name="chatMessage"
                autoComplete="off"
                aria-label={language === 'th' ? 'พิมพ์ข้อความ' : 'Type a message'}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                disabled={isAiLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={isAiLoading || !chatInput.trim()}
                className="ai-chat-send-btn"
                aria-label={language === 'th' ? 'ส่งข้อความ' : 'Send message'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
              </button>
            </div>
            <div className="ai-chat-input-hint">
              <span>{language === 'th' ? 'Somdun อาจผิดพลาดได้ ตรวจสอบข้อมูลสำคัญก่อนบันทึกเสมอ' : 'Somdun can make mistakes, so verify important details before logging.'}</span>
              <span>{language === 'th' ? 'กด Enter เพื่อส่ง และ Shift + Enter เพื่อขึ้นบรรทัดใหม่' : 'Press Enter to send and Shift + Enter for a new line.'}</span>
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
                <button className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white active:scale-95 transition-all" style={{ background: 'var(--danger)' }} onClick={confirmDeleteSession}>{language === 'th' ? 'ลบ' : 'Delete'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
