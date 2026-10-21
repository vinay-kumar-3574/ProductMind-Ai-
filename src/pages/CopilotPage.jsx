import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import {
  BotMessageSquare,
  Sparkles,
  Send,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  User,
  Check,
  Lightbulb,
} from 'lucide-react'
import { Card, Badge, Button, Modal } from '../components/common'

export function CopilotPage() {
  const {
    copilotChats,
    sendMessageToCopilot,
    newCopilotChat,
    deleteCopilotChat,
    clearCopilotChat,
    addToast,
  } = useApp()

  const [activeChatId, setActiveChatId] = useState(() => copilotChats[0]?.id || '')
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const messagesEndRef = useRef(null)

  const activeChat = copilotChats.find(c => c.id === activeChatId) || copilotChats[0]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeChat?.messages, isTyping])

  const handleSend = async (textToSend = inputText) => {
    if (!textToSend.trim() || !activeChat) return

    const query = textToSend.trim()
    setInputText('')
    setIsTyping(true)

    await sendMessageToCopilot(activeChat.id, query)
    setIsTyping(false)
  }

  const handleNewChat = () => {
    const id = newCopilotChat(`Strategy Session ${copilotChats.length + 1}`)
    setActiveChatId(id)
    addToast('New Copilot session created', 'info')
  }

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text)
    addToast('Copied to clipboard', 'info')
  }

  const suggestedPrompts = [
    'Summarize customer feedback',
    'Identify the biggest customer pain points',
    'Recommend features to prioritize',
    'Generate a PRD outline',
    'Analyze customer sentiment',
    'Suggest roadmap improvements',
    'Explain feature scores',
    'Identify release risks',
  ]

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto">
      {/* Left Column: Chat Sessions List */}
      <Card className="w-full lg:w-72 shrink-0 p-3 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BotMessageSquare className="w-4 h-4 text-brand-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">Copilot Sessions</span>
            </div>
            <Button variant="ghost" size="xs" icon={Plus} onClick={handleNewChat} />
          </div>

          <div className="space-y-1 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {copilotChats.map(chat => {
              const isSelected = chat.id === activeChat?.id
              return (
                <div
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`group flex items-center justify-between p-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-950/70 text-brand-700 dark:text-brand-300 font-semibold border border-brand-200 dark:border-brand-800/60'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{chat.title}</span>
                  {copilotChats.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCopilotChat(chat.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Disclaimer footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center leading-snug">
          ⚡ Powered by local deterministic intelligence reading live workspace data.
        </div>
      </Card>

      {/* Right Column: Chat History & Input */}
      <Card className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <div className="p-3.5 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">
              AI
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {activeChat?.title || 'Product Copilot'}
              </h3>
              <p className="text-[10px] text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Connected to live workspace memory</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
            title="Clear chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeChat?.messages?.map(msg => {
            const isUser = msg.role === 'user'
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fadeIn`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    isUser
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      : 'bg-gradient-to-tr from-brand-600 to-electric-600 text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-slate-100 dark:bg-navy-950 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-tl-none whitespace-pre-line'
                  }`}
                >
                  <p>{msg.content}</p>

                  <div className={`flex items-center justify-between text-[10px] mt-2 pt-1.5 border-t ${isUser ? 'border-brand-500/50 text-brand-200' : 'border-slate-200/60 dark:border-slate-800 text-slate-400'}`}>
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => copyMessage(msg.content)}
                        className="hover:text-slate-200 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex gap-3 items-center text-xs text-slate-400 animate-pulse">
              <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 animate-spin-slow" />
              </div>
              <span className="italic">Analyzing workspace data & synthesizing recommendation...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts Pills */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-950/40">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Try Asking:</span>
            {suggestedPrompts.slice(0, 4).map(prompt => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="px-2.5 py-1 rounded-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about feedback, scoring formulas, PRDs, or release readiness..."
              className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button
              variant="electric"
              size="sm"
              disabled={!inputText.trim() || isTyping}
              onClick={() => handleSend()}
              icon={Send}
            >
              Send
            </Button>
          </div>
        </div>
      </Card>

      {/* Clear Chat Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Conversation History?"
        subtitle="This will reset messages in this chat session"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Are you sure you want to clear all messages in this Copilot conversation?
          </p>
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (activeChat) clearCopilotChat(activeChat.id)
                setShowClearConfirm(false)
              }}
            >
              Clear Messages
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CopilotPage
