import Link from "next/link";
import { Button } from "@/components/ui/button";

type ZakazkaSubnavTab =
  | "detail"
  | "technika"
  | "nakladka"
  | "historie"
  | "people";

export function ZakazkaSubnav({
  zakazkaId,
  active,
  showBackLink = false,
  showNakladka = true,
  showPeople = true,
}: {
  zakazkaId: string;
  active: ZakazkaSubnavTab;
  showBackLink?: boolean;
  showNakladka?: boolean;
  showPeople?: boolean;
}) {
  const items: Array<{
    key: ZakazkaSubnavTab;
    label: string;
    href: string;
  }> = [
    {
      key: "detail",
      label: "Detail",
      href: `/zakazky/${zakazkaId}`,
    },
    {
      key: "technika",
      label: "Technika",
      href: `/zakazky/${zakazkaId}/technika`,
    },
    ...(showNakladka
      ? [
          {
            key: "nakladka" as const,
            label: "Nakládka",
            href: `/zakazky/${zakazkaId}/scan`,
          },
        ]
      : []),
    {
      key: "historie",
      label: "Historie",
      href: `/zakazky/${zakazkaId}/historie`,
    },
    ...(showPeople
      ? [
          {
            key: "people" as const,
            label: "Lidé",
            href: `/zakazky/${zakazkaId}/people`,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {showBackLink ? (
        <Link href="/zakazky">
          <Button variant="secondary">Zakázky</Button>
        </Link>
      ) : null}

      {items.map((item) => (
        <Link key={item.key} href={item.href}>
          <Button variant={item.key === active ? "primary" : "secondary"}>
            {item.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}