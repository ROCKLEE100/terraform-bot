import React from 'react';
import { Check, X } from 'lucide-react';

interface ApprovalControlsProps {
    onApprove: () => void;
    onRevise: () => void;
    disabled?: boolean;
}

export const ApprovalControls: React.FC<ApprovalControlsProps> = ({
    onApprove,
    onRevise,
    disabled
}) => {
    return (
        <div className="flex gap-4 mt-6">
            <button
                onClick={onApprove}
                disabled={disabled}
                className="group flex items-center gap-2 px-6 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 text-green-400 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Check size={12} />
                </div>
                <span className="font-medium">Approve & Deploy</span>
            </button>

            <button
                onClick={onRevise}
                disabled={disabled}
                className="group flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <X size={12} />
                </div>
                <span className="font-medium">Request Changes</span>
            </button>
        </div>
    );
};
