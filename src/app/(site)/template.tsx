/** Re-mounts on every navigation: a short crossfade + 6px rise (fade only in reduced mode, none in static). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="nx-enter">{children}</div>;
}
