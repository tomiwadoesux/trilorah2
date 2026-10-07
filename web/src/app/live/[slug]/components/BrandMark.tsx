/** The Trilorah mark — the app icon's squircle with the T cut through it. */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2C19.4 2 22 4.6 22 12S19.4 22 12 22 2 19.4 2 12 4.6 2 12 2ZM7.15 7.58H16.85V10.37H13.41V17.29H10.59V10.37H7.15Z"
      />
    </svg>
  );
}
