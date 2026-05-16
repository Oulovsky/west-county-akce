import PeopleTimelineClient from "./PeopleTimelineClient";

export default function Page() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  ).toISOString();

  return (
    <div className="w-full">
      <PeopleTimelineClient from={from} to={to} />
    </div>
  );
}