import { ChevronRight } from 'lucide-react';

interface ThreadBarProps {
  count?: number;
  image?: string;
  name?: string;
  timestamp?: number;
  onClick?: () => void;
}

export const ThreadBar = ({
  count,
  image,
  name = 'Member',
  timestamp,
  onClick,
}: ThreadBarProps) => {
  if (!count || !timestamp) return null;

  return (
    <button
      onClick={onClick}
      className="group mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
    >
      <span className="font-medium">Show thread</span>
      <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
};