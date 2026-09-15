/** Primary navigation. Labels are translation keys under `nav`. */
export const primaryNav = [
  { key: "tours", href: "/tours" },
  { key: "destinations", href: "/destinations" },
  { key: "services", href: "/services" },
  { key: "about", href: "/about" },
  { key: "bookingMethods", href: "/booking-methods" },
  { key: "blog", href: "/blog" },
  { key: "partners", href: "/partners" },
  { key: "contact", href: "/contact" },
] as const;

export const footerExplore = [
  { key: "tours", href: "/tours" },
  { key: "destinations", href: "/destinations" },
  { key: "services", href: "/services" },
  { key: "planMyTrip", href: "/plan-my-trip" },
  { key: "blog", href: "/blog" },
] as const;

export const footerCompany = [
  { key: "about", href: "/about" },
  { key: "bookingMethods", href: "/booking-methods" },
  { key: "contact", href: "/contact" },
  { key: "policies", href: "/policies" },
  { key: "faq", href: "/faq" },
  { key: "account", href: "/account" },
] as const;

export const policyLinks = [
  { key: "terms", href: "/policies/terms" },
  { key: "cancellation", href: "/policies/cancellation" },
  { key: "privacy", href: "/policies/privacy" },
  { key: "cookies", href: "/policies/cookies" },
] as const;
