export function isAdmin(role: string | null) {
  return role === "admin_user";
}

export function isOrgAdmin(role: string | null) {
  return role === "org_admin";
}

export function isOrgUser(role: string | null) {
  return role === "admin_user";
}