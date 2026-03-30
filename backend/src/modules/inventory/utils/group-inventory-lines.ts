import type { InventoryLine } from "../entities/inventory-line.entity";

export interface InventoryGroup {
  manufacturer: string;
  productGroup: string;
  lines: InventoryLine[];
}

const normalize = (value?: string | null, fallback = "Unbekannt") => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

export const groupInventoryLines = (lines: InventoryLine[] = []): InventoryGroup[] => {
  const groupsMap = new Map<string, InventoryGroup>();

  lines.forEach((line) => {
    const manufacturer = normalize(line.item?.manufacturer, "Unbekannter Hersteller");
    const productGroup = normalize(line.item?.productGroup, "Allgemein");
    const key = `${manufacturer}||${productGroup}`;

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        manufacturer,
        productGroup,
        lines: [],
      });
    }

    groupsMap.get(key)!.lines.push(line);
  });

  const groups = Array.from(groupsMap.values());

  groups.forEach((group) => {
    group.lines.sort((a, b) => {
      const codeA = a.item?.code || "";
      const codeB = b.item?.code || "";
      return codeA.localeCompare(codeB, "de", { sensitivity: "base" });
    });
  });

  groups.sort((a, b) => {
    const manufacturerCompare = a.manufacturer.localeCompare(b.manufacturer, "de", {
      sensitivity: "base",
    });
    if (manufacturerCompare !== 0) {
      return manufacturerCompare;
    }
    return a.productGroup.localeCompare(b.productGroup, "de", { sensitivity: "base" });
  });

  return groups;
};
