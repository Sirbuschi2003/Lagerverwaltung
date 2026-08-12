import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";

/**
 * Anzahl der Passwort-Hashes, die pro Benutzer in der Historie gespeichert werden.
 * Verhindert die Wiederverwendung der letzten N Passwoerter.
 */
export const PASSWORD_HISTORY_LIMIT = 5;

/**
 * Prueft ob ein Klartext-Passwort in den letzten N gespeicherten Hashes des Benutzers vorkommt.
 */
export async function isPasswordInHistory(
  repo: Repository<any>,
  userId: string,
  plainPassword: string,
): Promise<boolean> {
  const history = await repo.find({
    where: { user: { id: userId } },
    order: { createdAt: "DESC" },
    take: PASSWORD_HISTORY_LIMIT,
    relations: ["user"],
  });
  for (const entry of history) {
    if (await bcrypt.compare(plainPassword, entry.passwordHash)) return true;
  }
  return false;
}

/**
 * Fuegt einen neuen Passwort-Hash zur Historie hinzu und entfernt Eintraege
 * die das Limit ueberschreiten (aelteste zuerst).
 */
export async function addToPasswordHistory(
  repo: Repository<any>,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await repo.save(repo.create({ user: { id: userId }, passwordHash }));
  const all = await repo.find({
    where: { user: { id: userId } },
    order: { createdAt: "DESC" },
    relations: ["user"],
  });
  if (all.length > PASSWORD_HISTORY_LIMIT) {
    const toDelete = all.slice(PASSWORD_HISTORY_LIMIT);
    await repo.remove(toDelete);
  }
}
