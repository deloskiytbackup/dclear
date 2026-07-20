export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

export function colorizeSize(bytes: number, formattedStr: string): string {
  const GB = 1024 * 1024 * 1024;
  const MB100 = 100 * 1024 * 1024;
  const MB10 = 10 * 1024 * 1024;

  const reset = '\x1b[0m';
  const boldRed = '\x1b[31;1m';
  const yellow = '\x1b[33m';
  const cyan = '\x1b[36m';
  const green = '\x1b[32m';

  if (bytes >= GB) {
    return `${boldRed}${formattedStr}${reset}`;
  } else if (bytes >= MB100) {
    return `${yellow}${formattedStr}${reset}`;
  } else if (bytes >= MB10) {
    return `${cyan}${formattedStr}${reset}`;
  } else {
    return `${green}${formattedStr}${reset}`;
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${parseFloat((num / 1_000_000).toFixed(1))}M`;
  }
  if (num >= 10_000) {
    return `${parseFloat((num / 1_000).toFixed(1))}k`;
  }
  return num.toLocaleString('pl-PL');
}
