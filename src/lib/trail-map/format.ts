export const formatTime = (at: Date, timeZone: string) => {
  const when = at.toLocaleString('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${when} ${timeZone.split('/').pop()!.replaceAll('_', ' ')} time`;
};
