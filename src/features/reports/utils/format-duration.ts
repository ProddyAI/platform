export function formatDuration(ms: number, format: 'short' | 'long' = 'long'): string {
  if (ms < 1000) {
    return format === 'short' ? '< 1s' : 'less than a second';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (format === 'short') {
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  } else {
    const parts = [];

    if (days > 0) {
      parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }
    
    if (hours % 24 > 0) {
      parts.push(`${hours % 24} ${hours % 24 === 1 ? 'hour' : 'hours'}`);
    }
    
    if (minutes % 60 > 0) {
      parts.push(`${minutes % 60} ${minutes % 60 === 1 ? 'minute' : 'minutes'}`);
    }
    
    if (seconds % 60 > 0 && days === 0 && hours === 0) {
      parts.push(`${seconds % 60} ${seconds % 60 === 1 ? 'second' : 'seconds'}`);
    }

    if (parts.length === 0) {
      return 'less than a minute';
    }

    if (parts.length === 1) {
      return parts[0];
    }

    const lastPart = parts.pop();
    return `${parts.join(', ')} and ${lastPart}`;
  }
}
