export function money(minor: number, currency = 'ETB') {
  try {
    return new Intl.NumberFormat(currency === 'ETB' ? 'en-ET' : 'en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'ETB' ? 0 : 2
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(currency === 'ETB' ? 0 : 2)} ${currency}`;
  }
}

export const km = (m: number) => `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
export const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

export function rideStatusLabel(status: string) {
  switch (status) {
    case 'DRIVER_ASSIGNED': return 'Heading to pickup';
    case 'DRIVER_ARRIVED': return 'Waiting for passenger';
    case 'IN_PROGRESS': return 'Trip in progress';
    case 'COMPLETED': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
    case 'MATCHING': return 'Matching';
    default: return status;
  }
}
