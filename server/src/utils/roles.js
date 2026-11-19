// Owner or admin at a property (req.propertyAccess): the org owner, or a
// property role named Admin / Administrator / Manager. These may delete
// records and override other people's work (tickets, visitors, expenses).
const ADMIN_ROLES = /^(admin|administrator|manager)$/i

export const isPropertyAdmin = (pa) => !!pa && (pa.isOwner || ADMIN_ROLES.test(String(pa.roleName || '').trim()))
