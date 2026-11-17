import React from 'react';

const baseProps = (size, className) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className,
  'aria-hidden': 'true',
});

export function IconCheck({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconCheckCircle({ size = 22, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8.5 12.2 2.4 2.4 4.8-5" />
    </svg>
  );
}

export function IconXCircle({ size = 22, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

export function IconAlert({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 3.5 2.6 19.5a1.2 1.2 0 0 0 1 1.8h16.8a1.2 1.2 0 0 0 1-1.8L12 3.5Z" />
      <path d="M12 9.5v4.5M12 17.5h.01" />
    </svg>
  );
}

export function IconSearch({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="11" cy="11" r="7.5" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

export function IconFileText({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5L14 2.5Z" />
      <path d="M14 2.5v5h5M8.5 12h7M8.5 16h5" />
    </svg>
  );
}

export function IconDownload({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 3.5v11.5M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 18.5v1a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </svg>
  );
}

export function IconPrinter({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M6.5 8V3.5h11V8" />
      <rect x="3.5" y="8" width="17" height="8.5" rx="1.8" />
      <rect x="6.5" y="14" width="11" height="6.5" rx="1" />
      <path d="M17 11.2h.01" />
    </svg>
  );
}

export function IconRefresh({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 3.5V8h4.5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 20.5V16h-4.5" />
    </svg>
  );
}

export function IconCopy({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="9" y="9" width="11.5" height="11.5" rx="1.8" />
      <path d="M15 9V5.3A1.8 1.8 0 0 0 13.2 3.5H5.3A1.8 1.8 0 0 0 3.5 5.3v7.9A1.8 1.8 0 0 0 5.3 15H9" />
    </svg>
  );
}

export function IconShield({ size = 20, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 2.8 4.5 6v5.7c0 5 3.2 8.7 7.5 10 4.3-1.3 7.5-5 7.5-10V6L12 2.8Z" />
      <path d="m9 12 2.1 2.1 4.2-4.4" />
    </svg>
  );
}

export function IconEdit({ size = 17, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M16.5 3.8a2.1 2.1 0 0 1 3 3L8 18.3l-4.2 1 1-4.2L16.5 3.8Z" />
    </svg>
  );
}

export function IconTrash({ size = 17, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M4 6.5h16M9.5 6.5V4.2h5v2.3M6.5 6.5l.8 13a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-13" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  );
}

export function IconPlus({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconGrid({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </svg>
  );
}

export function IconUsers({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5a3.2 3.2 0 0 1 0 6.2M21 19.5a5.5 5.5 0 0 0-3.5-5" />
    </svg>
  );
}

export function IconBuilding({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 20.5h18M5 20.5V8l7-4.5L19 8v12.5" />
      <path d="M9 20.5v-5h6v5M9 11h.01M15 11h.01" />
    </svg>
  );
}

export function IconEye({ size = 18, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M2.2 12S5.8 5.5 12 5.5 21.8 12 21.8 12 18.2 18.5 12 18.5 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconMenu({ size = 22, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

export function IconLogout({ size = 17, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M15 3.5h3.5A1.5 1.5 0 0 1 20 5v14a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M10 17 5 12l5-5M5 12h10.5" />
    </svg>
  );
}

export function IconKey({ size = 17, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="8" cy="15" r="4.2" />
      <path d="m11.1 11.9 9.4-9.4M17 6l2.5 2.5" />
    </svg>
  );
}

export function IconExpand({ size = 17, className = '' }) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M15 3.5h5.5V9M9 20.5H3.5V15M20.5 3.5l-6.2 6.2M3.5 20.5l6.2-6.2" />
    </svg>
  );
}
