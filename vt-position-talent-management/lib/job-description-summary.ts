import type { AppData } from "./types";

export function jobDescriptionRelations(data: AppData, masterId: string) {
  const positions = data.positions.filter((position) => position.jobDescriptionId === masterId);
  const peopleFor = (kind: "incumbents" | "successors") => {
    const ids = new Set(positions.flatMap((position) => (position[kind] ?? []).map((person) => person.id)));
    return data.people.filter((person) => ids.has(person.id)).map((person) => ({
      ...person, linkedPositions: positions.filter((position) => (position[kind] ?? []).some((item) => item.id === person.id)),
    }));
  };
  return { positions, incumbents: peopleFor("incumbents"), successors: peopleFor("successors") };
}

export function jobDescriptionStatusTone(status: string) {
  if (status === "正式生效") return "effective";
  if (status === "已失效") return "expired";
  if (status === "主管確認中") return "review";
  if (["待確認", "待修正", "訪談後修訂"].includes(status)) return "pending";
  if (status === "已確認") return "confirmed";
  return "draft";
}

export function displayEffectiveDate(status: string, date: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.replaceAll("-", "/");
  if (status !== "正式生效" && status !== "已失效") return "尚未生效";
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll("-", "/") : "待補日期";
}
