// Time zones and currencies a trip can use. Plain data: safe on client and server.
// The stored value is the standard zone name, so entries can be added later
// without changing any saved trip.

export type TimeZoneOption = { value: string; label: string; group: string };

const SOUTHEAST_ASIA = "Southeast Asia";
const EAST_ASIA = "East Asia";
const SOUTH_ASIA_MIDDLE_EAST = "South Asia and Middle East";
const OCEANIA = "Oceania";
const EUROPE = "Europe";
const AMERICAS = "Americas";

export const TIME_ZONE_GROUPS = [
  SOUTHEAST_ASIA,
  EAST_ASIA,
  SOUTH_ASIA_MIDDLE_EAST,
  OCEANIA,
  EUROPE,
  AMERICAS,
] as const;

export const TIME_ZONES: TimeZoneOption[] = [
  // Southeast Asia: the Philippines comes first.
  { value: "Asia/Manila", label: "Philippines (Manila, Cebu, Davao)", group: SOUTHEAST_ASIA },
  { value: "Asia/Ho_Chi_Minh", label: "Vietnam (Hanoi, Ho Chi Minh City)", group: SOUTHEAST_ASIA },
  { value: "Asia/Bangkok", label: "Thailand (Bangkok, Phuket)", group: SOUTHEAST_ASIA },
  { value: "Asia/Singapore", label: "Singapore", group: SOUTHEAST_ASIA },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia (Kuala Lumpur, Penang)", group: SOUTHEAST_ASIA },
  { value: "Asia/Jakarta", label: "Indonesia (Jakarta)", group: SOUTHEAST_ASIA },
  { value: "Asia/Makassar", label: "Indonesia (Bali)", group: SOUTHEAST_ASIA },
  { value: "Asia/Phnom_Penh", label: "Cambodia (Phnom Penh, Siem Reap)", group: SOUTHEAST_ASIA },
  { value: "Asia/Vientiane", label: "Laos (Vientiane, Luang Prabang)", group: SOUTHEAST_ASIA },
  { value: "Asia/Yangon", label: "Myanmar (Yangon)", group: SOUTHEAST_ASIA },
  { value: "Asia/Brunei", label: "Brunei", group: SOUTHEAST_ASIA },

  { value: "Asia/Tokyo", label: "Japan (Tokyo, Osaka, Kyoto)", group: EAST_ASIA },
  { value: "Asia/Seoul", label: "South Korea (Seoul, Busan)", group: EAST_ASIA },
  { value: "Asia/Taipei", label: "Taiwan (Taipei)", group: EAST_ASIA },
  { value: "Asia/Hong_Kong", label: "Hong Kong", group: EAST_ASIA },
  { value: "Asia/Macau", label: "Macau", group: EAST_ASIA },
  { value: "Asia/Shanghai", label: "China (Beijing, Shanghai)", group: EAST_ASIA },

  { value: "Asia/Kolkata", label: "India (Delhi, Mumbai)", group: SOUTH_ASIA_MIDDLE_EAST },
  { value: "Asia/Kathmandu", label: "Nepal (Kathmandu)", group: SOUTH_ASIA_MIDDLE_EAST },
  { value: "Asia/Colombo", label: "Sri Lanka (Colombo)", group: SOUTH_ASIA_MIDDLE_EAST },
  { value: "Indian/Maldives", label: "Maldives (Malé)", group: SOUTH_ASIA_MIDDLE_EAST },
  { value: "Asia/Dubai", label: "UAE (Dubai, Abu Dhabi)", group: SOUTH_ASIA_MIDDLE_EAST },
  { value: "Asia/Qatar", label: "Qatar (Doha)", group: SOUTH_ASIA_MIDDLE_EAST },
  { value: "Asia/Riyadh", label: "Saudi Arabia (Riyadh, Jeddah)", group: SOUTH_ASIA_MIDDLE_EAST },
  { value: "Europe/Istanbul", label: "Türkiye (Istanbul)", group: SOUTH_ASIA_MIDDLE_EAST },

  { value: "Australia/Sydney", label: "Australia (Sydney, Melbourne)", group: OCEANIA },
  { value: "Australia/Perth", label: "Australia (Perth)", group: OCEANIA },
  { value: "Pacific/Auckland", label: "New Zealand (Auckland)", group: OCEANIA },
  { value: "Pacific/Guam", label: "Guam", group: OCEANIA },

  { value: "Europe/London", label: "UK and Ireland (London, Dublin)", group: EUROPE },
  { value: "Europe/Paris", label: "France (Paris)", group: EUROPE },
  { value: "Europe/Madrid", label: "Spain (Madrid, Barcelona)", group: EUROPE },
  { value: "Europe/Rome", label: "Italy (Rome, Milan)", group: EUROPE },
  { value: "Europe/Berlin", label: "Germany (Berlin, Munich)", group: EUROPE },
  { value: "Europe/Amsterdam", label: "Netherlands (Amsterdam)", group: EUROPE },
  { value: "Europe/Athens", label: "Greece (Athens)", group: EUROPE },

  { value: "America/Los_Angeles", label: "US West (Los Angeles, San Francisco)", group: AMERICAS },
  { value: "America/New_York", label: "US East (New York, Miami)", group: AMERICAS },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)", group: AMERICAS },
  { value: "America/Toronto", label: "Canada (Toronto)", group: AMERICAS },
  { value: "America/Vancouver", label: "Canada (Vancouver)", group: AMERICAS },
];

export const DEFAULT_TIME_ZONE = "Asia/Manila";

export type CurrencyOption = { value: string; label: string };

export const CURRENCIES: CurrencyOption[] = [
  { value: "PHP", label: "PHP, Philippine peso" },
  { value: "VND", label: "VND, Vietnamese dong" },
  { value: "THB", label: "THB, Thai baht" },
  { value: "SGD", label: "SGD, Singapore dollar" },
  { value: "MYR", label: "MYR, Malaysian ringgit" },
  { value: "IDR", label: "IDR, Indonesian rupiah" },
  { value: "JPY", label: "JPY, Japanese yen" },
  { value: "KRW", label: "KRW, South Korean won" },
  { value: "TWD", label: "TWD, New Taiwan dollar" },
  { value: "HKD", label: "HKD, Hong Kong dollar" },
  { value: "CNY", label: "CNY, Chinese yuan" },
  { value: "AUD", label: "AUD, Australian dollar" },
  { value: "NZD", label: "NZD, New Zealand dollar" },
  { value: "USD", label: "USD, US dollar" },
  { value: "EUR", label: "EUR, Euro" },
  { value: "GBP", label: "GBP, British pound" },
  { value: "AED", label: "AED, UAE dirham" },
];

export const DEFAULT_CURRENCY = "PHP";

export function timeZoneLabel(value: string): string | null {
  return TIME_ZONES.find((zone) => zone.value === value)?.label ?? null;
}

// "Philippines (Manila, Cebu, Davao)" -> "Philippines": the place name for "Times are Philippines time".
export function timeZonePlace(value: string): string | null {
  const label = timeZoneLabel(value);
  return label ? label.replace(/\s*\(.*\)\s*$/, "") : null;
}
