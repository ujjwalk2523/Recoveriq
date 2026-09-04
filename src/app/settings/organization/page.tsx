'use client';

import React, { useState } from 'react';
import {
  Building,
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  ArrowRightLeft,
  Search,
  Filter,
  MoreVertical,
  KeyRound,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'OPERATOR';
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  teams: string[];
  joinedAt: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
  membersCount: number;
  status: 'ACTIVE' | 'ARCHIVED';
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export default function OrganizationSettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'invitations' | 'teams' | 'ownership'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Sample organizational state
  const [orgName, setOrgName] = useState('SaaSify Technologies India Pvt Ltd');
  const [orgSlug, setOrgSlug] = useState('saasify');
  const [notification, setNotification] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([
    {
      id: 'mem_001',
      name: 'Ujjwal (Admin)',
      email: 'merchant@saasify.in',
      role: 'OWNER',
      status: 'ACTIVE',
      teams: ['Payments Operations', 'Revenue Recovery'],
      joinedAt: '2026-01-01',
    },
    {
      id: 'mem_002',
      name: 'Rohan Sharma',
      email: 'rohan.sharma@saasify.in',
      role: 'ADMIN',
      status: 'ACTIVE',
      teams: ['Payments Operations'],
      joinedAt: '2026-02-15',
    },
    {
      id: 'mem_003',
      name: 'Priya Iyer',
      email: 'priya.iyer@saasify.in',
      role: 'OPERATOR',
      status: 'ACTIVE',
      teams: ['Revenue Recovery'],
      joinedAt: '2026-03-01',
    },
    {
      id: 'mem_004',
      name: 'Amit Verma',
      email: 'amit.verma@saasify.in',
      role: 'ANALYST',
      status: 'SUSPENDED',
      teams: ['Analytics'],
      joinedAt: '2026-03-10',
    },
  ]);

  const [teams, setTeams] = useState<Team[]>([
    {
      id: 'team_001',
      name: 'Payments Operations',
      description: 'Reviews autonomous recovery suggestions, approvals, and dispute triage.',
      membersCount: 2,
      status: 'ACTIVE',
    },
    {
      id: 'team_002',
      name: 'Revenue Recovery',
      description: 'Coordinates customer WhatsApp nudges, payment links, and communications.',
      membersCount: 2,
      status: 'ACTIVE',
    },
    {
      id: 'team_003',
      name: 'Risk & Fraud',
      description: 'Oversees safety gates and fraud guardrail calibrations.',
      membersCount: 0,
      status: 'ACTIVE',
    },
  ]);

  const [invitations, setInvitations] = useState<Invitation[]>([
    {
      id: 'inv_001',
      email: 'finance.lead@saasify.in',
      role: 'OPERATOR',
      expiresAt: '2026-09-11',
    },
  ]);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('OPERATOR');

  // Transfer Ownership Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetOwnerId, setTargetOwnerId] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInvitations([
      ...invitations,
      {
        id: `inv_${Date.now()}`,
        email: inviteEmail,
        role: inviteRole,
        expiresAt: '7 days from now',
      },
    ]);
    setShowInviteModal(false);
    setInviteEmail('');
    showToast(`Invitation sent to ${inviteEmail}.`);
  };

  const handleRoleChange = (memberId: string, newRole: any) => {
    setMembers(
      members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    showToast(`Member role updated to ${newRole}.`);
  };

  const handleToggleSuspend = (memberId: string) => {
    setMembers(
      members.map((m) =>
        m.id === memberId
          ? { ...m, status: m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }
          : m
      )
    );
    showToast('Member status updated.');
  };

  const handleRemoveMember = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (member?.role === 'OWNER') {
      alert('Cannot remove the active organization OWNER.');
      return;
    }
    if (confirm(`Are you sure you want to remove ${member?.name}?`)) {
      setMembers(members.filter((m) => m.id !== memberId));
      showToast('Member removed from organization.');
    }
  };

  const handleTransferOwnership = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmPhrase !== 'TRANSFER') {
      alert("Please type 'TRANSFER' to confirm.");
      return;
    }
    const target = members.find((m) => m.id === targetOwnerId);
    if (!target) return;

    setMembers(
      members.map((m) => {
        if (m.role === 'OWNER') return { ...m, role: 'ADMIN' };
        if (m.id === targetOwnerId) return { ...m, role: 'OWNER' };
        return m;
      })
    );
    setShowTransferModal(false);
    setConfirmPhrase('');
    showToast(`Organization ownership successfully transferred to ${target.name}.`);
  };

  const filteredMembers = members.filter((m) => {
    const matchesQuery =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || m.role === roleFilter;
    return matchesQuery && matchesRole;
  });

  return (
    <AppLayout
      title="Organization & Team Management"
      subtitle="Enterprise workspaces, delegated RBAC roles, team management, and secure member invitations"
    >
      {notification && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 mb-6 space-x-1">
        {[
          { id: 'members', label: 'Members', icon: Users },
          { id: 'invitations', label: 'Invitations', icon: Mail, badge: invitations.length },
          { id: 'teams', label: 'Teams', icon: FolderTree },
          { id: 'general', label: 'General', icon: Building },
          { id: 'ownership', label: 'Ownership & Danger Zone', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Controls Bar & Seat Limit Gauge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900 w-56"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700"
              >
                <option value="ALL">All Roles</option>
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="OPERATOR">Operator</option>
                <option value="ANALYST">Analyst</option>
              </select>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <span className="text-[11px] text-slate-500">Seat Utilization</span>
                <p className="text-xs font-medium text-slate-800 font-mono">
                  {members.length} / 20 Seats (Growth Plan)
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors cursor-pointer shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Member</span>
              </button>
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Teams</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-medium text-xs">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{member.name}</p>
                          <p className="text-[11px] text-slate-500">{member.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {member.role === 'OWNER' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <KeyRound className="w-3 h-3" /> Owner
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-800 focus:outline-none"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="OPERATOR">Operator</option>
                          <option value="ANALYST">Analyst</option>
                        </select>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          member.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {member.teams.map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {member.joinedAt}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {member.role !== 'OWNER' && (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleSuspend(member.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title={member.status === 'ACTIVE' ? 'Suspend Member' : 'Reactivate Member'}
                          >
                            {member.status === 'ACTIVE' ? (
                              <Ban className="w-3.5 h-3.5" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Pending Organization Invitations</h3>
              <p className="text-xs text-slate-500">
                Single-use cryptographic invitations expire after 7 days.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Member</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {invitations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No pending invitations.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="py-3 px-4">Invited Email</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 px-4 font-medium text-slate-900">{inv.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                          {inv.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{inv.expiresAt}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setInvitations(invitations.filter((i) => i.id !== inv.id));
                            showToast('Invitation revoked.');
                          }}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TEAMS */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Functional Teams</h3>
              <p className="text-xs text-slate-500">
                Segment members for dispute review, customer messaging, and risk escalation.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500">Team Limit</span>
              <p className="text-xs font-medium text-slate-800 font-mono">{teams.length} / 5 Teams</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div key={team.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{team.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                    {team.membersCount} members
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{team.description}</p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                    {team.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => showToast(`Opening team ${team.name}...`)}
                    className="text-slate-900 hover:underline font-medium"
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: GENERAL */}
      {activeTab === 'general' && (
        <div className="max-w-2xl p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5">
          <h3 className="text-sm font-semibold text-slate-900">Organization Settings</h3>
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Organization Legal Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Organization Slug (URL identifier)</label>
              <input
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-slate-800"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Used in API endpoints and organization switching.
              </p>
            </div>
            <button
              type="button"
              onClick={() => showToast('Organization settings updated.')}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: OWNERSHIP & DANGER ZONE */}
      {activeTab === 'ownership' && (
        <div className="max-w-2xl space-y-6">
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              Transfer Organization Ownership
            </h3>
            <p className="text-xs text-slate-600">
              Transfer primary organization ownership to another active member. You will be demoted to an Admin.
              Every organization must have exactly one active Owner.
            </p>
            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors"
            >
              Initiate Ownership Transfer
            </button>
          </div>

          <div className="p-5 rounded-xl bg-rose-50/50 border border-rose-200 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-rose-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Deactivate / Suspend Organization
            </h3>
            <p className="text-xs text-rose-700">
              Soft-deletes the organization. All payment recovery operations will be immediately halted. Financial and
              transaction records are retained for compliance.
            </p>
            <button
              type="button"
              onClick={() => {
                if (confirm("Are you sure you want to deactivate this organization? Type 'CONFIRM' to proceed.")) {
                  showToast('Organization suspended.');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors"
            >
              Deactivate Organization
            </button>
          </div>
        </div>
      )}

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Invite Team Member</h3>
            <form onSubmit={handleInvite} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="OPERATOR">Operator (Can execute & review recovery)</option>
                  <option value="ANALYST">Analyst (Read-only analytics & intelligence)</option>
                  <option value="ADMIN">Admin (Manage members, settings, and integrations)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER OWNERSHIP MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              Transfer Organization Ownership
            </h3>
            <p className="text-xs text-slate-600">
              Select an active team member to become the new primary Owner.
            </p>
            <form onSubmit={handleTransferOwnership} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Select New Owner</label>
                <select
                  required
                  value={targetOwnerId}
                  onChange={(e) => setTargetOwnerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Choose a member...</option>
                  {members
                    .filter((m) => m.role !== 'OWNER' && m.status === 'ACTIVE')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Type <span className="font-mono text-rose-600 font-bold">TRANSFER</span> to confirm
                </label>
                <input
                  type="text"
                  required
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="TRANSFER"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmPhrase !== 'TRANSFER' || !targetOwnerId}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-medium"
                >
                  Confirm Ownership Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
