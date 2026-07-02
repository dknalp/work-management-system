export interface CustomNavLink {
  id: string;
  title: string;
  url: string;
  roles: "all" | string[];
}

const CUSTOM_NAV_LINKS_KEY = "wms:custom_nav_links";

export function getCustomNavLinks(): CustomNavLink[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CUSTOM_NAV_LINKS_KEY);
    return stored ? (JSON.parse(stored) as CustomNavLink[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomNavLinks(links: CustomNavLink[]): void {
  localStorage.setItem(CUSTOM_NAV_LINKS_KEY, JSON.stringify(links));
  window.dispatchEvent(new Event("wms:custom-nav-changed"));
}

export function addCustomNavLink(
  link: Omit<CustomNavLink, "id">
): CustomNavLink[] {
  const links = getCustomNavLinks();
  const newLink: CustomNavLink = { ...link, id: Date.now().toString() };
  const updated = [...links, newLink];
  saveCustomNavLinks(updated);
  return updated;
}

export function removeCustomNavLink(id: string): CustomNavLink[] {
  const links = getCustomNavLinks().filter((l) => l.id !== id);
  saveCustomNavLinks(links);
  return links;
}

export function getLinksForRole(
  role: string,
  isAdmin: boolean
): CustomNavLink[] {
  const links = getCustomNavLinks();
  return links.filter((link) => {
    if (link.roles === "all") return true;
    if (isAdmin) return true;
    return Array.isArray(link.roles) && link.roles.includes(role);
  });
}