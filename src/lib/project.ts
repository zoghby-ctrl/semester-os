// This is public build-time information, never a secret or a personal default.
const configuredContact: unknown = import.meta.env.VITE_PROJECT_CONTACT;
export const projectContact = typeof configuredContact === "string" && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(configuredContact) && configuredContact.length <= 254 ? configuredContact : null;
export const legalUpdated = "October 1, 2026";
