'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Smartphone,
  Laptop,
  Globe,
  Lock,
  RefreshCw,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Building2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';

export default function SecuritySettingsPage() {
  const [activeTab, setActiveTab] = useState<'account' | 'mfa' | 'sessions' | 'identities' | 'sso'>('account');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaOtpauth, setMfaOtpauth] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showMfaModal, setShowMfaModal] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([
    {
      id: 'sess_curr_1',
      browser: 'Chrome',
      os: 'Windows',
      authMethod: 'PASSWORD',
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isCurrent: true,
    },
  ]);

  // SSO & Domains state
  const [ssoIssuer, setSsoIssuer] = useState('https://auth.acme-corp.com');
  const [ssoClientId, setSsoClientId] = useState('client_recoveriq_corp');
  const [ssoClientSecret, setSsoClientSecret] = useState('••••••••••••••••••••••••');
  const [enforceSso, setEnforceSso] = useState(false);
  const [jitEnabled, setJitEnabled] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [domains, setDomains] = useState<any[]>([
    { id: 'dom_1', domain: 'acme-corp.com', status: 'VERIFIED', verifiedAt: new Date().toISOString() },
  ]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showStatus('error', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 12) {
      showStatus('error', 'Password must be at least 12 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        showStatus('success', 'Password updated successfully. All other sessions have been signed out.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showStatus('error', data.error || 'Failed to update password.');
      }
    } catch {
      showStatus('error', 'Network error changing password.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartMfaEnrollment = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMfaSecret(data.secret);
        setMfaOtpauth(data.otpauthUri);
        setShowMfaModal(true);
      } else {
        showStatus('error', data.error || 'Failed to initiate MFA.');
      }
    } catch {
      showStatus('error', 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfaEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode || mfaCode.length !== 6) {
      showStatus('error', 'Please enter a 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode }),
      });
      const data = await res.json();
      if (data.success) {
        setMfaEnabled(true);
        setShowMfaModal(false);
        setRecoveryCodes(data.recoveryCodes || []);
        showStatus('success', 'MFA enabled! Please store your 10 recovery codes safely.');
      } else {
        showStatus('error', data.error || 'Invalid verification code.');
      }
    } catch {
      showStatus('error', 'Network error verifying MFA.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        showStatus('success', 'Session revoked successfully.');
      } else {
        showStatus('error', data.error || 'Failed to revoke session.');
      }
    } catch {
      showStatus('error', 'Network error revoking session.');
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      const res = await fetch('/api/auth/sessions/revoke-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => prev.filter(s => s.isCurrent));
        showStatus('success', 'All other active sessions revoked.');
      } else {
        showStatus('error', data.error || 'Failed to revoke other sessions.');
      }
    } catch {
      showStatus('error', 'Network error.');
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain) return;

    try {
      const res = await fetch('/api/organization/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });
      const data = await res.json();
      if (data.success) {
        setDomains(prev => [...prev, data.domain]);
        setNewDomain('');
        showStatus('success', 'Domain added. Please verify DNS TXT record.');
      } else {
        showStatus('error', data.error || 'Failed to add domain.');
      }
    } catch {
      showStatus('error', 'Network error.');
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    try {
      const res = await fetch(`/api/organization/domains/${domainId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDomains(prev => prev.map(d => (d.id === domainId ? { ...d, status: 'VERIFIED' } : d)));
        showStatus('success', 'Domain verified successfully!');
      } else {
        showStatus('error', data.error || 'Domain verification failed.');
      }
    } catch {
      showStatus('error', 'Network error.');
    }
  };

  return (
    <AppLayout
      title="Enterprise Security Center"
      subtitle="Manage your identity credentials, multi-factor authentication, active devices, and organization SSO policies"
    >
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 mb-6 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('account')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'account' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Account & Password
        </button>
        <button
          onClick={() => setActiveTab('mfa')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'mfa' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Two-Factor Auth (MFA)
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'sessions' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Laptop className="w-3.5 h-3.5" />
          Active Sessions
        </button>
        <button
          onClick={() => setActiveTab('identities')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'identities' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Connected Accounts
        </button>
        <button
          onClick={() => setActiveTab('sso')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'sso' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Enterprise SSO & Domains
        </button>
      </div>

      {/* Tab 1: Account & Password */}
      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              Change Password
            </h3>
            <p className="text-xs text-slate-500">
              Passwords must be at least 12 characters long and meet complexity requirements.
            </p>

            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Password (min. 12 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                {loading ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Identity Health & Verification
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Email Verification</div>
                  <div className="text-slate-500 text-[11px]">Primary email is verified with token confirmation</div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold text-[10px]">
                  VERIFIED
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800">Password Policy Level</div>
                  <div className="text-slate-500 text-[11px]">Argon2 / Salted Bcrypt (12 rounds)</div>
                </div>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-semibold text-[10px]">
                  ENTERPRISE
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Multi-Factor Authentication */}
      {activeTab === 'mfa' && (
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                Authenticator App (TOTP)
              </h3>
              <p className="text-xs text-slate-500">
                Protect your account using standard TOTP apps (Google Authenticator, 1Password, Duo).
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                mfaEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {mfaEnabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>

          {!mfaEnabled ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Two-factor authentication adds an extra layer of defense by requiring a 6-digit rotating code upon login.
              </p>
              <button
                onClick={handleStartMfaEnrollment}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition"
              >
                Set Up Two-Factor Authentication
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Two-Factor Authentication is active and protecting your account.</span>
              </div>

              {recoveryCodes.length > 0 && (
                <div className="p-4 bg-slate-900 text-white rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-amber-400">
                    Important: Save your 10 Single-Use Recovery Codes
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs text-slate-200">
                    {recoveryCodes.map((code, idx) => (
                      <div key={idx} className="bg-slate-800 p-1.5 rounded text-center">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MFA Enrollment Modal */}
          {showMfaModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Set Up Authenticator App</h3>
                <p className="text-xs text-slate-600">
                  Scan this configuration code or manually input the secret key into your authenticator app.
                </p>

                <div className="p-3 bg-slate-100 rounded-lg text-center font-mono text-xs text-indigo-800 select-all break-all">
                  {mfaSecret}
                </div>

                <form onSubmit={handleVerifyMfaEnrollment} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Enter 6-digit Code from Authenticator
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={mfaCode}
                      onChange={e => setMfaCode(e.target.value.trim())}
                      placeholder="123456"
                      className="w-full text-center tracking-widest text-lg font-mono px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMfaModal(false)}
                      className="w-1/2 py-2 border border-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-50 text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-1/2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Verify & Activate
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Active Sessions */}
      {activeTab === 'sessions' && (
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-indigo-600" />
                Active Devices & Sessions
              </h3>
              <p className="text-xs text-slate-500">
                View devices currently signed into your account and revoke access remotely.
              </p>
            </div>
            <button
              onClick={handleRevokeAllSessions}
              className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out all other sessions
            </button>
          </div>

          <div className="space-y-3">
            {sessions.map(s => (
              <div
                key={s.id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                      {s.browser} on {s.os}
                      {s.isCurrent && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-semibold text-[10px]">
                          CURRENT SESSION
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Auth Method: {s.authMethod} · Last active: Just now
                    </div>
                  </div>
                </div>

                {!s.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(s.id)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Connected Accounts */}
      {activeTab === 'identities' && (
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            Connected Single Sign-On (SSO) Accounts
          </h3>
          <p className="text-xs text-slate-500">
            Link your Google, Microsoft, or corporate SSO identity for streamlined authentication.
          </p>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">Google Workspace</div>
                <div className="text-[11px] text-slate-500">OpenID Connect Identity Provider</div>
              </div>
              <button className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold rounded-lg">
                Connect
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">Microsoft Entra ID</div>
                <div className="text-[11px] text-slate-500">Corporate OIDC / SAML 2.0</div>
              </div>
              <button className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold rounded-lg">
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Enterprise SSO & Domains */}
      {activeTab === 'sso' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Organization Identity Provider (OIDC / SAML)
            </h3>
            <p className="text-xs text-slate-500">
              Configure SAML 2.0 or OpenID Connect provider for your organization workspace.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Issuer URL</label>
                <input
                  type="text"
                  value={ssoIssuer}
                  onChange={e => setSsoIssuer(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Client ID</label>
                <input
                  type="text"
                  value={ssoClientId}
                  onChange={e => setSsoClientId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Client Secret (Encrypted at Rest)</label>
                <input
                  type="password"
                  value={ssoClientSecret}
                  onChange={e => setSsoClientSecret(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enforceSso}
                    onChange={e => setEnforceSso(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Enforce SSO for all verified domain members</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jitEnabled}
                    onChange={e => setJitEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Enable Just-In-Time (JIT) Member Provisioning</span>
                </label>
              </div>

              <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs">
                Save SSO Configuration
              </button>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              Verified Enterprise Domains
            </h3>
            <p className="text-xs text-slate-500">
              Prove ownership of your corporate email domains to enforce SSO and enable JIT onboarding.
            </p>

            <form onSubmit={handleAddDomain} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. acme-corp.com"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg"
              >
                Add Domain
              </button>
            </form>

            <div className="space-y-3">
              {domains.map(dom => (
                <div
                  key={dom.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{dom.domain}</div>
                    <div className="text-[11px] text-slate-500">DNS TXT Verification</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        dom.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {dom.status}
                    </span>
                    {dom.status !== 'VERIFIED' && (
                      <button
                        onClick={() => handleVerifyDomain(dom.id)}
                        className="px-2 py-1 bg-indigo-600 text-white text-[11px] font-semibold rounded"
                      >
                        Verify
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
