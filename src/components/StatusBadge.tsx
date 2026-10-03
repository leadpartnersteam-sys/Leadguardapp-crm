import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Snowflake,
  Sun,
  X,
} from 'lucide-react';
import { ConnectionStatus, LeadStatus } from '../types/leadguard';

interface LeadStatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

/**
 * Accessible status indicator that pairs color with an icon and explicit text label.
 */
export const LeadStatusBadge: React.FC<LeadStatusBadgeProps> = ({
  status,
  size = 'sm',
}) => {
  const sizeClasses =
    size === 'md'
      ? 'px-2.5 py-1 text-xs gap-1.5'
      : 'px-2 py-0.5 text-[11px] gap-1';

  if (status === LeadStatus.HOT) {
    return (
      <span
        className={`inline-flex items-center font-mono font-bold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap ${sizeClasses}`}
      >
        <Flame className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>HOT</span>
      </span>
    );
  }

  if (status === LeadStatus.WARM) {
    return (
      <span
        className={`inline-flex items-center font-mono font-bold rounded-md bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap ${sizeClasses}`}
      >
        <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
        <span>WARM</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-mono font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap ${sizeClasses}`}
    >
      <Snowflake className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      <span>COLD</span>
    </span>
  );
};

interface ScoreDisplayProps {
  score: number;
  status: LeadStatus;
  showBar?: boolean;
}

export const ScoreIndicator: React.FC<ScoreDisplayProps> = ({
  score,
  status,
  showBar = true,
}) => {
  const barColor =
    status === LeadStatus.HOT
      ? 'bg-emerald-600'
      : status === LeadStatus.WARM
      ? 'bg-amber-500'
      : 'bg-slate-400';

  return (
    <div className="inline-flex items-center gap-2.5">
      <span className="font-mono font-bold text-slate-900 tabular-nums text-xs">
        {score}
        <span className="text-slate-400 font-normal">/100</span>
      </span>
      {showBar && (
        <div
          className="w-14 h-1.5 bg-slate-100 rounded-sm overflow-hidden shrink-0 hidden sm:block"
          aria-hidden="true"
        >
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      )}
    </div>
  );
};

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  status,
}) => {
  if (status === 'CONNECTED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>CONNECTED</span>
      </span>
    );
  }

  if (status === 'CONNECTION ERROR') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-red-50 text-red-800 border border-red-200 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
        <span>CONNECTION ERROR</span>
      </span>
    );
  }

  if (status === 'COMING SOON') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
        <span>COMING SOON</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
      <span>NOT CONNECTED</span>
    </span>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="confirm-dialog-title"
                className="text-base font-bold text-slate-900"
              >
                {title}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
