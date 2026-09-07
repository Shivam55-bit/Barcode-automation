import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Lock,
  FileCheck,
  AlertTriangle,
  MessageSquare,
  UserCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { LabelTemplate, TemplateStatus, TemplateComment, UserProfile } from '../../types';

interface ApprovalWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: LabelTemplate;
  currentUser: UserProfile;
  onUpdateStatus: (newStatus: TemplateStatus, comment: string, eSignature?: string) => void;
}

export const ApprovalWorkflowModal: React.FC<ApprovalWorkflowModalProps> = ({
  isOpen,
  onClose,
  template,
  currentUser,
  onUpdateStatus,
}) => {
  const [commentText, setCommentText] = useState('');
  const [signatureName, setSignatureName] = useState(currentUser.name);
  const [signaturePassword, setSignaturePassword] = useState('');
  const [signatureReason, setSignatureReason] = useState('I confirm compliance with 21 CFR Part 11 and GS1 barcoding specs.');
  const [error, setError] = useState<string | null>(null);

  const isReviewerOrAdmin = currentUser.role === 'Admin' || currentUser.role === 'Quality Reviewer';

  const handleAction = (status: TemplateStatus) => {
    setError(null);

    // Require electronic signature confirmation for approval or publishing
    if ((status === 'approved' || status === 'published') && (!signatureName.trim() || !signaturePassword.trim())) {
      setError('Electronic signature (Full Name and Passcode) is strictly required under 21 CFR Part 11.');
      return;
    }

    onUpdateStatus(
      status,
      commentText || `Status changed to ${status.toUpperCase()} by ${currentUser.name}`,
      signatureName ? `${signatureName} (${currentUser.role})` : undefined
    );
    setCommentText('');
    setSignaturePassword('');
    onClose();
  };

  const getStatusBadge = (st: TemplateStatus) => {
    switch (st) {
      case 'published':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'submitted':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Label Lifecycle & Electronic Signature (21 CFR Part 11)"
      subtitle={`Template: ${template.name} (v${template.version})`}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current State Indicator */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Lifecycle Stage</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border uppercase ${getStatusBadge(template.status)}`}>
                {template.status}
              </span>
              <span className="text-xs text-slate-600">
                Created by <strong>{template.createdBy}</strong> on {new Date(template.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          {template.approvedBy && (
            <div className="text-right">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Signed & Approved By</div>
              <div className="text-xs font-bold text-emerald-700 flex items-center justify-end gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{template.approvedBy}</span>
              </div>
            </div>
          )}
        </div>

        {/* Workflow Timeline / Steps */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className={`p-3 rounded-lg border text-xs ${template.status === 'draft' ? 'border-blue-500 bg-blue-50/50 font-bold text-blue-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <div className="text-[10px] font-bold uppercase text-slate-400">Step 1</div>
            <div>Drafting & Layout</div>
          </div>
          <div className={`p-3 rounded-lg border text-xs ${template.status === 'submitted' ? 'border-amber-500 bg-amber-50/50 font-bold text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <div className="text-[10px] font-bold uppercase text-slate-400">Step 2</div>
            <div>Submitted for QA Review</div>
          </div>
          <div className={`p-3 rounded-lg border text-xs ${template.status === 'approved' ? 'border-emerald-500 bg-emerald-50/50 font-bold text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <div className="text-[10px] font-bold uppercase text-slate-400">Step 3</div>
            <div>QA e-Signed & Approved</div>
          </div>
          <div className={`p-3 rounded-lg border text-xs ${template.status === 'published' ? 'border-emerald-600 bg-emerald-600 text-white font-bold' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
            <div className="text-[10px] font-bold uppercase opacity-80">Step 4</div>
            <div>Published to Production</div>
          </div>
        </div>

        {/* Action Controls based on user role & status */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span>Workflow Transition & Electronic Signature</span>
          </h4>

          {/* Electronic signature inputs if approving */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Full Legal Name (Electronic Signature)
              </label>
              <input
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Sign-off Verification Passcode
              </label>
              <input
                type="password"
                placeholder="Enter authorized credentials..."
                value={signaturePassword}
                onChange={(e) => setSignaturePassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Reviewer Notes / Audit Justification
            </label>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Provide reason for approval, rejection, or submission notes..."
              className="w-full h-20 bg-white border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
            {template.status === 'draft' && (
              <button
                onClick={() => handleAction('submitted')}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit for QA Review</span>
              </button>
            )}

            {template.status === 'submitted' && isReviewerOrAdmin && (
              <>
                <button
                  onClick={() => handleAction('rejected')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject & Request Changes</span>
                </button>
                <button
                  onClick={() => handleAction('approved')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>e-Sign & Approve</span>
                </button>
              </>
            )}

            {template.status === 'approved' && (
              <button
                onClick={() => handleAction('published')}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Publish to Thermal Production Floor</span>
              </button>
            )}

            {template.status === 'published' && (
              <button
                onClick={() => handleAction('draft')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold"
              >
                <span>Revise (Create Draft Copy)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
