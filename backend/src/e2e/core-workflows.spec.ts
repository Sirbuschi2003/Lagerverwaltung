type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface LoginResponse {
  accessToken: string;
}

interface EntityWithId {
  id: string;
}

interface PurchaseOrderLineResponse extends EntityWithId {
  quantity: number;
  receivedQuantity: number;
}

interface PurchaseOrderResponse extends EntityWithId {
  status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED" | "ARCHIVED";
  lines: PurchaseOrderLineResponse[];
}

interface VehicleStockEntry {
  item: {
    id: string;
  };
  quantity: number;
}

interface RestockRequestView {
  id: string;
  status: "PENDING" | "APPROVED" | "FULFILLED" | "CANCELLED";
  quantityNeeded: number;
  quantityProvided: number;
  warehouseAvailable: number;
  item: {
    id: string;
  };
}

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000/api";
const e2eUsername = process.env.E2E_USERNAME;
const e2ePassword = process.env.E2E_PASSWORD;
const shouldRun = Boolean(e2eUsername && e2ePassword);
const describeIf = shouldRun ? describe : describe.skip;

const buildUrl = (path: string) => `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

async function requestJson<T>(
  path: string,
  method: HttpMethod,
  body?: JsonValue,
  token?: string,
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${method} ${path}: ${text}`);
  }

  return parsed as T;
}

async function bestEffortDelete(path: string, token: string): Promise<void> {
  try {
    await fetch(buildUrl(path), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // cleanup intentionally best-effort
  }
}

describeIf("Core workflows E2E", () => {
  let token = "";
  const suffix = `e2e-${Date.now()}`;
  const cleanupState: {
    orderId?: string;
    itemId?: string;
    vehicleId?: string;
    supplierId?: string;
    locationId?: string;
  } = {};

  beforeAll(async () => {
    const username = e2eUsername ?? "";
    const password = e2ePassword ?? "";
    const login = await requestJson<LoginResponse>(
      "/auth/login",
      "POST",
      {
        username,
        password,
      },
    );
    token = login.accessToken;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    if (!token) {
      return;
    }
    if (cleanupState.orderId) {
      await bestEffortDelete(`/purchase-orders/${cleanupState.orderId}`, token);
    }
    if (cleanupState.itemId) {
      await bestEffortDelete(`/items/${cleanupState.itemId}`, token);
    }
    if (cleanupState.vehicleId) {
      await bestEffortDelete(`/vehicles/${cleanupState.vehicleId}`, token);
    }
    if (cleanupState.supplierId) {
      await bestEffortDelete(`/suppliers/${cleanupState.supplierId}`, token);
    }
    if (cleanupState.locationId) {
      await bestEffortDelete(`/locations/${cleanupState.locationId}`, token);
    }
  });

  it("runs goods-receipt, restock preparation and pickup in one workflow", async () => {
    const location = await requestJson<EntityWithId>(
      "/locations",
      "POST",
      {
        type: "WAREHOUSE",
        code: `E2E-WH-${suffix}`,
        name: `E2E Warehouse ${suffix}`,
      },
      token,
    );
    cleanupState.locationId = location.id;

    const supplier = await requestJson<EntityWithId>(
      "/suppliers",
      "POST",
      {
        name: `E2E Supplier ${suffix}`,
      },
      token,
    );
    cleanupState.supplierId = supplier.id;

    const vehicle = await requestJson<EntityWithId>(
      "/vehicles",
      "POST",
      {
        licensePlate: `E2E-${Date.now()}`.slice(-10),
        description: `E2E Vehicle ${suffix}`,
      },
      token,
    );
    cleanupState.vehicleId = vehicle.id;

    const item = await requestJson<EntityWithId>(
      "/items",
      "POST",
      {
        code: `E2E-ITEM-${Date.now()}`.slice(-14),
        description: `E2E Item ${suffix}`,
        manufacturer: "E2E",
        productGroup: "E2E",
        storageLocationId: location.id,
        supplierId: supplier.id,
      },
      token,
    );
    cleanupState.itemId = item.id;

    const order = await requestJson<PurchaseOrderResponse>(
      "/purchase-orders",
      "POST",
      {
        supplierId: supplier.id,
        lines: [
          {
            itemId: item.id,
            quantity: 5,
          },
        ],
      },
      token,
    );
    cleanupState.orderId = order.id;
    expect(order.lines.length).toBe(1);

    const orderLineId = order.lines[0]?.id;
    expect(orderLineId).toBeTruthy();
    if (!orderLineId) {
      throw new Error("Order line ID missing after creating purchase order");
    }

    const partialReceipt = await requestJson<PurchaseOrderResponse>(
      `/purchase-orders/${order.id}/receive`,
      "POST",
      {
        lines: [
          {
            lineId: orderLineId,
            receivedQuantity: 3,
          },
        ],
      },
      token,
    );
    expect(partialReceipt.status).toBe("ORDERED");
    expect(partialReceipt.lines[0]?.receivedQuantity).toBe(3);

    const fullReceipt = await requestJson<PurchaseOrderResponse>(
      `/purchase-orders/${order.id}/receive`,
      "POST",
      {
        lines: [
          {
            lineId: orderLineId,
            receivedQuantity: 2,
          },
        ],
      },
      token,
    );
    expect(fullReceipt.status).toBe("RECEIVED");
    expect(fullReceipt.lines[0]?.receivedQuantity).toBe(5);

    await requestJson(
      `/stock/vehicle/${vehicle.id}/target`,
      "PATCH",
      {
        itemId: item.id,
        targetQuantity: 2,
      },
      token,
    );

    const shortages = await requestJson<RestockRequestView[]>(
      `/stock/vehicle/${vehicle.id}/shortages`,
      "GET",
      undefined,
      token,
    );
    const openRequest = shortages.find((request) => request.item.id === item.id && request.status !== "FULFILLED");
    expect(openRequest).toBeDefined();
    expect(openRequest?.quantityNeeded).toBeGreaterThanOrEqual(2);
    expect(openRequest?.warehouseAvailable).toBeGreaterThanOrEqual(2);
    if (!openRequest) {
      throw new Error("No open restock request found after target update");
    }

    const approved = await requestJson<RestockRequestView>(
      `/stock/shortages/${openRequest.id}`,
      "PATCH",
      {
        status: "APPROVED",
        quantityProvided: 2,
        locationId: location.id,
      },
      token,
    );
    expect(approved.status).toBe("APPROVED");
    expect(approved.quantityProvided).toBe(2);

    const fulfilled = await requestJson<RestockRequestView>(
      `/stock/shortages/${openRequest.id}`,
      "PATCH",
      {
        status: "FULFILLED",
      },
      token,
    );
    expect(fulfilled.status).toBe("FULFILLED");
    expect(fulfilled.quantityProvided).toBe(0);

    const vehicleStock = await requestJson<VehicleStockEntry[]>(
      `/stock/vehicle/${vehicle.id}`,
      "GET",
      undefined,
      token,
    );
    const vehicleItem = vehicleStock.find((entry) => entry.item.id === item.id);
    expect(vehicleItem).toBeDefined();
    expect(vehicleItem?.quantity ?? 0).toBeGreaterThanOrEqual(2);

    const remainingShortages = await requestJson<RestockRequestView[]>(
      `/stock/vehicle/${vehicle.id}/shortages`,
      "GET",
      undefined,
      token,
    );
    const stillOpen = remainingShortages.find((request) => request.item.id === item.id && request.status !== "FULFILLED");
    expect(stillOpen).toBeUndefined();
  });
});
