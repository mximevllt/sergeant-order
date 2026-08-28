import { getDatabase } from "@/db/runtime";

type OrderTaskRow = { orderId: string; label: string | null };

export type InterventionDirectoryItem = {
  id: string;
  reference: string;
  status: string;
  customerName: string;
  gardenLabel: string;
  address: string;
  teamName: string;
  plannedStartsAt: string;
  plannedEndsAt: string;
  tasks: string[];
};

export type CustomerDirectoryItem = { id: string; fullName: string; email: string; phone: string | null; gardens: number; orders: number; latestOrderAt: string | null };
export type GardenDirectoryItem = { id: string; label: string; customerName: string; address: string; surfaceM2: number | null; slope: string; orders: number; lastVisitAt: string | null };
export type TeamDirectoryItem = { id: string; name: string; code: string; color: string | null; active: boolean; members: Array<{ fullName: string; role: string }>; capabilities: string[]; scheduledMissions: number };

export async function listInterventions(): Promise<InterventionDirectoryItem[]> {
  const database = getDatabase();
  const [interventions, taskRows] = await Promise.all([
    database.prepare(`
      SELECT i.id, i.order_id AS orderId, o.public_reference AS reference, i.status, u.full_name AS customerName,
        g.label AS gardenLabel, a.line1 || ', ' || a.postal_code || ' ' || a.city AS address,
        t.name AS teamName, i.planned_starts_at AS plannedStartsAt, i.planned_ends_at AS plannedEndsAt
      FROM interventions i
      JOIN orders o ON o.id = i.order_id
      JOIN users u ON u.id = o.customer_user_id
      JOIN gardens g ON g.id = o.garden_id
      JOIN addresses a ON a.id = g.address_id
      JOIN teams t ON t.id = i.team_id
      ORDER BY i.planned_starts_at DESC, o.public_reference DESC
    `).all<Omit<InterventionDirectoryItem, "tasks"> & { orderId: string }>(),
    database.prepare(`SELECT i.order_id AS orderId, ot.label_snapshot AS label FROM interventions i JOIN order_tasks ot ON ot.order_id = i.order_id ORDER BY ot.priority, ot.label_snapshot`).all<OrderTaskRow>(),
  ]);
  const tasksByOrder = new Map<string, string[]>();
  for (const row of taskRows.results) {
    if (!row.label) continue;
    const tasks = tasksByOrder.get(row.orderId) ?? [];
    if (!tasks.includes(row.label)) tasks.push(row.label);
    tasksByOrder.set(row.orderId, tasks);
  }
  return interventions.results.map(({ orderId, ...item }) => ({ ...item, tasks: tasksByOrder.get(orderId) ?? [] }));
}

export async function listCustomers(): Promise<CustomerDirectoryItem[]> {
  const result = await getDatabase().prepare(`
    SELECT u.id, u.full_name AS fullName, u.email, u.phone,
      COUNT(DISTINCT g.id) AS gardens, COUNT(DISTINCT o.id) AS orders, MAX(o.created_at) AS latestOrderAt
    FROM users u
    JOIN customer_profiles cp ON cp.user_id = u.id
    LEFT JOIN gardens g ON g.owner_user_id = u.id AND g.archived_at IS NULL
    LEFT JOIN orders o ON o.customer_user_id = u.id
    GROUP BY u.id, u.full_name, u.email, u.phone
    ORDER BY latestOrderAt DESC, u.full_name COLLATE NOCASE
  `).all<CustomerDirectoryItem>();
  return result.results;
}

export async function listGardens(): Promise<GardenDirectoryItem[]> {
  const result = await getDatabase().prepare(`
    SELECT g.id, g.label, u.full_name AS customerName, a.line1 || ', ' || a.postal_code || ' ' || a.city AS address,
      g.surface_m2 AS surfaceM2, g.terrain_slope AS slope, COUNT(o.id) AS orders, MAX(i.planned_starts_at) AS lastVisitAt
    FROM gardens g
    JOIN users u ON u.id = g.owner_user_id
    JOIN addresses a ON a.id = g.address_id
    LEFT JOIN orders o ON o.garden_id = g.id
    LEFT JOIN interventions i ON i.order_id = o.id
    WHERE g.archived_at IS NULL
    GROUP BY g.id, g.label, u.full_name, a.line1, a.postal_code, a.city, g.surface_m2, g.terrain_slope
    ORDER BY lastVisitAt DESC, g.created_at DESC
  `).all<GardenDirectoryItem>();
  return result.results;
}

export async function listTeams(): Promise<TeamDirectoryItem[]> {
  const database = getDatabase();
  const [teams, members, capabilities, missionCounts] = await Promise.all([
    database.prepare("SELECT id, name, code, color, active FROM teams ORDER BY active DESC, code").all<Omit<TeamDirectoryItem, "members" | "capabilities" | "scheduledMissions">>(),
    database.prepare("SELECT tm.team_id AS teamId, u.full_name AS fullName, tm.role FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.ends_at IS NULL ORDER BY tm.role, u.full_name COLLATE NOCASE").all<{ teamId: string; fullName: string; role: string }>(),
    database.prepare("SELECT team_id AS teamId, capability FROM team_capabilities WHERE active = 1 ORDER BY capability").all<{ teamId: string; capability: string }>(),
    database.prepare("SELECT team_id AS teamId, COUNT(*) AS scheduledMissions FROM interventions WHERE status NOT IN ('COMPLETED','CANCELLED') GROUP BY team_id").all<{ teamId: string; scheduledMissions: number }>(),
  ]);
  const membersByTeam = new Map<string, TeamDirectoryItem["members"]>();
  for (const member of members.results) (membersByTeam.get(member.teamId) ?? membersByTeam.set(member.teamId, []).get(member.teamId)!).push({ fullName: member.fullName, role: member.role });
  const capabilitiesByTeam = new Map<string, string[]>();
  for (const capability of capabilities.results) (capabilitiesByTeam.get(capability.teamId) ?? capabilitiesByTeam.set(capability.teamId, []).get(capability.teamId)!).push(capability.capability);
  const missionsByTeam = new Map(missionCounts.results.map((item) => [item.teamId, Number(item.scheduledMissions)]));
  return teams.results.map((team) => ({ ...team, active: Boolean(team.active), members: membersByTeam.get(team.id) ?? [], capabilities: capabilitiesByTeam.get(team.id) ?? [], scheduledMissions: missionsByTeam.get(team.id) ?? 0 }));
}
