import type { SiteSettings } from "./types";

/**
 * Default public content. Values marked "[Placeholder]" must be confirmed by the
 * association and can be edited from Admin → Settings.
 */
export const DEFAULT_SETTINGS: SiteSettings = {
  association_name: "Hindupur Two Wheelers Mechanic & Owners Association",
  short_name: "HTWMA",
  tagline: "Together for a Stronger Two Wheeler Community",
  location_label: "Hindupur, Andhra Pradesh",
  address: "#17-8-146, Ward No.17, Parigi Road, Hindupur-515201, Sri Sathya Sai Dist., Andhra Pradesh",
  phone: "7386557855",
  whatsapp: "7386557855",
  email: "",
  office_hours: "[Placeholder] Office hours to be confirmed",
  map_url: "https://www.google.com/maps/search/?api=1&query=Parigi+Road+Hindupur+515201",
  facebook_url: "",
  youtube_url: "",
  x_url: "",
  home_intro:
    "HTWMA is a dedicated association of Two Wheeler Mechanics and Owners in Hindupur, working together for the welfare, skill development and growth of our community.",
  about_intro:
    "The Hindupur Two Wheelers Mechanic & Owners Association (HTWMA) brings together two-wheeler mechanics and workshop owners of Hindupur under one united platform.",
  mission:
    "To support the welfare of our members, encourage fair and skilled service, and speak with one voice for the two-wheeler service community of Hindupur.",
  vision:
    "A respected, skilled and united two-wheeler mechanic community that every vehicle owner in Hindupur can trust.",
  history:
    "[Placeholder] The association's history, founding year and milestones will be added here once approved by the committee.",
  activities: [
    "Regular members' meetings and discussions",
    "Welfare support for members and their families",
    "Skill development and new-technology awareness",
    "Representation of members' common concerns",
    "Community and social service activities",
  ].join("\n"),
  updates: [
    {
      id: "u1",
      title: "Member records are going digital",
      date: "2026-11-21",
      body: "The association is moving its paper registration records to a secure digital system. Members may be contacted to confirm their details.",
    },
  ],
  form_code: "REGISTRATION FORM F-140/2020, HINDUPUR",
  required_fields: ["mobile"],
  fee_defaults: { Registration: 199, Annual: 199 },
};

export const DEFAULT_ROLES = [
  { role_name: "President", is_multiple_allowed: false },
  { role_name: "Vice President", is_multiple_allowed: false },
  { role_name: "General Secretary", is_multiple_allowed: false },
  { role_name: "Secretary", is_multiple_allowed: false },
  { role_name: "Treasurer", is_multiple_allowed: false },
  { role_name: "Executive Committee Member", is_multiple_allowed: true },
] as const;

export function isPlaceholder(value: string): boolean {
  return !value.trim() || value.includes("[Placeholder]");
}
