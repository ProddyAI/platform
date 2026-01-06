import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface WidgetCardProps {
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const WidgetCard = ({ 
  className, 
  contentClassName,
  children, 
  onClick 
}: WidgetCardProps) => {
  return (
    <Card 
      className={cn(
        "overflow-hidden border-2 dark:bg-[hsl(var(--card))] dark:border-[hsl(var(--border))]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className={cn("p-3 dark:bg-[hsl(var(--card))]", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
};