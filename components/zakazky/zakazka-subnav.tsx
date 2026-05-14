import Link from "next/link";
import { Button } from "@/components/ui/button";

type ZakazkaSubnavTab = "detail" | "technika" | "nakladka" | "historie" | "people";

export function ZakazkaSubnav({
  zakazkaId,
  active,
  showBackLink = false,
}: {
  zakazkaId: string;
  active: ZakazkaSubnavTab;
  showBackLink?: boolean;
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
    {
      key: "nakladka",
      label: "Nakládka",
      href: `/zakazky/${zakazkaId}/nakladka`,
    },
    {
      key: "historie",
      label: "Historie",
      href: `/zakazky/${zakazkaId}/historie`,
    },
    {
      key: "people",
      label: "Lidé",
      href: `/zakazky/${zakazkaId}/people`,
    },
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