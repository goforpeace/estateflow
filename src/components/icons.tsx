import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-label="EstateFlow Logo"
      role="img"
      {...props}
    >
      <path
        fill="hsl(var(--primary))"
        d="M 112,28 V 228 H 40 c -6.627,0 -12,-5.373 -12,-12 V 40 c 0,-6.627 5.373,-12 12,-12 z"
      ></path>
      <path
        fill="hsl(var(--accent))"
        d="M 216,28 H 144 v 200 h 72 c 6.627,0 12,-5.373 12,-12 V 40 c 0,-6.627 -5.373,-12 -12,-12 z"
      ></path>
    </svg>
  );
}
