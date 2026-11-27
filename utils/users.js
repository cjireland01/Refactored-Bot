import db from "./db.js";

// Members and their alt-account flag.

const stmts = {
  all: db.prepare(`
    SELECT u.id, u.username, u.is_alt, COUNT(v.id) AS vehicle_count
    FROM users u
    LEFT JOIN vehicles v ON v.user_id = u.id
    GROUP BY u.id
    ORDER BY LOWER(u.username)
  `),
  byName: db.prepare("SELECT id, username, is_alt FROM users WHERE LOWER(username) = ?"),
  byId: db.prepare("SELECT id, username, is_alt FROM users WHERE id = ?"),
  setAlt: db.prepare("UPDATE users SET is_alt = ? WHERE id = ?"),
};

/** Every member with how many vehicles they have, A-Z */
export function listUsers() {
  return stmts.all.all().map((u) => ({ ...u, is_alt: u.is_alt ? 1 : 0 }));
}

export const findUserByName = (name) => stmts.byName.get(String(name).toLowerCase());
export const findUserById = (id) => stmts.byId.get(id);

/** Mark or unmark a member as an alt account. Returns false if there is no such member. */
export function setUserAlt(id, isAlt) {
  return stmts.setAlt.run(isAlt ? 1 : 0, id).changes > 0;
}
