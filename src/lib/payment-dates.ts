// How a payment's time reads on screen, in the trip's time zone: "Mon, Nov 24" in a list and
// "Mon, Nov 24, 14:05" on the payment page. Pure functions.

export function paymentDayLabel(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(at);
}

export function paymentTimeLabel(at: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(at);
  return `${paymentDayLabel(at, timeZone)}, ${time}`;
}
