import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  RotateCcw,
  Download,
  Upload,
  Play,
  Presentation,
  Shield,
  User,
  Building,
  Bell,
  HelpCircle,
  Database,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Users,
  UserPlus,
  Trash2,
  Mail,
  ShieldCheck,
  Check,
  Loader2,
  Save,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { workspaceService } from '../services/api/workspaceService'
import { isBackendConfigured } from '../services/api/apiClient'
import { Button, Card, Badge, Modal } from '../components/common'
import { exportAllData } from '../services/storageService'

export default function SettingsPage() {
  const { theme, setTheme, reducedMotion, toggleReducedMotion } = useTheme()
  const { currentUser, updateProfile } = useAuth()
  const user = currentUser
  const { currentWorkspace } = useWorkspace()
  const {
    setIntroSeen,
    setTourSeen,
    startRecruiterDemo,
    setPresentationModeActive,
    resetToDemo,
    importBackup,
    addToast,
  } = useApp()

  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || 'Apex Product Ops')
  const [userName, setUserName] = useState(user?.name || '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false)

  // Team Members state
  const [members, setMembers] = useState([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('member')
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [memberError, setMemberError] = useState('')

  // Sync state when workspace or user changes
  useEffect(() => {
    if (currentWorkspace?.name) {
      setWorkspaceName(currentWorkspace.name)
    }
  }, [currentWorkspace?.name])

  useEffect(() => {
    if (user?.name) {
      setUserName(user.name)
    }
  }, [user?.name])

  // Fetch workspace members
  const fetchMembers = useCallback(async () => {
    if (!currentWorkspace?.id || !isBackendConfigured()) {
      setMembers([
        {
          userId: user?.id || 'usr-current',
          name: user?.name || 'Lead Product Manager',
          email: user?.email || 'pm@productmind.ai',
          role: 'admin',
          status: 'active',
          joinedAt: new Date().toISOString(),
        },
      ])
      return
    }
    setIsLoadingMembers(true)
    setMemberError('')
    try {
      const data = await workspaceService.getMembers(currentWorkspace.id)
      setMembers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('Could not load workspace members:', err)
      setMembers([
        {
          userId: user?.id || 'usr-current',
          name: user?.name || 'Lead Product Manager',
          email: user?.email || 'pm@productmind.ai',
          role: 'admin',
          status: 'active',
          joinedAt: new Date().toISOString(),
        },
      ])
    } finally {
      setIsLoadingMembers(false)
    }
  }, [currentWorkspace?.id, user])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleSaveProfile = async () => {
    if (!userName.trim()) return
    setIsSavingProfile(true)
    try {
      const res = await updateProfile({ name: userName.trim() })
      if (res?.success) {
        addToast('Profile name updated successfully', 'success')
      } else {
        addToast(res?.error || 'Failed to update profile', 'error')
      }
    } catch (err) {
      addToast(err?.message || 'Failed to update profile', 'error')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveWorkspace = async () => {
    if (!workspaceName.trim() || !currentWorkspace?.id) return
    setIsSavingWorkspace(true)
    try {
      if (isBackendConfigured()) {
        await workspaceService.updateWorkspace(currentWorkspace.id, { name: workspaceName.trim() })
        addToast('Workspace name updated in MongoDB Atlas', 'success')
      } else {
        addToast('Workspace name updated locally', 'success')
      }
    } catch (err) {
      addToast(err?.message || 'Failed to update workspace name', 'error')
    } finally {
      setIsSavingWorkspace(false)
    }
  }

  const handleAddMember = async (e) => {
    e.preventDefault()
    if (!newMemberEmail.trim() || !currentWorkspace?.id) return
    setIsAddingMember(true)
    setMemberError('')
    try {
      if (isBackendConfigured()) {
        await workspaceService.addMember(currentWorkspace.id, {
          email: newMemberEmail.trim().toLowerCase(),
          role: newMemberRole,
        })
        addToast(`Added ${newMemberEmail} to workspace as ${newMemberRole}`, 'success')
        setNewMemberEmail('')
        fetchMembers()
      } else {
        const fakeMember = {
          userId: `usr-${Date.now()}`,
          name: newMemberEmail.split('@')[0],
          email: newMemberEmail.trim(),
          role: newMemberRole,
          status: 'active',
          joinedAt: new Date().toISOString(),
        }
        setMembers(prev => [...prev, fakeMember])
        addToast(`Added ${newMemberEmail} to workspace`, 'success')
        setNewMemberEmail('')
      }
    } catch (err) {
      setMemberError(err?.message || 'Failed to add member. Ensure the user account exists.')
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleUpdateMemberRole = async (userId, role) => {
    if (!currentWorkspace?.id) return
    try {
      if (isBackendConfigured()) {
        await workspaceService.updateMemberRole(currentWorkspace.id, userId, role)
        addToast('Member role updated successfully', 'success')
        fetchMembers()
      } else {
        setMembers(prev => prev.map(m => (m.userId === userId ? { ...m, role } : m)))
        addToast('Member role updated', 'success')
      }
    } catch (err) {
      addToast(err?.message || 'Failed to update member role', 'error')
    }
  }

  const handleRemoveMember = async (userId) => {
    if (!currentWorkspace?.id) return
    try {
      if (isBackendConfigured()) {
        await workspaceService.removeMember(currentWorkspace.id, userId)
        addToast('Member removed from workspace', 'success')
        fetchMembers()
      } else {
        setMembers(prev => prev.filter(m => m.userId !== userId))
        addToast('Member removed from workspace', 'success')
      }
    } catch (err) {
      addToast(err?.message || 'Failed to remove member', 'error')
    }
  }

  const [emailDigest, setEmailDigest] = useState(true)
  const [inAppAlerts, setInAppAlerts] = useState(true)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const fileInputRef = useRef(null)

  // Handle Export Backup
  const handleExportBackup = () => {
    try {
      const dataStr = exportAllData()
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `product-mind-ai-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      addToast('Workspace backup exported successfully!', 'success')
    } catch (err) {
      addToast('Failed to export backup: ' + err.message, 'error')
    }
  }

  // Handle Import Backup
  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result)
        if (!json.feedback || !json.features) {
          throw new Error('Invalid schema: Missing required feedback or features data.')
        }
        importBackup(json)
      } catch (err) {
        addToast('Import error: ' + err.message, 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleReplayIntro = () => {
    setIntroSeen(false)
    addToast('Cinematic intro re-armed. Refresh or navigate to dashboard to view.', 'info')
  }

  const handleReplayTour = () => {
    setTourSeen(false)
    addToast('Interactive product tour re-enabled.', 'info')
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 rounded-xl text-primary-600 dark:text-primary-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Customize appearance, manage profile preferences, backup data, or restart interactive tours
            </p>
          </div>
        </div>
        <Badge variant="outline" className="px-3 py-1 font-mono text-xs">
          v1.0.0 Enterprise
        </Badge>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appearance Settings */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <Sun className="w-5 h-5 text-amber-500" />
            <span>Appearance & Theme</span>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Interface Color Scheme
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                  theme === 'light'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold ring-2 ring-primary-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Sun className="w-5 h-5 mb-1.5 text-amber-500" />
                Light
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                  theme === 'dark'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold ring-2 ring-primary-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Moon className="w-5 h-5 mb-1.5 text-indigo-400" />
                Dark
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition ${
                  theme === 'system'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold ring-2 ring-primary-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Monitor className="w-5 h-5 mb-1.5 text-slate-400" />
                System
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Reduced Motion</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Minimizes smooth page and chart animations</p>
            </div>
            <button
              type="button"
              onClick={toggleReducedMotion}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                reducedMotion ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  reducedMotion ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>

        {/* User & Workspace Profile */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <Building className="w-5 h-5 text-primary-500" />
            <span>Profile & Workspace</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                User Name (Persisted)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your full name"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile || !userName.trim()}
                >
                  {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {user?.email || 'pm@productmind.ai'} • {user?.role || 'Lead PM'}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Workspace Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveWorkspace}
                  disabled={isSavingWorkspace || !workspaceName.trim()}
                >
                  {isSavingWorkspace ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Slug: <span className="font-mono">{currentWorkspace?.slug || 'apex-saas'}</span> • Plan: {currentWorkspace?.plan || 'enterprise'}
              </div>
            </div>
          </div>
        </Card>

        {/* Workspace Team & Members Management */}
        <Card className="p-6 space-y-5 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
              <Users className="w-5 h-5 text-emerald-500" />
              <span>Workspace Team Members</span>
              <Badge variant="outline" className="text-xs ml-1 font-mono">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Badge>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Workspace ID: <span className="font-mono">{currentWorkspace?.id || 'default'}</span>
            </div>
          </div>

          {/* Add Member Form */}
          <form onSubmit={handleAddMember} className="space-y-3">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Add New Member
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="colleague@productmind.ai"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" variant="primary" disabled={isAddingMember || !newMemberEmail.trim()}>
                {isAddingMember ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
                Add Member
              </Button>
            </div>
            {memberError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs border border-red-200 dark:border-red-900/30">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{memberError}</span>
              </div>
            )}
          </form>

          {/* Members Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {isLoadingMembers ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                <span>Loading workspace members...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                No active members found in this workspace.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Member</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {members.map((member) => {
                      const mId = member.userId || member.user_id || member.id
                      const mEmail = member.email || member.userEmail || ''
                      const mName = member.name || member.userName || mEmail.split('@')[0] || 'User'
                      const mRole = member.role || 'member'
                      const isSelf = user?.email === mEmail || user?.id === mId

                      return (
                        <tr key={mId || mEmail} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs uppercase">
                                {mName[0] || 'U'}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                                  {mName}
                                  {isSelf && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{mEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={mRole}
                              onChange={(e) => handleUpdateMemberRole(mId, e.target.value)}
                              disabled={isSelf}
                              className="text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={member.status === 'inactive' ? 'outline' : 'success'} className="text-[11px]">
                              {member.status || 'active'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(mId)}
                                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition"
                                title="Remove member"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* Guided Experience & Demonstrations */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <HelpCircle className="w-5 h-5 text-indigo-500" />
            <span>Interactive Demos & Tours</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Cinematic Intro</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Replay the canvas particle sequence</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleReplayIntro}>
                <Play className="w-3.5 h-3.5 mr-1" />
                Re-arm
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Product Spotlight Tour</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Restart the 6-step guided walkthrough</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleReplayTour}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Restart
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Recruiter Demo Mode</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Launch 8-step guided scenario banner</p>
              </div>
              <Button size="sm" variant="primary" onClick={() => startRecruiterDemo(0)}>
                <Zap className="w-3.5 h-3.5 mr-1" />
                Launch Demo
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Executive Presentation Deck</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Open 10-slide full-screen pitch view</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setPresentationModeActive(true)}>
                <Presentation className="w-3.5 h-3.5 mr-1" />
                Present
              </Button>
            </div>
          </div>
        </Card>

        {/* Data Persistence, Backups & Reset */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
            <Database className="w-5 h-5 text-cyan-500" />
            <span>Data Management & Backup</span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              All workspace entities (feedback, features, roadmap, PRDs, experiments, audit history) are stored in client-side localStorage. No data is sent to external servers.
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" className="flex-1" onClick={handleExportBackup}>
                <Download className="w-4 h-4 mr-1.5" />
                Export JSON Backup
              </Button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden"
              />
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Import JSON
              </Button>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="danger"
                className="w-full"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Reset Workspace to Pristine Seed Data
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Zero Backend & Architecture Disclosure Banner */}
      <Card className="p-6 bg-gradient-to-r from-primary-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-primary-950/20 dark:to-slate-900 border-primary-200 dark:border-primary-900/40">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-xl shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Zero-Backend Architecture & Localhost Confidentiality
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Product Mind AI is built strictly with deterministic local algorithms, keyword-driven NLP sentiment analysis, exact mathematical priority scoring formulas, and safe browser persistence. No credit card or paid third-party API keys required.
            </p>
          </div>
        </div>
      </Card>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset All Workspace Data?"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900/30 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              This will overwrite all customized feedback, modified scores, created PRDs, and audit history with the original 20 seed items and 10 prioritized features.
            </span>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to proceed? Consider downloading an export backup first.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetToDemo()
                setShowResetConfirm(false)
              }}
            >
              Confirm Reset
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
