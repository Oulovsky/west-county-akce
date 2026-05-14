import PeopleTimelineClient from "./PeopleTimelineClient";

export default function Page() {
  const from = "2026-04-01T00:00:00.000Z";
  const to = "2026-04-30T23:59:59.999Z";

  return (
    <div className="w-full">
      <PeopleTimelineClient from={from} to={to} />
    </div>
  );
}