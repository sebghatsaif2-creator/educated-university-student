import React from 'react';
import { STATUS_META } from '../utils/format';

export default function StatusBadge({ status, size = 'md' }) {
  const meta = STATUS_META[status] || { label: status || 'نامشخص', tone: 'slate' };
  return (
    <span className={`status-badge status-${meta.tone} status-size-${size}`}>
      <span className="status-dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
