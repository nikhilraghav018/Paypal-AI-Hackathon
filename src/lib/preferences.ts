export const GENDERS = [
  { value: "male", label: "Men" },
  { value: "female", label: "Women" },
] as const;

export const AGES = [
  { value: "adult", label: "Adult" },
  { value: "kids", label: "Kids" },
  { value: "toddler", label: "Toddler" },
  { value: "infant", label: "Infant" },
  { value: "newborn", label: "Newborn" },
] as const;

export const COLORS = [
  { value: "black", label: "Black", hex: "#141414" },
  { value: "white", label: "White", hex: "#f5f5f5" },
  { value: "grey", label: "Grey", hex: "#8a8a8a" },
  { value: "red", label: "Red", hex: "#d32f2f" },
  { value: "orange", label: "Orange", hex: "#ef7c1a" },
  { value: "yellow", label: "Yellow", hex: "#f4cf2e" },
  { value: "green", label: "Green", hex: "#2e9e4f" },
  { value: "blue", label: "Blue", hex: "#2467c9" },
  { value: "navy", label: "Navy", hex: "#16264f" },
  { value: "purple", label: "Purple", hex: "#7b3fb5" },
  { value: "pink", label: "Pink", hex: "#ec79a8" },
  { value: "brown", label: "Brown", hex: "#6f4a2d" },
  { value: "beige", label: "Beige", hex: "#d9c6a5" },
] as const;

export const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
] as const;

export interface Preferences {
  gender?: (typeof GENDERS)[number]["value"];
  age?: (typeof AGES)[number]["value"];
  color?: (typeof COLORS)[number]["value"];
  condition?: (typeof CONDITIONS)[number]["value"];
}

export function preferenceLabels(preferences: Preferences | undefined): string[] {
  if (!preferences) return [];
  const label = (list: readonly { value: string; label: string }[], value?: string) =>
    list.find((option) => option.value === value)?.label;
  return [
    label(GENDERS, preferences.gender),
    label(AGES, preferences.age),
    label(COLORS, preferences.color),
    label(CONDITIONS, preferences.condition),
  ].filter((text): text is string => Boolean(text));
}
