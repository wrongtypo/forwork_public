import TalentManagementApp from "./TalentManagementApp";

// The local application loads current HR data through /api/data, not a static snapshot.
export const dynamic = "force-dynamic";

export default function Home() {
  return <TalentManagementApp />;
}
