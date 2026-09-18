import React from 'react';

interface BadgeProps {
  variant:
    | 'ACTIVE'
    | 'FROZEN'
    | 'CLOSED'
    | 'COMPLETED'
    | 'FLAGGED'
    | 'PENDING'
    | 'FAILED'
    | 'DEBIT'
    | 'CREDIT'
    | 'HIT'
    | 'MISS'
    | 'CUSTOMER'
    | 'ADMIN'
    | 'DEFAULT';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ variant, children, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-xs font-semibold';

  const variantStyles: Record<string, string> = {
    ACTIVE: 'bg-[#E4EFE7] text-[#2E593E]',
    COMPLETED: 'bg-[#E4EFE7] text-[#2E593E]',
    CREDIT: 'bg-[#E4EFE7] text-[#2E593E] font-medium',

    FROZEN: 'bg-[#FCE8E6] text-[#D14334]',
    FLAGGED: 'bg-[#FEF3E2] text-[#9A6B1F] font-medium',

    CLOSED: 'bg-[#F4F2EB] text-[#7E807A]',
    FAILED: 'bg-[#FCE8E6] text-[#D14334]',
    DEBIT: 'bg-[#FCE8E6] text-[#D14334] font-medium',

    PENDING: 'bg-[#FEF3E2] text-[#9A6B1F]',
    HIT: 'bg-[#E4EFE7] text-[#2E593E] font-mono',
    MISS: 'bg-[#ECEAE3] text-[#7E807A] font-mono',

    CUSTOMER: 'bg-[#ECEAE3] text-[#191A19]',
    ADMIN: 'bg-[#2D4739] text-white',

    DEFAULT: 'bg-[#ECEAE3] text-[#7E807A]',
  };

  const currentStyle = variantStyles[variant] || variantStyles.DEFAULT;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses} ${currentStyle}`}>
      {children}
    </span>
  );
};
